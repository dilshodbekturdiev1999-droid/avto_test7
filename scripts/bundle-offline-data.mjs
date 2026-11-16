#!/usr/bin/env node
// Pulls the current question bank (both languages) out of Supabase and bakes
// it into the app as static files, so the built app studies fully offline
// from the very first launch -- no download step.
//
// Runs at BUILD time only (in CI, or locally against a real project when you
// have SUPABASE_SERVICE_ROLE_KEY set), never inside the shipped app: it needs
// the service_role key to read past RLS, and that key must never end up in
// the app bundle. Video stays out of this on purpose -- it is hosted on
// YouTube already and is far too heavy to bundle (see the app's memory notes
// on this decision).
//
// Output (all under public/offline/, which Vite copies verbatim into dist/):
//   data/manifest.json   -- version + counts, used to detect stale bundles
//   data/lessons.json    -- bilingual rows (title / title_ru), like the site
//   data/topics.json     -- bilingual rows (title_uz_cyr / title_ru)
//   data/questions_uz.json, data/questions_ru.json
//       -- one row per topic_id: { topic_id, questions: [...with nested answers] }
//   data/traffic_signs.json
//   images/uz/<path>, images/ru/<path>, images/signs/<path>
//       -- exact bytes from the question-images / question-images-ru /
//          "foydali malumotlar" buckets, referenced by image_path

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DATA = path.join(ROOT, 'public', 'offline', 'data')
const OUT_IMG = path.join(ROOT, 'public', 'offline', 'images')

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://vywzulllyxlhynxgmpqc.supabase.co'
const SERVICE_KEY = process.env.OFFLINE_BUNDLE_SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) {
  console.error('Missing OFFLINE_BUNDLE_SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) -- cannot bundle offline content.')
  process.exit(1)
}

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

// PostgREST caps a single response at 1000 rows (max-rows) regardless of
// what you ask for -- silently, with no error, which is exactly how this
// first cut of the script under-counted answers (4278 -> 1000) the first
// time it ran. Page through with Range until a page comes back short.
const PAGE_SIZE = 1000
async function restSelect(table, query = '') {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`
    const res = await fetch(url, {
      headers: { ...restHeaders, Range: `${offset}-${offset + PAGE_SIZE - 1}` },
    })
    if (!res.ok && res.status !== 206) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function downloadImage(bucket, imagePath, destDir) {
  if (!imagePath) return
  const dest = path.join(destDir, imagePath)
  try {
    await fs.access(dest)
    return // already downloaded this run (shared image path, or re-run)
  } catch {
    /* not present yet, fall through and fetch it */
  }
  await fs.mkdir(path.dirname(dest), { recursive: true })
  const url = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${imagePath}`
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  ! image missing, skipping: ${bucket}/${imagePath} (HTTP ${res.status})`)
    return
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(dest, buf)
}

// Small bounded-concurrency pool -- ~1500 images one at a time (the first
// run) took 7+ minutes; a modest pool of parallel downloads is much faster
// without hammering Storage.
async function downloadAll(jobs, concurrency = 16) {
  let done = 0
  let cursor = 0
  const total = jobs.length
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      await downloadImage(job.bucket, job.imagePath, job.destDir)
      done++
      if (done % 100 === 0 || done === total) console.log(`  images: ${done}/${total}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
}

// Groups a flat questions+answers pull into the same shape get-data's
// 'questions-with-answers' action returns, keyed by topic_id so the client
// can slice it per topic without re-fetching anything.
function groupQuestions(questions, answers) {
  const byTopic = new Map()
  const answersByQuestion = new Map()
  for (const a of answers) {
    if (!answersByQuestion.has(a.question_id)) answersByQuestion.set(a.question_id, [])
    answersByQuestion.get(a.question_id).push(a)
  }
  for (const q of questions) {
    if (!byTopic.has(q.topic_id)) byTopic.set(q.topic_id, [])
    byTopic.get(q.topic_id).push({ ...q, answers: answersByQuestion.get(q.id) ?? [] })
  }
  const out = {}
  for (const [topicId, qs] of byTopic) {
    out[topicId] = qs.sort((a, b) => a.order_index - b.order_index)
  }
  return out
}

async function main() {
  console.log('Bundling offline content from', SUPABASE_URL)
  await fs.rm(path.join(ROOT, 'public', 'offline'), { recursive: true, force: true })
  await fs.mkdir(OUT_DATA, { recursive: true })

  const [lessons, topics, questionsUz, answersUz, questionsRu, answersRu, trafficSigns] = await Promise.all([
    restSelect('lessons', 'select=id,title,title_ru,order_index&order=order_index.asc,id.asc'),
    restSelect('topics', 'select=id,lesson_id,title_uz_cyr,title_ru,order_index,youtube_url&order=order_index.asc,id.asc'),
    restSelect('questions', 'select=id,topic_id,question_uz_cyr,image_path,order_index&order=order_index.asc,id.asc'),
    restSelect('answers', 'select=id,question_id,answer_uz_cyr,is_correct&order=id.asc'),
    restSelect('questions_ru', 'select=id,topic_id,question_ru,image_path,order_index&order=order_index.asc,id.asc'),
    restSelect('answers_ru', 'select=id,question_id,answer_ru,is_correct&order=id.asc'),
    restSelect('traffic_signs', 'select=id,number,category,title,title_ru,description,description_ru,image_path,order_index&order=order_index.asc'),
  ])

  console.log(`lessons=${lessons.length} topics=${topics.length}`)
  console.log(`uz: questions=${questionsUz.length} answers=${answersUz.length}`)
  console.log(`ru: questions=${questionsRu.length} answers=${answersRu.length}`)
  console.log(`traffic_signs=${trafficSigns.length}`)

  await fs.writeFile(path.join(OUT_DATA, 'lessons.json'), JSON.stringify(lessons))
  await fs.writeFile(path.join(OUT_DATA, 'topics.json'), JSON.stringify(topics))
  await fs.writeFile(path.join(OUT_DATA, 'questions_uz.json'), JSON.stringify(groupQuestions(questionsUz, answersUz)))
  await fs.writeFile(path.join(OUT_DATA, 'questions_ru.json'), JSON.stringify(groupQuestions(questionsRu, answersRu)))
  await fs.writeFile(path.join(OUT_DATA, 'traffic_signs.json'), JSON.stringify(trafficSigns))

  const jobs = [
    ...questionsUz.filter((q) => q.image_path).map((q) => ({ bucket: 'question-images', imagePath: q.image_path, destDir: path.join(OUT_IMG, 'uz') })),
    ...questionsRu.filter((q) => q.image_path).map((q) => ({ bucket: 'question-images-ru', imagePath: q.image_path, destDir: path.join(OUT_IMG, 'ru') })),
    ...trafficSigns.filter((s) => s.image_path).map((s) => ({ bucket: 'foydali malumotlar', imagePath: s.image_path, destDir: path.join(OUT_IMG, 'signs') })),
  ]
  // The website reads pictures straight from storage (VITE_IMAGES_FROM_STORAGE=1), so CI skips them there.
  const skipImages = process.env.OFFLINE_BUNDLE_SKIP_IMAGES === '1'
  if (!skipImages) {
    console.log(`Downloading ${jobs.length} images (16 at a time)...`)
    await downloadAll(jobs)
  }
  const imgCount = skipImages ? 0 : jobs.length

  const manifest = {
    version: new Date().toISOString(),
    counts: {
      lessons: lessons.length,
      topics: topics.length,
      questions_uz: questionsUz.length,
      questions_ru: questionsRu.length,
      traffic_signs: trafficSigns.length,
      images: imgCount,
    },
  }
  await fs.writeFile(path.join(OUT_DATA, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('manifest:', manifest)
}

main().catch((err) => {
  console.error('bundle-offline-data failed:', err)
  process.exit(1)
})

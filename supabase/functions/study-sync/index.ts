import { corsHeaders } from '../_shared/cors.ts'
import { createDb } from '../_shared/db.ts'
import { validateSession } from '../_shared/session.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAVED_KINDS = new Set(['question', 'cheatsheet', 'sign'])
const MAX_OPS = 300

type Op =
  | { type: 'answer'; question_id: string; correct: boolean; at?: number }
  | { type: 'save'; kind: string; key: string; saved: boolean; at?: number }

// "My mistakes" and bookmarks of one student. The device keeps its own copy and sends
// what changed; the server keeps the copy that follows him from the site to the app.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, session_token, device_id } = body

    const db = createDb()
    const session = await validateSession(db, session_token, device_id, req)
    if ('error' in session) return json({ error: session.error }, 401)
    const userId = session.user.id

    switch (action) {
      case 'get': {
        const [{ data: mistakes, error: e1 }, { data: saved, error: e2 }] = await Promise.all([
          db.from('user_mistakes').select('question_id, updated_at').eq('user_id', userId),
          db.from('user_saved').select('kind, item_key, created_at').eq('user_id', userId),
        ])
        if (e1) throw e1
        if (e2) throw e2
        return json({
          data: {
            mistakes: Object.fromEntries((mistakes || []).map((m: any) => [m.question_id, Date.parse(m.updated_at)])),
            saved: Object.fromEntries((saved || []).map((s: any) => [`${s.kind}:${s.item_key}`, Date.parse(s.created_at)])),
          },
        })
      }

      case 'sync': {
        const ops: Op[] = Array.isArray(body.ops) ? body.ops.slice(0, MAX_OPS) : []
        const now = Date.now()
        // Oldest first: the last answer to a question is the one that stays.
        ops.sort((a, b) => (a.at ?? now) - (b.at ?? now))

        for (const op of ops) {
          const at = new Date(Math.min(op.at ?? now, now)).toISOString()

          if (op.type === 'answer') {
            if (typeof op.question_id !== 'string' || !UUID.test(op.question_id)) continue
            if (op.correct) {
              // A right answer clears the mistake, unless a newer wrong answer came from another device.
              await db.from('user_mistakes').delete().eq('user_id', userId).eq('question_id', op.question_id).lte('updated_at', at)
            } else {
              // UZ and RU questions live in separate tables; the id says which one it is.
              const { data: uz } = await db.from('questions').select('id').eq('id', op.question_id).maybeSingle()
              let lang: 'uz' | 'ru' | null = uz ? 'uz' : null
              if (!lang) {
                const { data: ru } = await db.from('questions_ru').select('id').eq('id', op.question_id).maybeSingle()
                if (ru) lang = 'ru'
              }
              if (!lang) continue
              const { data: existing } = await db
                .from('user_mistakes')
                .select('updated_at')
                .eq('user_id', userId)
                .eq('question_id', op.question_id)
                .maybeSingle()
              if (!existing || Date.parse(existing.updated_at) <= Date.parse(at)) {
                await db
                  .from('user_mistakes')
                  .upsert({ user_id: userId, lang, question_id: op.question_id, updated_at: at }, { onConflict: 'user_id,lang,question_id' })
              }
            }
          } else if (op.type === 'save') {
            if (!SAVED_KINDS.has(op.kind) || typeof op.key !== 'string' || op.key.length === 0 || op.key.length > 100) continue
            if (op.saved) {
              await db
                .from('user_saved')
                .upsert({ user_id: userId, kind: op.kind, item_key: op.key, created_at: at }, { onConflict: 'user_id,kind,item_key', ignoreDuplicates: true })
            } else {
              await db.from('user_saved').delete().eq('user_id', userId).eq('kind', op.kind).eq('item_key', op.key)
            }
          }
        }
        return json({ data: { ok: true, applied: ops.length } })
      }

      default:
        return json({ error: 'invalid_action' }, 400)
    }
  } catch (error) {
    console.error('study-sync error:', error)
    return json({ error: 'internal_error' }, 500)
  }
})

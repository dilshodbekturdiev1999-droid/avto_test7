// Reads the question bank baked into the app at build time (see
// scripts/bundle-offline-data.mjs) and shapes it exactly like get-data's
// responses, so nothing downstream (QuestionView, TestPage, ...) needs to
// know whether a given screen loaded from the bundle or from the network.
//
// Video is intentionally not here -- it stays on YouTube and needs a live
// connection, same as on the website.
import type { Lesson, Topic, QuestionWithAnswers, TrafficSign } from '@/types/database';
import type { TestLang } from './testLang';

interface RawLesson { id: string; title: string; title_ru: string | null; order_index: number }
interface RawTopic {
  id: string; lesson_id: string; title_uz_cyr: string; title_ru: string | null;
  order_index: number; youtube_url: string | null;
}
interface RawAnswerUz { id: string; question_id: string; answer_uz_cyr: string; is_correct: boolean }
interface RawAnswerRu { id: string; question_id: string; answer_ru: string; is_correct: boolean }
interface RawQuestionUz {
  id: string; topic_id: string; question_uz_cyr: string; image_path: string | null;
  order_index: number; answers: RawAnswerUz[];
}
interface RawQuestionRu {
  id: string; topic_id: string; question_ru: string; image_path: string | null;
  order_index: number; answers: RawAnswerRu[];
}
interface RawSign {
  id: string; number: string; category: string; title: string; title_ru: string | null;
  description: string; description_ru: string | null; image_path: string | null; order_index: number;
}

export type QuestionWithImage = QuestionWithAnswers & { image_url: string | null };

// import.meta.env.BASE_URL is '/' inside the native app (assets ship at the
// bundle root) and e.g. '/prava-on-app-preview/' for the browser preview --
// see vite.config.ts. Either way this resolves relative to it, same as
// every other bundled asset.
const BASE = import.meta.env.BASE_URL ?? '/';

async function loadJSON<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}offline/data/${name}`);
  if (!res.ok) throw new Error(`offline bundle missing ${name} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

let lessonsPromise: Promise<RawLesson[]> | null = null;
let topicsPromise: Promise<RawTopic[]> | null = null;
let questionsUzPromise: Promise<Record<string, RawQuestionUz[]>> | null = null;
let questionsRuPromise: Promise<Record<string, RawQuestionRu[]>> | null = null;
let signsPromise: Promise<RawSign[]> | null = null;

function rawLessons() { return (lessonsPromise ??= loadJSON<RawLesson[]>('lessons.json')); }
function rawTopics() { return (topicsPromise ??= loadJSON<RawTopic[]>('topics.json')); }
function rawQuestionsUz() { return (questionsUzPromise ??= loadJSON<Record<string, RawQuestionUz[]>>('questions_uz.json')); }
function rawQuestionsRu() { return (questionsRuPromise ??= loadJSON<Record<string, RawQuestionRu[]>>('questions_ru.json')); }
function rawSigns() { return (signsPromise ??= loadJSON<RawSign[]>('traffic_signs.json')); }

// The website ships the question JSON but not the ~58 MB of pictures; it sets
// VITE_IMAGES_FROM_STORAGE=1 and reads them from the public storage buckets.
const IMAGES_FROM_STORAGE = import.meta.env.VITE_IMAGES_FROM_STORAGE === '1';
const STORAGE_BUCKET = { uz: 'question-images', ru: 'question-images-ru', signs: 'foydali%20malumotlar' } as const;

export function localImageUrl(kind: 'uz' | 'ru' | 'signs', imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (IMAGES_FROM_STORAGE) {
    const base = import.meta.env.VITE_SUPABASE_URL ?? 'https://vywzulllyxlhynxgmpqc.supabase.co';
    return `${base}/storage/v1/object/public/${STORAGE_BUCKET[kind]}/${imagePath}`;
  }
  return `${BASE}offline/images/${kind}/${imagePath}`;
}

export async function getBundledLessons(lang: TestLang): Promise<Lesson[]> {
  const rows = await rawLessons();
  return rows.map((l) => ({
    id: l.id,
    order_index: l.order_index,
    title: lang === 'ru' && l.title_ru ? l.title_ru : l.title,
  }));
}

// Mirrors get-data's rule: an RU student never sees a topic that has no RU
// translation yet (rather than a confusing Uzbek title in an RU list).
export async function getBundledAllTopics(lang: TestLang): Promise<Topic[]> {
  const rows = await rawTopics();
  const filtered = lang === 'ru' ? rows.filter((t) => t.title_ru) : rows;
  return filtered.map((t) => ({
    id: t.id,
    lesson_id: t.lesson_id,
    order_index: t.order_index,
    youtube_url: t.youtube_url,
    title_uz_cyr: lang === 'ru' ? (t.title_ru as string) : t.title_uz_cyr,
  }));
}

export async function getBundledTopicsForLesson(lessonId: string, lang: TestLang): Promise<Topic[]> {
  const all = await getBundledAllTopics(lang);
  return all.filter((t) => t.lesson_id === lessonId);
}

export async function getBundledTopic(topicId: string, lang: TestLang): Promise<Topic | null> {
  const all = await getBundledAllTopics(lang);
  return all.find((t) => t.id === topicId) ?? null;
}

// Same fallback rule as get-data: if a topic has no RU questions yet, an RU
// student still gets the Uzbek set rather than an empty/broken-looking topic.
export async function getBundledQuestionsWithAnswers(topicId: string, lang: TestLang): Promise<QuestionWithImage[]> {
  if (lang === 'ru') {
    const ru = await rawQuestionsRu();
    const rows = ru[topicId];
    if (rows && rows.length > 0) {
      return rows.map((q) => ({
        id: q.id,
        topic_id: q.topic_id,
        order_index: q.order_index,
        image_path: q.image_path,
        question_uz_cyr: q.question_ru,
        image_url: localImageUrl('ru', q.image_path),
        answers: q.answers.map((a) => ({ id: a.id, question_id: a.question_id, is_correct: a.is_correct, answer_uz_cyr: a.answer_ru })),
      }));
    }
    // no RU content for this topic yet -- fall through to the Uzbek set below
  }
  const uz = await rawQuestionsUz();
  const rows = uz[topicId] ?? [];
  return rows.map((q) => ({
    id: q.id,
    topic_id: q.topic_id,
    order_index: q.order_index,
    image_path: q.image_path,
    question_uz_cyr: q.question_uz_cyr,
    image_url: localImageUrl('uz', q.image_path),
    answers: q.answers,
  }));
}

export async function getBundledTrafficSigns(lang: TestLang): Promise<TrafficSign[]> {
  const rows = await rawSigns();
  return rows.map((s) => ({
    id: s.id,
    number: s.number,
    category: s.category,
    image_path: s.image_path,
    title: lang === 'ru' && s.title_ru ? s.title_ru : s.title,
    description: lang === 'ru' && s.description_ru ? s.description_ru : s.description,
    image_url: localImageUrl('signs', s.image_path),
  }));
}

// ---- Whole-bank index (mistakes, saved, search, the "1200+" mode) ----------
// Everything below reads only the bundle, so these features cost the server
// nothing. UZ and RU are separate tables with different ids, so every entry
// remembers which bank it came from.
export interface IndexedQuestion {
  bank: 'uz' | 'ru';
  question: QuestionWithImage;
  topicId: string;
  topicTitle: string;
  lessonId: string;
  lessonTitle: string;
  /** 1-based place of the question inside its topic, and the topic's size. */
  position: number;
  topicCount: number;
}

interface BankIndex {
  uz: IndexedQuestion[]; // every UZ question, in lesson/topic/question order
  ru: IndexedQuestion[];
  topicOrder: string[];
  uzByTopic: Map<string, IndexedQuestion[]>;
  ruByTopic: Map<string, IndexedQuestion[]>;
  byId: Map<string, IndexedQuestion>;
  /** lesson ids in order, for the trial gate */
  lessonOrder: string[];
}

let bankIndexPromise: Promise<BankIndex> | null = null;

function bankIndex(): Promise<BankIndex> {
  return (bankIndexPromise ??= (async () => {
    const [lessons, topics, uz, ru] = await Promise.all([rawLessons(), rawTopics(), rawQuestionsUz(), rawQuestionsRu()]);
    const lessonList = [...lessons].sort((a, b) => a.order_index - b.order_index);
    const lessonById = new Map(lessonList.map((l) => [l.id, l]));
    const orderedTopics = [...topics]
      .filter((t) => lessonById.has(t.lesson_id))
      .sort(
        (a, b) =>
          (lessonById.get(a.lesson_id)!.order_index - lessonById.get(b.lesson_id)!.order_index) ||
          a.order_index - b.order_index,
      );

    const out: BankIndex = {
      uz: [], ru: [], topicOrder: orderedTopics.map((t) => t.id),
      uzByTopic: new Map(), ruByTopic: new Map(), byId: new Map(),
      lessonOrder: lessonList.map((l) => l.id),
    };
    for (const t of orderedTopics) {
      const lesson = lessonById.get(t.lesson_id)!;
      const uzRows = uz[t.id] ?? [];
      const uzEntries = uzRows.map((q, i): IndexedQuestion => ({
        bank: 'uz',
        question: {
          id: q.id, topic_id: q.topic_id, order_index: q.order_index, image_path: q.image_path,
          question_uz_cyr: q.question_uz_cyr, image_url: localImageUrl('uz', q.image_path), answers: q.answers,
        },
        topicId: t.id, topicTitle: t.title_uz_cyr, lessonId: lesson.id, lessonTitle: lesson.title,
        position: i + 1, topicCount: uzRows.length,
      }));
      const ruRows = ru[t.id] ?? [];
      const ruEntries = ruRows.map((q, i): IndexedQuestion => ({
        bank: 'ru',
        question: {
          id: q.id, topic_id: q.topic_id, order_index: q.order_index, image_path: q.image_path,
          question_uz_cyr: q.question_ru, image_url: localImageUrl('ru', q.image_path),
          answers: q.answers.map((a) => ({ id: a.id, question_id: a.question_id, is_correct: a.is_correct, answer_uz_cyr: a.answer_ru })),
        },
        topicId: t.id, topicTitle: t.title_ru ?? t.title_uz_cyr, lessonId: lesson.id,
        lessonTitle: lesson.title_ru ?? lesson.title, position: i + 1, topicCount: ruRows.length,
      }));
      out.uzByTopic.set(t.id, uzEntries);
      out.ruByTopic.set(t.id, ruEntries);
      out.uz.push(...uzEntries);
      out.ru.push(...ruEntries);
      for (const e of [...uzEntries, ...ruEntries]) out.byId.set(e.question.id, e);
    }
    return out;
  })());
}

/** One question (either bank) by id, with its lesson/topic/position. */
export async function getBundledQuestionById(id: string): Promise<IndexedQuestion | null> {
  return (await bankIndex()).byId.get(id) ?? null;
}

/**
 * The whole bank for a language, in lesson -> topic -> question order. A topic
 * with no RU questions falls back to its UZ questions, same rule as
 * getBundledQuestionsWithAnswers.
 */
export async function getBundledAllQuestions(lang: TestLang): Promise<IndexedQuestion[]> {
  const idx = await bankIndex();
  if (lang === 'uz') return idx.uz;
  return idx.topicOrder.flatMap((topicId) => {
    const ruRows = idx.ruByTopic.get(topicId) ?? [];
    return ruRows.length > 0 ? ruRows : idx.uzByTopic.get(topicId) ?? [];
  });
}

/** Lessons a trial (unpaid) student may use: only the first one. */
export async function trialAllowedLessonIds(): Promise<Set<string>> {
  const idx = await bankIndex();
  return new Set(idx.lessonOrder.slice(0, 1));
}

// ---- Trial gating -----------------------------------------------------
// Trial (registered, unpaid) students may only reach the first lesson --
// this is enforced server-side today (get-data denies anything else), but
// that enforcement doesn't run at all when the data comes straight from the
// bundle, so it has to be re-checked here too. Mirrors trialAllowedLessonIds
// in supabase/functions/get-data/index.ts exactly (first lesson by
// order_index).
export async function isTrialAllowedLesson(lessonId: string): Promise<boolean> {
  const lessons = await rawLessons();
  if (lessons.length === 0) return false;
  const first = [...lessons].sort((a, b) => a.order_index - b.order_index)[0];
  return first.id === lessonId;
}

export async function isTrialAllowedTopic(topicId: string): Promise<boolean> {
  const topics = await rawTopics();
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return false;
  return isTrialAllowedLesson(topic.lesson_id);
}

export async function getOfflineManifestVersion(): Promise<string | null> {
  try {
    const m = await loadJSON<{ version: string }>('manifest.json');
    return m.version;
  } catch {
    return null;
  }
}

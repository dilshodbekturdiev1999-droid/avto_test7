// Celebrations: which moment plays which scene, the words in each language, and the
// small "already shown" memory so a once-only scene does not repeat.
import { safeStorage } from '@/lib/safeStorage';

export type CelebrationKind = 'passed' | 'failed' | 'final' | 'q200' | 'q1200' | 'examday' | 'alllessons';

export interface CelebrationRequest {
  kind: CelebrationKind;
  value: number;
}

const EVENT = 'pravaon:celebrate';

/** Owner turned the 3D celebrations off for now (2026-11-17). The scenes stay in the repo. */
export const CELEBRATIONS_ENABLED = false;

/** Ask the app to play a celebration over the current screen. */
export function celebrate(kind: CelebrationKind, value = 0): void {
  // People who asked the system for less motion get the result screen without it.
  if (!CELEBRATIONS_ENABLED || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  window.dispatchEvent(new CustomEvent<CelebrationRequest>(EVENT, { detail: { kind, value: Math.round(value) } }));
}

export function onCelebrate(handler: (r: CelebrationRequest) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<CelebrationRequest>).detail);
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

// ---- words on screen (DOM text) and inside the 3D picture (canvas text)
type Words = { dom: Record<string, string>; canvas: Record<string, string> };
const TEXT: Record<CelebrationKind, { uz: Words; ru: Words }> = {
  passed: {
    uz: { dom: { title: 'Табриклаймиз!', sub: 'Мавзу топширилди. Кейинги мавзу очилди' }, canvas: {} },
    ru: { dom: { title: 'Поздравляем!', sub: 'Тема пройдена. Следующая тема открыта' }, canvas: {} },
  },
  failed: {
    uz: { dom: { title: 'Қайта уриниб кўринг', sub: 'Ўтиш учун 95% тўплаш керак', lbl: '95%' }, canvas: {} },
    ru: { dom: { title: 'Попробуйте ещё раз', sub: 'Для прохождения нужно 95%', lbl: '95%' }, canvas: {} },
  },
  final: {
    uz: {
      dom: { title: 'Якуний тест топширилди', sub: 'Сиз имтиҳонга тайёрсиз' },
      canvas: { paper: 'ЯКУНИЙ ТЕСТ', paperSub: 'Prava On · Имтиҳон симуляцияси', stamp: 'ЎТДИНГИЗ', ring: 'PRAVA ON · ЯКУНИЙ ТЕСТ · ' },
    },
    ru: {
      dom: { title: 'Итоговый тест сдан', sub: 'Вы готовы к экзамену' },
      canvas: { paper: 'ИТОГОВЫЙ ТЕСТ', paperSub: 'Prava On · Симуляция экзамена', stamp: 'СДАНО', ring: 'PRAVA ON · ИТОГОВЫЙ ТЕСТ · ' },
    },
  },
  q200: {
    uz: { dom: { title: '200 та савол!', sub: 'Марафон тугади. Сизни тўхтатиб бўлмайди', lbl: 'савол ечилди' }, canvas: {} },
    ru: { dom: { title: '200 вопросов!', sub: 'Марафон пройден. Вас не остановить', lbl: 'вопросов решено' }, canvas: {} },
  },
  q1200: {
    uz: { dom: { title: 'Барча саволлар ечилди', sub: '1200 дан ортиқ савол ортда қолди' }, canvas: {} },
    ru: { dom: { title: 'Все вопросы решены', sub: 'Позади больше тысячи вопросов' }, canvas: {} },
  },
  examday: {
    uz: { dom: { title: 'Омад!', sub: 'Бугун имтиҳон куни. Сиз тайёрсиз' }, canvas: {} },
    ru: { dom: { title: 'Удачи!', sub: 'Сегодня экзамен. Вы готовы' }, canvas: {} },
  },
  alllessons: {
    uz: { dom: { title: 'Барча дарслар тугади', sub: 'Сиз чемпионсиз' }, canvas: {} },
    ru: { dom: { title: 'Все уроки пройдены', sub: 'Вы чемпион' }, canvas: {} },
  },
};

export function sceneText(kind: CelebrationKind, lang: 'uz' | 'ru'): Words {
  return TEXT[kind][lang];
}

// ---- once-only scenes
const ALL_DONE_KEY = 'celebrated_all_lessons';
const EXAM_DATE_KEY = 'exam_date';
const EXAM_SHOWN_KEY = 'exam_day_shown';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** All lessons reached 100%: play once per device. */
export function celebrateAllLessonsOnce(): void {
  if (safeStorage.getItem(ALL_DONE_KEY)) return;
  safeStorage.setItem(ALL_DONE_KEY, '1');
  celebrate('alllessons', 100);
}

export function getExamDate(): string {
  return safeStorage.getItem(EXAM_DATE_KEY) ?? '';
}

export function setExamDate(date: string): void {
  if (date) safeStorage.setItem(EXAM_DATE_KEY, date);
  else safeStorage.removeItem(EXAM_DATE_KEY);
}

/** On the exam day, the first time the app is opened: wish good luck. */
export function celebrateExamDayIfDue(): void {
  const d = getExamDate();
  if (!d || d !== today() || safeStorage.getItem(EXAM_SHOWN_KEY) === d) return;
  safeStorage.setItem(EXAM_SHOWN_KEY, d);
  celebrate('examday');
}

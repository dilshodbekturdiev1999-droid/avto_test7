import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { LessonTopics } from '@/components/site/LessonTopics';
import { SIcon } from '@/components/ui/SIcon';
import { TariffCheckoutDialog } from '@/components/TariffCheckoutDialog';
import { useLessons, useAllTopics } from '@/hooks/useSupabase';
import { getActiveTopic, getLessonProgress, getTopicProgress, isLessonUnlocked, useProgressVersion } from '@/lib/progress';
import { useAccessInfo, useFullAccess } from '@/hooks/useAuth';
import { useT } from '@/hooks/useT';

// «Дарслар»: desktop — lessons on the left, the chosen lesson's topics on the right;
// phone — the lesson list, a tap opens the lesson page.
const LessonsPage = () => {
  const navigate = useNavigate();
  const t = useT();
  useProgressVersion();
  const { data: lessons, isLoading } = useLessons();
  const { data: allTopics } = useAllTopics();
  const fullAccess = useFullAccess();
  const { trialExpiresAt } = useAccessInfo();
  const trialExpired = !fullAccess && !!trialExpiresAt && new Date(trialExpiresAt).getTime() < Date.now();
  const [picked, setPicked] = useState<string | null>(null);
  const isDesk = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

  const topics = allTopics ?? [];
  const list = lessons ?? [];
  const activeLesson = topics.find((tp) => tp.id === getActiveTopic())?.lesson_id;
  const firstOpen = list.find((l) => getLessonProgress(l.id, topics).completed < topics.filter((tp) => tp.lesson_id === l.id).length)?.id;
  // Only lessons the student may open can be shown on the right (trial = lesson 1 only).
  const openIds = new Set(list.filter((l, i) => (fullAccess || (i === 0 && !trialExpired)) && isLessonUnlocked(l.id, topics, list)).map((l) => l.id));
  const pick = (id: string | null | undefined) => (id && openIds.has(id) ? id : null);
  const selected = pick(picked) ?? pick(activeLesson) ?? pick(firstOpen) ?? list.find((l) => openIds.has(l.id))?.id ?? null;
  const done = topics.filter((tp) => getTopicProgress(tp.id)?.completed).length;
  const lessonsDone = list.filter((l) => { const n = topics.filter((tp) => tp.lesson_id === l.id).length; return n > 0 && getLessonProgress(l.id, topics).completed === n; }).length;
  const sel = list.find((l) => l.id === selected);
  const selIndex = list.findIndex((l) => l.id === selected);
  const selTopics = topics.filter((tp) => tp.lesson_id === selected);
  const selDone = selected ? getLessonProgress(selected, topics).completed : 0;

  return (
    <SiteShell tab="lessons" title={t('Дарслар', 'Уроки')}>
      <div className="lg:hidden text-[14.5px] -mt-1 mb-3.5 sa-num" style={{ color: 'var(--sa-muted)' }}>
        {done} / {topics.length} {t('мавзу', 'тем')} · {lessonsDone} {t('дарс тугади', 'уроков завершено')}
      </div>
      {isLoading ? (
        <p className="py-16 text-center animate-pulse" style={{ color: 'var(--sa-muted)' }}>{t('Юкланмоқда...', 'Загрузка...')}</p>
      ) : (
        <div className="lg:grid lg:grid-cols-[420px_1fr] lg:gap-7 lg:items-start">
          <div className="sa-group">
            {list.map((l, i) => {
              const n = topics.filter((tp) => tp.lesson_id === l.id).length;
              const d = getLessonProgress(l.id, topics).completed;
              const unlocked = (fullAccess || (i === 0 && !trialExpired)) && isLessonUnlocked(l.id, topics, list);
              const cur = d > 0 && d < n;
              const isDone = n > 0 && d === n;
              const on = isDesk && l.id === selected;
              return (
                <div key={l.id} role="button" tabIndex={0} className="sa-li noic cursor-pointer" style={{ minHeight: 70, background: on ? 'var(--sa-blue-soft)' : undefined, opacity: unlocked ? 1 : 0.6 }}
                  onClick={() => { if (!unlocked) return; if (isDesk) setPicked(l.id); else navigate(`/lesson/${l.id}`); }}>
                  <span className="sa-disp sa-num w-10 h-10 rounded-xl flex items-center justify-center font-semibold shrink-0"
                    style={{ background: cur ? 'var(--sa-blue)' : 'var(--sa-sub)', color: cur ? '#fff' : 'var(--sa-text)' }}>{i + 1}</span>
                  <div className="tx">
                    <b style={{ fontWeight: 600 }}>{i + 1}-{t('дарс', 'урок')}</b>
                    <small className="truncate">{topics.filter((tp) => tp.lesson_id === l.id).sort((a, b) => a.order_index - b.order_index).map((tp) => tp.title_uz_cyr).join(', ')}</small>
                    {cur && <div className="sa-bar" style={{ height: 4, marginTop: 8 }}><i style={{ width: `${(d / n) * 100}%` }} /></div>}
                    {!unlocked && (
                      <TariffCheckoutDialog trigger={<button type="button" onClick={(e) => e.stopPropagation()} className="text-[13px] font-semibold mt-0.5" style={{ color: 'var(--sa-blue)' }}>{t('Тўлиқ доступ учун тўлаш →', 'Оплатить полный доступ →')}</button>} />
                    )}
                  </div>
                  {isDone ? (
                    <span className="flex text-[22px]" style={{ color: 'var(--sa-ok)' }}><SIcon name="check-circle" variant="duo" /></span>
                  ) : (
                    <span className="sa-num text-sm" style={{ color: 'var(--sa-muted)' }}>{d} / {n}</span>
                  )}
                </div>
              );
            })}
          </div>

          {sel && (
            <div className="hidden lg:block">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="sa-disp text-xl font-bold">{selIndex + 1}-{t('дарс', 'урок')}</div>
                  <div className="text-sm" style={{ color: 'var(--sa-muted)' }}>{selTopics.length} {t('мавзу', 'тем')} · {selDone} {t('тасини ўтдингиз', 'пройдено')}</div>
                </div>
              </div>
              <LessonTopics lessonId={sel.id} allTopics={topics} allLessons={list} />
            </div>
          )}
        </div>
      )}
    </SiteShell>
  );
};

export default LessonsPage;

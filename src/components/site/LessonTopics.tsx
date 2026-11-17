import { useNavigate } from 'react-router-dom';
import { SIcon } from '@/components/ui/SIcon';
import { getTopicProgress, isTopicUnlocked } from '@/lib/progress';
import { useHasVideoAccess } from '@/hooks/useAuth';
import { useT } from '@/hooks/useT';
import { YAKUNIY_TOPIC_ID } from '@/features/nav/routes';
import type { Lesson, Topic } from '@/types/database';

/** The topics of one lesson as a grouped list (status icon, best score, bar while in progress). */
export function LessonTopics({ lessonId, allTopics, allLessons }: { lessonId: string; allTopics: Topic[]; allLessons: Lesson[] }) {
  const navigate = useNavigate();
  const hasVideoAccess = useHasVideoAccess();
  const t = useT();
  const topics = allTopics.filter((tp) => tp.lesson_id === lessonId).sort((a, b) => a.order_index - b.order_index);

  const open = (id: string) => {
    if (id === YAKUNIY_TOPIC_ID) navigate(`/test/yakuniy/${id}`);
    else if (hasVideoAccess) navigate(`/topic/${id}/video`);
    // Standard/Pro tariffs are tests-only: straight to the test.
    else navigate(`/test/${id}`);
  };

  if (topics.length === 0) return <p className="py-8 text-center" style={{ color: 'var(--sa-muted)' }}>{t('Мавзулар топилмади', 'Темы не найдены')}</p>;
  return (
    <div className="sa-group">
      {topics.map((tp) => {
        const p = getTopicProgress(tp.id);
        const score = p?.bestScore ?? 0;
        const unlocked = isTopicUnlocked(tp.id, allTopics, allLessons);
        const inProgress = !p?.completed && score > 0;
        return (
          <button key={tp.id} type="button" className="sa-li" style={{ minHeight: 66, opacity: unlocked ? 1 : 0.55 }} disabled={!unlocked} onClick={() => open(tp.id)}>
            {p?.completed ? (
              <span className="flex text-2xl" style={{ color: 'var(--sa-ok)' }}><SIcon name="check-circle" variant="duo" /></span>
            ) : !unlocked ? (
              <SIcon name="close-circle" variant="line" />
            ) : (
              <SIcon name="play-circle" variant={inProgress ? 'duo' : 'line'} />
            )}
            <div className="tx">
              <b style={{ lineHeight: 1.3 }}>{tp.title_uz_cyr}</b>
              <small className="sa-num">{score > 0 ? `${score}%` : unlocked ? t('Бошлаш', 'Начать') : t('Ёпиқ', 'Закрыто')}</small>
              {inProgress && <div className="sa-bar" style={{ height: 4, marginTop: 7 }}><i style={{ width: `${score}%` }} /></div>}
            </div>
            <SIcon name="alt-arrow-right" variant="line" className="chev" />
          </button>
        );
      })}
    </div>
  );
}

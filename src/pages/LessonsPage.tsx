import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/PageShell';
import { LessonCard } from '@/components/LessonCard';
import { useLessons, useAllTopics } from '@/hooks/useSupabase';
import { isLessonUnlocked, getLessonProgress, useProgressVersion } from '@/lib/progress';
import { useAccessInfo, useFullAccess } from '@/hooks/useAuth';
import { useT } from '@/hooks/useT';
import { Topic, Lesson } from '@/types/database';

const LessonsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useProgressVersion();
  const { data: lessons, isLoading, isError } = useLessons();
  const { data: allTopics } = useAllTopics();
  const t = useT();

  // Trial users (not in allowed_phones) only get lesson 1 + the Yakuniy test;
  // paid/full users get everything. useFullAccess (not a raw storage read) so
  // the list updates the moment a background session check upgrades the user.
  const fullAccess = useFullAccess();
  const { trialExpiresAt } = useAccessInfo();
  const trialExpired = !fullAccess && !!trialExpiresAt && new Date(trialExpiresAt).getTime() < Date.now();

  return (
    <PageShell title={t('Дарслар', 'Уроки')} tab>
      {isLoading ? (
        <div className="py-16 text-center animate-pulse text-muted-foreground">{t('Юкланмоқда...', 'Загрузка...')}</div>
      ) : isError ? (
        // A failed request must not read as "this account has no content".
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground max-w-sm">
            {t(
              'Маълумотларни юклаб бўлмади. Интернет алоқасини текшириб, қайта уриниб кўринг.',
              'Не удалось загрузить данные. Проверьте интернет и попробуйте ещё раз.'
            )}
          </p>
          <Button onClick={() => queryClient.refetchQueries()} className="btn-3d h-11 px-6">
            {t('Қайта уриниш', 'Повторить')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons?.map((lesson, index) => (
            <LessonCardWithProgress
              key={lesson.id}
              lessonId={lesson.id}
              title={lesson.title}
              index={index}
              fullAccess={fullAccess}
              trialExpired={trialExpired}
              allTopics={allTopics || []}
              allLessons={lessons || []}
              onClick={() => navigate(`/lesson/${lesson.id}`)}
            />
          ))}
          {(!lessons || lessons.length === 0) && (
            <p className="text-center py-12 text-muted-foreground">{t('Дарслар топилмади', 'Уроки не найдены')}</p>
          )}
        </div>
      )}
    </PageShell>
  );
};

function LessonCardWithProgress({
  lessonId,
  title,
  index,
  fullAccess,
  trialExpired,
  allTopics,
  allLessons,
  onClick,
}: {
  lessonId: string;
  title: string;
  index: number;
  fullAccess: boolean;
  trialExpired: boolean;
  allTopics: Topic[];
  allLessons: Lesson[];
  onClick: () => void;
}) {
  // One all-topics list instead of a server call per lesson card.
  const topicCount = allTopics.filter((tp) => tp.lesson_id === lessonId).length;
  // Trial gate: only lesson 1 (index 0) is open to everyone, and only while the
  // trial window hasn't run out; everything else needs full (paid) access.
  const isUnlocked = (fullAccess || (index === 0 && !trialExpired)) && isLessonUnlocked(lessonId, allTopics, allLessons);
  const lessonProgress = getLessonProgress(lessonId, allTopics);

  return (
    <LessonCard
      title={title}
      topicCount={topicCount}
      completedCount={lessonProgress.completed}
      index={index}
      isUnlocked={isUnlocked}
      onClick={onClick}
    />
  );
}

export default LessonsPage;

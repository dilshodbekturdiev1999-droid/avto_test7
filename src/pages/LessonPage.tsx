import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLesson, useTopics, useQuestions, useLessons, useAllTopics } from '@/hooks/useSupabase';
import { TopicCard } from '@/components/TopicCard';
import { PageShell } from '@/components/PageShell';
import { LessonTopics } from '@/components/site/LessonTopics';
import { isTopicUnlocked, useProgressVersion } from '@/lib/progress';
import { Button } from '@/components/ui/button';
import { Topic, Lesson } from '@/types/database';
import { useHasVideoAccess } from '@/hooks/useAuth';
import { useT } from '@/hooks/useT';

const LessonPage = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  useProgressVersion();
  const hasVideoAccess = useHasVideoAccess();
  const t = useT();

  const queryClient = useQueryClient();
  const { data: lesson, isLoading: lessonLoading, isError: lessonError } = useLesson(lessonId);
  const { data: topics, isLoading: topicsLoading, isError: topicsError } = useTopics(lessonId);
  const { data: allLessons } = useLessons();
  const { data: allTopics } = useAllTopics();

  if (lessonLoading || topicsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('Юкланмоқда...', 'Загрузка...')}</div>
      </div>
    );
  }

  // Same as the dashboard: a dropped connection must not masquerade as
  // "this lesson has no topics".
  if (lessonError || topicsError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground max-w-sm">
          {t(
            'Маълумотларни юклаб бўлмади. Интернет алоқасини текшириб, қайта уриниб кўринг.',
            'Не удалось загрузить данные. Проверьте интернет и попробуйте ещё раз.'
          )}
        </p>
        <Button onClick={() => queryClient.refetchQueries()} className="rounded-full font-bold">
          {t('Қайта уриниш', 'Повторить')}
        </Button>
      </div>
    );
  }

  return (
    <PageShell title={lesson ? `${lesson.order_index}-${t('дарс', 'урок')}` : t('Дарс', 'Урок')} onBack={() => navigate('/lessons')} active="lessons">
      <p className="-mt-1 mb-3.5 text-[14.5px]" style={{ color: 'var(--sa-muted)' }}>
        {t('Тестни бошлаш учун мавзуни танланг', 'Выберите тему, чтобы начать тест')}
      </p>
      <LessonTopics lessonId={lessonId ?? ''} allTopics={allTopics ?? topics ?? []} allLessons={allLessons ?? []} />
    </PageShell>
  );
};

function TopicCardWithQuestionCount({
  topicId,
  title,
  index,
  allTopics,
  allLessons,
  onClick,
}: {
  topicId: string;
  title: string;
  index: number;
  allTopics: Topic[];
  allLessons: Lesson[];
  onClick: () => void;
}) {
  const { data: questions, isLoading: questionsLoading } = useQuestions(topicId);
  const isUnlocked = isTopicUnlocked(topicId, allTopics, allLessons);

  return (
    <TopicCard
      title={title}
      questionCount={questions?.length ?? 0}
      questionCountLoading={questionsLoading}
      topicId={topicId}
      index={index}
      isUnlocked={isUnlocked}
      onClick={onClick}
    />
  );
}

export default LessonPage;

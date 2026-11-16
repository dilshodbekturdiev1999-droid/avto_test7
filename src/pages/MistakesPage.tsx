import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardX, Play } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { TestShell } from '@/components/TestShell';
import { QuestionView } from '@/components/QuestionView';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/useT';
import { isAnswerCorrect } from '@/lib/utils';
import type { IndexedQuestion } from '@/lib/offlineContent';
import { getMistakeIds, recordAnswer, useStudyVersion } from '@/features/study/studyState';
import { QuestionPreview } from '@/features/study/QuestionPreview';
import { SaveButton } from '@/features/study/SaveButton';
import { useQuestionEntries } from '@/features/study/useQuestionEntries';

/**
 * "Mening Xatolarim". The list is the questions whose last answer was wrong; a
 * question leaves it only by being answered correctly in the practice below (or
 * in any test). There is deliberately no delete button.
 */
const MistakesPage = () => {
  const navigate = useNavigate();
  const t = useT();
  useStudyVersion();
  const { entries, loading } = useQuestionEntries(getMistakeIds());
  const [practice, setPractice] = useState<IndexedQuestion[] | null>(null);

  if (practice) {
    return <MistakesPractice queue={practice} onExit={() => setPractice(null)} />;
  }

  return (
    <PageShell title={t('Mening Xatolarim', 'Мои ошибки')} icon={<ClipboardX className="h-5 w-5" />}>
      {loading ? (
        <p className="py-10 text-center text-muted-foreground">{t('Юкланмоқда...', 'Загрузка...')}</p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
          <h2 className="mb-1 text-lg font-bold text-foreground">{t('Ҳозирча хато йўқ', 'Пока ошибок нет')}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'Тест ечаётганда нотўғри жавоб берган саволларингиз шу ерга тушади.',
              'Вопросы, на которые вы ответили неверно, попадают сюда.',
            )}
          </p>
          <Button className="mt-5" onClick={() => navigate('/lessons')}>
            {t('Дарсларга ўтиш', 'К урокам')}
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="text-2xl font-bold text-foreground">{entries.length}</p>
              <p className="text-sm text-muted-foreground">{t('та савол устида ишлаш керак', 'вопросов нужно проработать')}</p>
            </div>
            <Button onClick={() => setPractice(entries)}>
              <Play className="mr-2 h-4 w-4" />
              {t('Ечишни бошлаш', 'Начать решать')}
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {t(
              'Савол тўғри жавоб берилганда рўйхатдан чиқади. Қўлда ўчириб бўлмайди.',
              'Вопрос уходит из списка, когда вы ответите на него верно. Удалить вручную нельзя.',
            )}
          </p>
          <div className="space-y-3">
            {entries.map((e) => (
              <QuestionPreview key={e.question.id} entry={e} actions={<SaveButton kind="question" itemKey={e.question.id} className="-mr-1 -mt-1" />} />
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
};

function MistakesPractice({ queue, onExit }: { queue: IndexedQuestion[]; onExit: () => void }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [fixed, setFixed] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = queue.length;
  const finished = index >= total;
  const current = queue[index];

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const next = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSelected(null);
    setIndex((i) => i + 1);
  }, []);

  const select = (answerId: string) => {
    if (!current || selected) return;
    setSelected(answerId);
    const picked = current.question.answers.find((a) => a.id === answerId);
    const correct = !!picked && isAnswerCorrect(picked.is_correct);
    recordAnswer(current.question.id, correct);
    if (correct) {
      setFixed((f) => f + 1);
      timer.current = setTimeout(next, 1200);
    }
  };

  if (finished) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border-2 border-success/50 bg-card p-8 text-center animate-scale-in">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">
            {fixed === total ? t('Аъло!', 'Отлично!') : t('Яхши уриниш', 'Хорошая попытка')}
          </h2>
          <p className="mb-6 text-muted-foreground">
            {t('Тузатилди', 'Исправлено')}: {fixed} / {total}
            {fixed < total && ` · ${t('қолганлари рўйхатда', 'остальные остались в списке')}`}
          </p>
          <Button className="w-full" onClick={onExit}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('Рўйхатга қайтиш', 'К списку')}
          </Button>
        </div>
      </div>
    );
  }

  const wrongPicked =
    selected !== null && !isAnswerCorrect(current.question.answers.find((a) => a.id === selected)?.is_correct);

  return (
    <TestShell
      header={
        <>
          <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('Орқага', 'Назад')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{t('Mening Xatolarim', 'Мои ошибки')}</span>
          <span className="shrink-0 text-sm text-muted-foreground">
            {index + 1}/{total}
          </span>
        </>
      }
      progress={{ current: index + 1, total }}
      footer={
        wrongPicked ? (
          <Button onClick={next} className="flex-1">
            {index + 1 < total ? t('Кейингиси', 'Далее') : t('Тугатиш', 'Завершить')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : undefined
      }
    >
      <QuestionView
        question={current.question}
        selectedAnswer={selected}
        onSelectAnswer={select}
        headerAction={<SaveButton kind="question" itemKey={current.question.id} className="-mr-2 -mt-1" />}
      />
    </TestShell>
  );
}

export default MistakesPage;

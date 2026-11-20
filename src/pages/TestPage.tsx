import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, RotateCcw, Wrench, CheckCircle2 } from 'lucide-react';
import { useTopic, useQuestionsWithAnswers } from '@/hooks/useSupabase';
import { QuestionView } from '@/components/QuestionView';
import { QuestionNumbers } from '@/components/QuestionNumbers';
import { TestShell } from '@/components/TestShell';
import { setTopicProgress, setActiveTopic, getTopicProgress } from '@/lib/progress';
import { recordAnswer } from '@/features/study/studyState';
import { celebrate } from '@/features/celebrate/celebrate';
import { SaveButton } from '@/features/study/SaveButton';
import { Button } from '@/components/ui/button';
import { cn, isAnswerCorrect } from '@/lib/utils';
import { useT } from '@/hooks/useT';

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const TestPage = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  
  const { data: topic } = useTopic(topicId);
  const { data: questions = [], isLoading } = useQuestionsWithAnswers(topicId);
  const t = useT();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongQuestionIds, setWrongQuestionIds] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Mistake review mode
  const [mistakeMode, setMistakeMode] = useState(false);
  const [mistakeQueue, setMistakeQueue] = useState<string[]>([]);
  const [mistakeInitialCount, setMistakeInitialCount] = useState(0);
  const [mistakeAnswer, setMistakeAnswer] = useState<string | null>(null);
  const [mistakeFinished, setMistakeFinished] = useState(false);

  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (topicId) {
      setActiveTopic(topicId);
    }
    startTimeRef.current = Date.now();
  }, [topicId]);

  // Clear auto-next timer on question change / unmount
  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
        autoNextTimerRef.current = null;
      }
    };
  }, [currentIndex]);

  // Preload every question's image up front, the moment the topic's
  // questions arrive -- so jumping anywhere (including via QuestionNumbers)
  // already has the image loaded or in flight, instead of only the current
  // question's image being requested.
  useEffect(() => {
    for (const question of questions) {
      const imageUrl = (question as any).image_url;
      if (imageUrl) {
        const img = new Image();
        img.src = imageUrl;
      }
    }
  }, [questions]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  // FIX: accept optional overrideAnswers to avoid stale closure on last question
  const handleNext = useCallback((overrideAnswers?: Record<string, string>) => {
    const currentAnswers = overrideAnswers ?? answers;
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      let correct = 0;
      const wrongIds: string[] = [];
      const noCorrectAnswerIds: string[] = [];
      questions.forEach(q => {
        const selectedId = currentAnswers[q.id];
        const correctAnswer = q.answers.find(a => isAnswerCorrect(a.is_correct));
        if (!correctAnswer) noCorrectAnswerIds.push(q.id);
        if (selectedId && correctAnswer && selectedId === correctAnswer.id) {
          correct++;
        } else {
          wrongIds.push(q.id);
        }
      });
      if (noCorrectAnswerIds.length > 0) {
        console.warn('[TestPage] Questions with no correct answer in DB:', noCorrectAnswerIds);
      }
      const percentage = Math.round((correct / totalQuestions) * 100);
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const previousBest = getTopicProgress(topicId!)?.bestTimeSeconds ?? null;
      setScore(percentage);
      setWrongQuestionIds(wrongIds);
      setElapsedSeconds(timeTaken);
      setTopicProgress(topicId!, percentage, correct, wrongIds.length, timeTaken, totalQuestions);
      setIsNewRecord(percentage >= 95 && (previousBest === null || timeTaken < previousBest));
      setIsFinished(true);
      celebrate(percentage >= 95 ? 'passed' : 'failed', percentage);
    }
  }, [currentIndex, totalQuestions, questions, answers, topicId]);

  const handleSelectAnswer = useCallback((answerId: string) => {
    if (!currentQuestion) return;
    // Prevent re-selecting (and re-arming timer) on already-answered question
    if (answers[currentQuestion.id]) return;
    // FIX: build newAnswers synchronously and pass to handleNext to avoid stale closure
    const newAnswers = { ...answers, [currentQuestion.id]: answerId };
    const picked = currentQuestion.answers.find((a) => a.id === answerId);
    recordAnswer(currentQuestion.id, !!picked && isAnswerCorrect(picked.is_correct));
    setAnswers(newAnswers);
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    autoNextTimerRef.current = setTimeout(() => {
      handleNext(newAnswers);
    }, 1500);
  }, [currentQuestion, answers, handleNext]);

  const handlePrevious = useCallback(() => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setAnswers({});
    setIsFinished(false);
    setScore(0);
    setWrongQuestionIds([]);
    setElapsedSeconds(null);
    setIsNewRecord(false);
    startTimeRef.current = Date.now();
  }, []);

  const handleStartMistakeMode = useCallback(() => {
    setMistakeQueue(wrongQuestionIds);
    setMistakeInitialCount(wrongQuestionIds.length);
    setMistakeAnswer(null);
    setMistakeFinished(false);
    setMistakeMode(true);
    setIsFinished(false);
  }, [wrongQuestionIds]);

  // Current mistake question
  const mistakeQuestion = useMemo(() => {
    if (!mistakeMode || mistakeQueue.length === 0) return null;
    return questions.find(q => q.id === mistakeQueue[0]) || null;
  }, [mistakeMode, mistakeQueue, questions]);

  const handleMistakeSelectAnswer = useCallback((answerId: string) => {
    if (!mistakeQuestion || mistakeAnswer) return;
    setMistakeAnswer(answerId);
    const correctAnswer = mistakeQuestion.answers.find(
      a => isAnswerCorrect(a.is_correct)
    );
    recordAnswer(mistakeQuestion.id, !!correctAnswer && answerId === correctAnswer.id);
    if (correctAnswer && answerId === correctAnswer.id) {
      // Correct → advance after short delay
      setTimeout(() => {
        setMistakeQueue(prev => {
          const next = prev.slice(1);
          if (next.length === 0) {
            // All mistakes corrected → mark topic as passed (100%)
            if (topicId) {
              setTopicProgress(topicId, 100);
            }
            setMistakeFinished(true);
          }
          return next;
        });
        setMistakeAnswer(null);
      }, 1500);
    }
  }, [mistakeQuestion, mistakeAnswer, topicId]);

  const handleMistakeRetry = useCallback(() => {
    setMistakeAnswer(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('Юкланмоқда...', 'Загрузка...')}</div>
      </div>
    );
  }

  // Mistake mode finished screen
  if (mistakeMode && mistakeFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <div className="max-w-md w-full text-center p-8 rounded-2xl border-2 bg-card border-success/50 animate-scale-in">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-success/20">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{t('Аъло!', 'Отлично!')}</h2>
          <p className="text-muted-foreground mb-8">
            {t('Барча хатолар устида ишладингиз.', 'Вы разобрали все ошибки.')}
          </p>
          <Button
            onClick={() => navigate(`/lesson/${topic?.lesson_id}`)}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('Мавзуларга қайтиш', 'Вернуться к темам')}
          </Button>
        </div>
      </div>
    );
  }

  // Mistake mode question screen
  if (mistakeMode && mistakeQuestion) {
    const remaining = mistakeQueue.length;
    const fixed = mistakeInitialCount - remaining;
    const correctAnswer = mistakeQuestion.answers.find(
      a => isAnswerCorrect(a.is_correct)
    );
    const isWrong = mistakeAnswer !== null && mistakeAnswer !== correctAnswer?.id;

    return (
      <TestShell
        header={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/lesson/${topic?.lesson_id}`)}
              aria-label={t('Орқага', 'Назад')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {t('Xatolar ustida ishlash', 'Работа над ошибками')}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {t('Қолди', 'Осталось')}: {remaining}/{mistakeInitialCount}
            </span>
          </>
        }
        progress={{ current: fixed, total: mistakeInitialCount }}
        footer={
          isWrong ? (
            <Button onClick={handleMistakeRetry} variant="outline" className="flex-1">
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('Яна уриниб кўриш', 'Попробовать снова')}
            </Button>
          ) : undefined
        }
      >
        <QuestionView
          question={mistakeQuestion}
          selectedAnswer={mistakeAnswer}
          onSelectAnswer={handleMistakeSelectAnswer}
        />
      </TestShell>
    );
  }

  if (isFinished) {
    const passed = score >= 95;
    const canReviewMistakes = wrongQuestionIds.length > 0;
    
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <div className={cn(
          "max-w-md w-full text-center p-8 rounded-2xl border-2 animate-scale-in",
          passed ? "bg-card border-success/50" : "bg-card border-destructive/50"
        )}>
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
            passed ? "bg-success/20" : "bg-destructive/20"
          )}>
            <Trophy className={cn(
              "w-10 h-10",
              passed ? "text-success" : "text-destructive"
            )} />
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {passed ? t("Табриклаймиз!", "Поздравляем!") : t("Қайта уриниб кўринг", "Попробуйте ещё раз")}
          </h2>

          <p className="text-4xl font-bold mb-2" style={{
            color: passed ? 'hsl(var(--success))' : 'hsl(var(--destructive))'
          }}>
            {score.toFixed(0)}%
          </p>

          <p className="text-muted-foreground mb-2">
            {passed
              ? t("Сиз кейинги мавзуга ўтишингиз мумкин!", "Вы можете перейти к следующей теме!")
              : t("Ўтиш учун 95% тўплашингиз керак", "Для прохождения нужно набрать 95%")}
          </p>

          {passed && elapsedSeconds !== null && (
            <p className="text-sm text-muted-foreground mb-8">
              {isNewRecord ? t('🏆 Янги рекорд! ', '🏆 Новый рекорд! ') : t('Вақт: ', 'Время: ')}
              {formatDuration(getTopicProgress(topicId!)?.bestTimeSeconds ?? elapsedSeconds)}
              {' '}({getTopicProgress(topicId!)?.bestTimeQuestionCount ?? totalQuestions} {t('та савол', 'вопросов')})
            </p>
          )}
          {!passed && <div className="mb-8" />}

          <div className="flex flex-col gap-3">
            {canReviewMistakes && (
              <Button onClick={handleStartMistakeMode} className="w-full">
                <Wrench className="w-4 h-4 mr-2" />
                {t('Xatolar ustida ishlash', 'Работа над ошибками')}
              </Button>
            )}
            {!passed && (
              <Button onClick={handleRestart} variant="outline" className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                {t('Қайта бошлаш', 'Начать заново')}
              </Button>
            )}
            <Button
              variant={passed && !canReviewMistakes ? "default" : "outline"}
              onClick={() => navigate(`/lesson/${topic?.lesson_id}`)}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('Мавзуларга қайтиш', 'Вернуться к темам')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('Саволлар топилмади', 'Вопросы не найдены')}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('Орқага', 'Назад')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TestShell
      header={
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/lesson/${topic?.lesson_id}`)}
            aria-label={t('Орқага', 'Назад')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{topic?.title_uz_cyr}</span>
          <span className="shrink-0 text-sm text-muted-foreground">
            {currentIndex + 1}/{totalQuestions}
          </span>
        </>
      }
      progress={{ current: currentIndex + 1, total: totalQuestions }}
      numbers={
        <QuestionNumbers
          questions={questions}
          currentIndex={currentIndex}
          answers={answers}
          onSelect={(i) => {
            if (autoNextTimerRef.current) {
              clearTimeout(autoNextTimerRef.current);
              autoNextTimerRef.current = null;
            }
            setCurrentIndex(i);
          }}
        />
      }
    >
      <QuestionView
        question={currentQuestion}
        selectedAnswer={answers[currentQuestion.id] ?? null}
        onSelectAnswer={handleSelectAnswer}
        headerAction={<SaveButton kind="question" itemKey={currentQuestion.id} className="-mr-2 -mt-1" />}
      />
    </TestShell>
  );
};

export default TestPage;

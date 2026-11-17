import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClipboardX, Layers, ListOrdered, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { TestShell } from '@/components/TestShell';
import { QuestionView } from '@/components/QuestionView';
import { QuestionNumbers } from '@/components/QuestionNumbers';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/useT';
import { useTestLang } from '@/hooks/useTestLang';
import { useFullAccess } from '@/hooks/useAuth';
import { cn, isAnswerCorrect } from '@/lib/utils';
import { getBundledAllQuestions, trialAllowedLessonIds, type IndexedQuestion } from '@/lib/offlineContent';
import { safeStorage } from '@/lib/safeStorage';
import type { TestLang } from '@/lib/testLang';
import { recordAnswer } from '@/features/study/studyState';
import { SaveButton } from '@/features/study/SaveButton';
import { celebrate } from '@/features/celebrate/celebrate';

/**
 * "1200+ savollar": every question of the bank in one run, either shuffled or in
 * the order of the lessons. It reads only the bundled bank, so it costs the
 * server nothing. A run is kept on the device so the student can continue it.
 */
type Mode = 'random' | 'ordered';

interface Session {
  mode: Mode;
  lang: TestLang;
  ids: string[];
  index: number;
  answers: Record<string, string>;
}

const SESSION_KEY = 'pdd_allq_session';

function loadSession(lang: TestLang): Session | null {
  try {
    const raw = safeStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.lang !== lang || !Array.isArray(s.ids) || s.ids.length === 0) return null;
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null): void {
  try {
    if (s) safeStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else safeStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage full: the run just can't be continued later */
  }
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const AllQuestionsPage = () => {
  const navigate = useNavigate();
  const t = useT();
  const [lang] = useTestLang();
  const fullAccess = useFullAccess();

  const [entries, setEntries] = useState<IndexedQuestion[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [resumable, setResumable] = useState<Session | null>(null);
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, allowed] = await Promise.all([
        getBundledAllQuestions(lang),
        fullAccess ? Promise.resolve(null) : trialAllowedLessonIds(),
      ]);
      if (cancelled) return;
      const list = allowed ? all.filter((e) => allowed.has(e.lessonId)) : all;
      setEntries(list);
      setResumable(loadSession(lang));
    })().catch(() => !cancelled && setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [lang, fullAccess]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const byId = useMemo(() => new Map((entries ?? []).map((e) => [e.question.id, e])), [entries]);

  const start = (mode: Mode) => {
    if (!entries) return;
    const ids = entries.map((e) => e.question.id);
    const next: Session = { mode, lang, ids: mode === 'random' ? shuffled(ids) : ids, index: 0, answers: {} };
    saveSession(next);
    setFinished(false);
    setSession(next);
  };

  const resume = () => {
    if (!resumable) return;
    // Keep only ids that still exist in the bank.
    const ids = resumable.ids.filter((id) => byId.has(id));
    const s = { ...resumable, ids, index: Math.min(resumable.index, Math.max(ids.length - 1, 0)) };
    setFinished(false);
    setSession(s);
  };

  const questions = useMemo(
    () => (session ? session.ids.map((id) => byId.get(id)?.question).filter((q): q is NonNullable<typeof q> => !!q) : []),
    [session, byId],
  );

  const update = useCallback((patch: Partial<Session>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSession(next);
      return next;
    });
  }, []);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const goTo = (index: number) => {
    clearTimer();
    update({ index });
  };

  const finish = (finalAnswers?: Record<string, string>) => {
    clearTimer();
    saveSession(null);
    setResumable(null);
    setFinished(true);
    // the whole bank answered: the big one
    const answers = finalAnswers ?? session?.answers ?? {};
    const answered = Object.keys(answers).length;
    if (questions.length > 0 && answered >= questions.length) {
      const right = questions.filter((q) => {
        const picked = q.answers.find((a) => a.id === answers[q.id]);
        return picked && isAnswerCorrect(picked.is_correct);
      }).length;
      celebrate('q1200', Math.round((right / answered) * 100));
    }
  };

  if (entries === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('Юкланмоқда...', 'Загрузка...')}</div>
      </div>
    );
  }

  // ---- result ----
  if (finished && session) {
    let correct = 0;
    for (const q of questions) {
      const picked = q.answers.find((a) => a.id === session.answers[q.id]);
      if (picked && isAnswerCorrect(picked.is_correct)) correct++;
    }
    const answered = Object.keys(session.answers).length;
    const wrong = answered - correct;
    const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border-2 border-border bg-card p-8 text-center animate-scale-in">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mb-1 text-2xl font-bold text-foreground">{t('Натижа', 'Результат')}</h2>
          <p className="mb-1 text-4xl font-bold text-primary">{pct}%</p>
          <p className="mb-6 text-sm text-muted-foreground">
            {t('Жавоб берилди', 'Отвечено')}: {answered} / {questions.length} · ✓ {correct} · ✗ {wrong}
          </p>
          <div className="flex flex-col gap-3">
            {wrong > 0 && (
              <Button onClick={() => navigate('/mistakes')} className="w-full">
                <ClipboardX className="mr-2 h-4 w-4" />
                Mening Xatolarim
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSession(null);
                setFinished(false);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('Яна бошлаш', 'Начать заново')}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('Бош саҳифа', 'На главную')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- start screen ----
  if (!session) {
    return (
      <PageShell title="1200+ savollar" icon={<Layers className="h-5 w-5" />}>
        <div className="mb-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-3xl font-bold text-foreground">{entries.length}</p>
          <p className="text-sm text-muted-foreground">
            {t('та савол: барча дарслар ва мавзулар', 'вопросов: все уроки и темы')}
          </p>
          {!fullAccess && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('Тўлиқ рўйхат учун тариф керак.', 'Полный список доступен по тарифу.')}
            </p>
          )}
        </div>
        {resumable && (
          <Button variant="outline" className="mb-3 h-auto w-full justify-between rounded-2xl p-4" onClick={resume}>
            <span className="text-left">
              <span className="block font-bold">{t('Давом этиш', 'Продолжить')}</span>
              <span className="block text-xs text-muted-foreground">
                {Math.min(resumable.index + 1, resumable.ids.length)} / {resumable.ids.length} ·{' '}
                {resumable.mode === 'random' ? t('аралаш', 'вперемешку') : t('тартиб билан', 'по порядку')}
              </span>
            </span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            icon={Shuffle}
            title={t('Аралаш', 'Вперемешку')}
            text={t('Саволлар тасодифий тартибда', 'Вопросы в случайном порядке')}
            onClick={() => start('random')}
          />
          <ModeCard
            icon={ListOrdered}
            title={t('Тартиб билан', 'По порядку тем')}
            text={t('Дарслар ва мавзулар бўйича, тизимдаги каби', 'По урокам и темам, как в системе')}
            onClick={() => start('ordered')}
          />
        </div>
      </PageShell>
    );
  }

  // ---- the run ----
  const current = questions[session.index];
  if (!current) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Button variant="outline" onClick={() => setSession(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('Орқага', 'Назад')}
        </Button>
      </div>
    );
  }
  const entry = byId.get(current.id)!;
  const total = questions.length;

  const select = (answerId: string) => {
    if (session.answers[current.id]) return;
    const picked = current.answers.find((a) => a.id === answerId);
    recordAnswer(current.id, !!picked && isAnswerCorrect(picked.is_correct));
    const answers = { ...session.answers, [current.id]: answerId };
    update({ answers });
    clearTimer();
    timer.current = setTimeout(() => {
      if (session.index < total - 1) update({ index: session.index + 1 });
      else finish(answers);
    }, 1500);
  };

  return (
    <TestShell
      header={
        <>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label={t('Орқага', 'Назад')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {entry.topicTitle}
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">
            {session.index + 1}/{total}
          </span>
          <Button variant="outline" size="sm" onClick={() => finish()} className={cn('shrink-0')}>
            {t('Тугатиш', 'Завершить')}
          </Button>
        </>
      }
      progress={{ current: session.index + 1, total }}
      numbers={<QuestionNumbers questions={questions} currentIndex={session.index} answers={session.answers} onSelect={goTo} />}
      footer={
        <>
          <Button variant="outline" className="flex-1" disabled={session.index === 0} onClick={() => goTo(session.index - 1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('Олдинги', 'Назад')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={session.index >= total - 1}
            onClick={() => goTo(session.index + 1)}
          >
            {t('Кейингиси', 'Далее')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      }
    >
      <p className="mb-1 truncate px-1 text-xs text-muted-foreground">
        {entry.lessonTitle} › {entry.topicTitle} › №{entry.position}
      </p>
      <QuestionView
        question={current}
        selectedAnswer={session.answers[current.id] ?? null}
        onSelectAnswer={select}
        headerAction={<SaveButton kind="question" itemKey={current.id} className="-mr-2 -mt-1" />}
      />
    </TestShell>
  );
};

function ModeCard({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof Shuffle;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="tile tile-plain flex items-center gap-4 p-4 text-left">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-extrabold leading-tight text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

export default AllQuestionsPage;

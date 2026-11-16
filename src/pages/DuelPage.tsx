import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DoorOpen, Loader2, Swords, Trophy } from 'lucide-react';
import { useDuel, useLeaveDuel, useRespondDuel, useSubmitDuelResult, sendDuelHeartbeat } from '@/hooks/useDuels';
import { QuestionView } from '@/components/QuestionView';
import { QuestionNumbers } from '@/components/QuestionNumbers';
import { TestShell } from '@/components/TestShell';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { safeStorage } from '@/lib/safeStorage';
import { useT } from '@/hooks/useT';
import { getBundledQuestionById, type IndexedQuestion } from '@/lib/offlineContent';
import type { QuestionWithAnswers } from '@/types/database';

const FEEDBACK_MS = 700;
const HEARTBEAT_MS = 5000;

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4 py-8">{children}</div>;
}

/**
 * A duel room. The server decides when the game starts (`start_at`) and how long each
 * question lasts, so both players see the same countdown and start together; this page
 * only follows the clock, offset by how far the device clock is from the server's.
 */
const DuelPage = () => {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { data: duel, isLoading, isError } = useDuel(duelId);
  const respondDuel = useRespondDuel();
  const leaveDuel = useLeaveDuel();
  const submitResult = useSubmitDuelResult();
  const myUserId = safeStorage.getItem('user_id');

  const [entries, setEntries] = useState<IndexedQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [leaveOpen, setLeaveOpen] = useState(false);
  const clockOffset = useRef(0);
  const questionStart = useRef(0);
  const restored = useRef(false);
  const submitted = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const questionIds = duel?.question_ids ?? null;
  const active = duel?.status === 'active';
  const questions: QuestionWithAnswers[] = useMemo(() => (entries ?? []).map((e) => e.question), [entries]);
  const total = questionIds?.length ?? 0;

  // How far this device's clock is from the server's, refreshed with every answer from it.
  useEffect(() => {
    if (duel?.server_now) clockOffset.current = Date.parse(duel.server_now) - Date.now();
  }, [duel?.server_now]);

  // The questions come from the bundled bank by id, so both players get the very same set
  // whatever language each one reads the app in.
  useEffect(() => {
    if (!questionIds || questionIds.length === 0) return;
    let cancelled = false;
    Promise.all(questionIds.map((id) => getBundledQuestionById(id))).then((found) => {
      if (cancelled) return;
      const list = found.filter((e): e is IndexedQuestion => !!e);
      list.forEach((e) => {
        if (e.question.image_url) new Image().src = e.question.image_url; // loads during the countdown
      });
      setEntries(list);
    });
    return () => {
      cancelled = true;
    };
  }, [questionIds]);

  // Pick up where this player was if the page was reloaded mid-game.
  useEffect(() => {
    if (!duel || restored.current) return;
    restored.current = true;
    const saved = duel.my_answers ?? {};
    if (Object.keys(saved).length > 0) {
      setAnswers(saved);
      setIndex(Object.keys(saved).length);
    }
  }, [duel]);

  // One clock for the countdown and the question timer.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);

  const serverNow = now + clockOffset.current;
  const startMs = duel?.start_at ? Date.parse(duel.start_at) : null;
  const untilStart = startMs === null ? 0 : startMs - serverNow;
  const playing = active && !!questionIds && startMs !== null && untilStart <= 0 && !duel?.my_finished;
  const questionMs = (duel?.question_time_sec ?? 20) * 1000;

  // Keep the server told that this player is here, together with his answers so far.
  useEffect(() => {
    if (!duelId || !active || duel?.my_finished) return;
    void sendDuelHeartbeat(duelId, answersRef.current);
    const id = setInterval(() => void sendDuelHeartbeat(duelId, answersRef.current), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [duelId, active, duel?.my_finished]);

  const finishAndSubmit = useCallback(
    (finalAnswers: Record<string, string>) => {
      if (!duelId || !questionIds || submitted.current) return;
      submitted.current = true;
      // Questions left unanswered count as wrong.
      const complete: Record<string, string> = {};
      for (const id of questionIds) complete[id] = finalAnswers[id] ?? '';
      submitResult.mutate({ duelId, answers: complete }, { onError: () => (submitted.current = false) });
    },
    [duelId, questionIds, submitResult],
  );

  const record = useCallback(
    (questionId: string, answerId: string) => {
      const next = { ...answersRef.current, [questionId]: answerId };
      setAnswers(next);
      answersRef.current = next;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(
        () => {
          if (index >= total - 1) {
            setIndex(total);
            finishAndSubmit(next);
          } else {
            setIndex((i) => i + 1);
          }
        },
        answerId === '' ? 0 : FEEDBACK_MS,
      );
    },
    [index, total, finishAndSubmit],
  );

  const current = questions[index];

  // A new question starts its own timer.
  useEffect(() => {
    questionStart.current = Date.now() + clockOffset.current;
  }, [index, playing]);

  // Time ran out on a question: it counts as wrong and the game moves on.
  useEffect(() => {
    if (!playing || !current || answersRef.current[current.id] !== undefined) return;
    if (serverNow - questionStart.current >= questionMs) record(current.id, '');
  }, [playing, current, serverNow, questionMs, record]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  // Android Back and the browser's Back button ask first, instead of silently abandoning the game.
  useEffect(() => {
    if (!active) return;
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      window.history.pushState(null, '', window.location.href);
      setLeaveOpen(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active]);

  const leave = () => {
    if (!duelId) return;
    leaveDuel.mutate(duelId, { onSettled: () => navigate('/leaderboard', { replace: true }) });
  };

  const leaveDialog = (
    <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Мусобақадан чиқасизми?', 'Выйти из дуэли?')}</DialogTitle>
          <DialogDescription>
            {untilStart > 0
              ? t('Мусобақа бошланмади, у бекор қилинади.', 'Дуэль ещё не началась, она будет отменена.')
              : t('Чиқсангиз, ғалаба рақибингизга берилади.', 'Если выйдете, победа достанется сопернику.')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setLeaveOpen(false)}>
            {t('Давом этиш', 'Остаться')}
          </Button>
          <Button variant="destructive" onClick={leave} disabled={leaveDuel.isPending}>
            <DoorOpen className="mr-2 h-4 w-4" />
            {t('Чиқиш', 'Выйти')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading || (!duel && !isError)) {
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  if (!duel) {
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border-2 bg-card p-8 text-center">
          <p className="mb-6 text-foreground">{t('Мусобақа топилмади', 'Дуэль не найдена')}</p>
          <Button onClick={() => navigate('/leaderboard', { replace: true })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('Турнирга қайтиш', 'Вернуться к турниру')}
          </Button>
        </div>
      </Centered>
    );
  }

  // ---- invitation not answered yet ----
  if (duel.status === 'pending') {
    const iAmChallenger = duel.challenger_id === myUserId;
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border-2 bg-card p-8 text-center animate-scale-in">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
            <Swords className="h-10 w-10 text-primary" />
          </div>
          <Avatar className="mx-auto mb-3 h-14 w-14">
            <AvatarImage src={duel.opponent_user.avatar_url ?? undefined} />
            <AvatarFallback>{duel.opponent_user.login.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          {iAmChallenger ? (
            <>
              <p className="mb-6 text-foreground">
                {duel.opponent_user.login} {t('мусобақа таклифини кутмоқда...', 'ожидает ответа на вызов...')}
              </p>
              <Button variant="outline" onClick={() => respondDuel.mutate({ duelId: duelId!, accept: false })} disabled={respondDuel.isPending}>
                {t('Бекор қилиш', 'Отмена')}
              </Button>
            </>
          ) : (
            <>
              <p className="mb-6 text-foreground">
                {duel.opponent_user.login} {t('сизни мусобақага чақирди', 'вызывает вас на дуэль')}
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => respondDuel.mutate({ duelId: duelId!, accept: true })} disabled={respondDuel.isPending}>
                  {t('Қабул қилиш', 'Принять')}
                </Button>
                <Button variant="outline" onClick={() => respondDuel.mutate({ duelId: duelId!, accept: false })} disabled={respondDuel.isPending}>
                  {t('Рад этиш', 'Отклонить')}
                </Button>
              </div>
            </>
          )}
          <button className="mt-6 text-sm text-muted-foreground underline" onClick={() => navigate('/leaderboard')}>
            {t('Турнирга қайтиш', 'Вернуться к турниру')}
          </button>
        </div>
      </Centered>
    );
  }

  // ---- called off ----
  if (duel.status === 'declined' || duel.status === 'cancelled') {
    const reason =
      duel.ended_reason === 'expired'
        ? t('Таклиф вақтида қабул қилинмади', 'Вызов не приняли вовремя')
        : duel.ended_reason === 'left'
          ? t('Мусобақа бекор қилинди', 'Дуэль отменена: кто-то вышел до начала')
          : t('Мусобақа бекор қилинди', 'Дуэль отменена');
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border-2 bg-card p-8 text-center">
          <p className="mb-6 text-foreground">{reason}</p>
          <Button onClick={() => navigate('/leaderboard', { replace: true })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('Турнирга қайтиш', 'Вернуться к турниру')}
          </Button>
        </div>
      </Centered>
    );
  }

  // ---- result ----
  if (duel.status === 'completed') {
    const won = duel.winner_id === myUserId;
    const isDraw = duel.winner_id === null;
    const forfeit = duel.ended_reason === 'forfeit';
    return (
      <Centered>
        <div
          className={cn(
            'w-full max-w-md rounded-2xl border-2 bg-card p-8 text-center animate-scale-in',
            isDraw ? 'border-border' : won ? 'border-success/50' : 'border-destructive/50',
          )}
        >
          <div
            className={cn(
              'mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full',
              isDraw ? 'bg-muted' : won ? 'bg-success/20' : 'bg-destructive/20',
            )}
          >
            <Trophy className={cn('h-10 w-10', isDraw ? 'text-muted-foreground' : won ? 'text-success' : 'text-destructive')} />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">
            {isDraw ? t('Дурранг!', 'Ничья!') : won ? t('Сиз ютдингиз! 🎉', 'Вы выиграли! 🎉') : t('Сиз ютқаздингиз', 'Вы проиграли')}
          </h2>
          {forfeit && (
            <p className="mb-4 text-sm text-muted-foreground">
              {won ? t('Рақиб мусобақадан чиқди', 'Соперник вышел из дуэли') : t('Сиз мусобақадан чиқдингиз', 'Вы вышли из дуэли')}
            </p>
          )}
          <div className="mb-6 flex items-center justify-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('Сиз', 'Вы')}</p>
              <p className="text-3xl font-bold text-foreground">{duel.my_score ?? 0}</p>
            </div>
            <span className="text-muted-foreground">:</span>
            <div>
              <p className="text-sm text-muted-foreground">{duel.opponent_user.login}</p>
              <p className="text-3xl font-bold text-foreground">{duel.opponent_score ?? 0}</p>
            </div>
          </div>
          <Button onClick={() => navigate('/leaderboard', { replace: true })} className="mb-3 w-full">
            <Trophy className="mr-2 h-4 w-4" />
            {duel.source === 'random' ? t('Янги рақиб излаш', 'Найти нового соперника') : t('Турнир жадвали', 'Таблица турнира')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/', { replace: true })} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('Бош саҳифа', 'На главную')}
          </Button>
        </div>
      </Centered>
    );
  }

  // ---- active ----
  // A duel made by an older build has no fixed question set: it cannot be played here.
  if (!questionIds || startMs === null) {
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border-2 bg-card p-8 text-center">
          <p className="mb-6 text-foreground">
            {t('Бу мусобақа эски версияда яратилган. Янгисини бошланг.', 'Эта дуэль создана в старой версии. Начните новую.')}
          </p>
          <Button variant="outline" onClick={leave} disabled={leaveDuel.isPending}>
            <DoorOpen className="mr-2 h-4 w-4" />
            {t('Чиқиш', 'Выйти')}
          </Button>
        </div>
      </Centered>
    );
  }

  if (untilStart > 0) {
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border-2 bg-card p-8 text-center">
          <Avatar className="mx-auto mb-3 h-14 w-14">
            <AvatarImage src={duel.opponent_user.avatar_url ?? undefined} />
            <AvatarFallback>{duel.opponent_user.login.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className="text-sm text-muted-foreground">{t('Рақиб', 'Соперник')}</p>
          <p className="mb-6 text-lg font-bold text-foreground">{duel.opponent_user.login}</p>
          <p key={Math.ceil(untilStart / 1000)} className="mb-2 text-7xl font-extrabold text-primary animate-scale-in">
            {Math.max(1, Math.ceil(untilStart / 1000))}
          </p>
          <p className="mb-6 text-muted-foreground">{t('Тайёр бўлинг!', 'Приготовьтесь!')}</p>
          <Button variant="outline" onClick={() => setLeaveOpen(true)}>
            <DoorOpen className="mr-2 h-4 w-4" />
            {t('Чиқиш', 'Выйти')}
          </Button>
        </div>
        {leaveDialog}
      </Centered>
    );
  }

  if (duel.my_finished || index >= total) {
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border-2 bg-card p-8 text-center">
          <Loader2 className="mx-auto mb-6 h-10 w-10 animate-spin text-primary" />
          <p className="mb-2 text-foreground">{t('Жавоблар юборилди', 'Ответы отправлены')}</p>
          <p className="text-muted-foreground">
            {t('Кутмоқдамиз', 'Ждём, когда закончит')} {duel.opponent_user.login}...
          </p>
        </div>
      </Centered>
    );
  }

  if (!entries || !current) {
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((questionMs - (serverNow - questionStart.current)) / 1000));
  const selected = answers[current.id] ?? null;

  return (
    <>
      <TestShell
        header={
          <>
            <Button variant="ghost" size="icon" onClick={() => setLeaveOpen(true)} aria-label={t('Чиқиш', 'Выйти')}>
              <DoorOpen className="h-5 w-5" />
            </Button>
            <Swords className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{duel.opponent_user.login}</span>
            <span
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-nums',
                secondsLeft <= 5 ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-foreground',
              )}
              aria-label={t('Қолган вақт', 'Осталось времени')}
            >
              {secondsLeft}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {index + 1}/{total}
            </span>
          </>
        }
        progress={{ current: index + 1, total }}
        numbers={<QuestionNumbers questions={questions} currentIndex={index} answers={answers} />}
      >
        <QuestionView
          question={current}
          selectedAnswer={selected}
          onSelectAnswer={(answerId) => {
            if (answersRef.current[current.id] !== undefined) return;
            record(current.id, answerId);
          }}
        />
      </TestShell>
      {leaveDialog}
    </>
  );
};

export default DuelPage;

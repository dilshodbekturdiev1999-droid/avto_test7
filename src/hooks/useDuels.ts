import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTestLang } from '@/lib/testLang';
import { invokeFunction } from '@/integrations/supabase/functionsClient';
import { getDeviceId } from '@/lib/deviceId';
import { safeStorage } from '@/lib/safeStorage';
import { useUserEvent } from '@/hooks/usePresence';

// Last-resort fallback only -- the server pushes 'duel_invite'/'duel_updated'
// the moment something happens (see useUserEvent below), and the list also
// re-syncs on tab focus (refetchOnWindowFocus) and on '__reconnected' after a
// dropped socket comes back. This staleTime just bounds how long a cached
// result is trusted if none of those fire.
const SAFETY_NET_INTERVAL = 20 * 60 * 1000;
// A live duel is short-lived and time-sensitive (both players are actively
// waiting on each other), so its safety net stays tighter than the general
// list's -- still 4x fewer requests than the old 5s poll, and only runs
// while a duel is actually in progress, not for every idle user.
const LIVE_DUEL_SAFETY_NET_INTERVAL = 15 * 1000;

interface DuelUser {
  id: string;
  login: string;
  avatar_url: string | null;
}

export interface DuelSummary {
  id: string;
  challenger_id: string;
  opponent_id: string;
  topic_id: string;
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';
  challenger_score: number | null;
  opponent_score: number | null;
  winner_id: string | null;
  created_at: string;
  source?: 'friend' | 'random';
  start_at?: string | null;
  opponent_user: DuelUser;
}

interface DuelList {
  incoming: DuelSummary[];
  outgoing: DuelSummary[];
  active: DuelSummary[];
}

export interface DuelDetail {
  id: string;
  challenger_id: string;
  opponent_id: string;
  topic_id: string;
  status: DuelSummary['status'];
  opponent_user: DuelUser;
  my_score: number | null;
  my_finished: boolean;
  opponent_score: number | null;
  opponent_finished: boolean;
  winner_id: string | null;
  total_questions: number | null;
  // Set by builds of the server that synchronise the start (older rows: null).
  lang?: 'uz' | 'ru' | null;
  question_ids?: string[] | null;
  question_time_sec?: number;
  start_at?: string | null;
  server_now?: string;
  my_answers?: Record<string, string>;
  source?: 'friend' | 'random';
  ended_reason?: string | null;
}

export interface LeaderboardRow {
  user_id: string;
  login: string;
  avatar_url: string | null;
  battles: number;
  correct_answers: number;
}

function sessionArgs() {
  return {
    session_token: safeStorage.getItem('session_token'),
    device_id: getDeviceId(),
  };
}

async function callDuels<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await invokeFunction<T>('duels', { action, ...sessionArgs(), ...params });
  if (error) throw new Error(error);
  return data as T;
}

export function useDuelList() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['duel-list'] });
  useUserEvent('duel_invite', invalidate);
  useUserEvent('duel_updated', invalidate);
  useUserEvent('__reconnected', invalidate);

  return useQuery({
    queryKey: ['duel-list'],
    queryFn: () => callDuels<DuelList>('list'),
    staleTime: SAFETY_NET_INTERVAL,
    refetchOnWindowFocus: true,
  });
}

export function useDuel(duelId: string | undefined) {
  const queryClient = useQueryClient();
  useUserEvent('duel_updated', (payload) => {
    if (payload.duel_id === duelId) queryClient.invalidateQueries({ queryKey: ['duel', duelId] });
  });

  return useQuery({
    queryKey: ['duel', duelId],
    queryFn: () => callDuels<DuelDetail>('get', { duel_id: duelId }),
    enabled: !!duelId,
    // Safety net while the duel is live: the challenger's "waiting…" screen
    // and the live match both need to notice a change even if a push was
    // missed. Real-time updates (opponent accepted / finished) arrive via
    // 'duel_updated' above almost instantly; this interval rarely does the
    // actual work.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'active' ? LIVE_DUEL_SAFETY_NET_INTERVAL : false;
    },
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['duel-leaderboard'],
    queryFn: () => callDuels<LeaderboardRow[]>('leaderboard'),
  });
}

export function useChallengeFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opponentLogin: string) => callDuels<{ duel_id: string }>('challenge', { opponent_login: opponentLogin, lang: getTestLang() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duel-list'] });
    },
  });
}

export function useRespondDuel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ duelId, accept }: { duelId: string; accept: boolean }) =>
      callDuels('respond', { duel_id: duelId, accept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duel-list'] });
    },
  });
}

export function useSubmitDuelResult() {
  const queryClient = useQueryClient();
  return useMutation({
    // `answers` ({question_id: answer_id}) is scored by the server. correctCount is only
    // sent for duels created before the server learned to do that.
    mutationFn: ({
      duelId,
      answers,
      correctCount,
      totalQuestions,
    }: {
      duelId: string;
      answers?: Record<string, string>;
      correctCount?: number;
      totalQuestions?: number;
    }) =>
      callDuels('submit-result', {
        duel_id: duelId,
        answers,
        correct_count: correctCount,
        total_questions: totalQuestions,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['duel', variables.duelId] });
      queryClient.invalidateQueries({ queryKey: ['duel-list'] });
    },
  });
}

export function useLeaveDuel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (duelId: string) => callDuels<{ ok: boolean; result: string }>('leave', { duel_id: duelId }),
    onSettled: (_data, _err, duelId) => {
      queryClient.invalidateQueries({ queryKey: ['duel', duelId] });
      queryClient.invalidateQueries({ queryKey: ['duel-list'] });
      queryClient.invalidateQueries({ queryKey: ['duel-leaderboard'] });
    },
  });
}

/** Tell the server this player is still in the room, and keep his answers there. */
export async function sendDuelHeartbeat(duelId: string, answers: Record<string, string>): Promise<void> {
  try {
    await callDuels('heartbeat', { duel_id: duelId, answers });
  } catch {
    /* a missed beat is harmless: the server only acts after ~45 s of silence */
  }
}

export type MatchState = 'idle' | 'searching' | 'nobody' | 'locked' | 'limit' | 'error';

const MATCH_TIMEOUT_MS = 45_000;
const MATCH_POLL_MS = 3_000;

/**
 * "Find an opponent": one press puts the student in the queue; the server pairs him
 * with anyone else searching in the same language. While searching, the poll doubles as
 * the heartbeat that says he is online, and the realtime 'duel_matched' push (handled
 * app-wide) usually brings him to the room before the poll does.
 */
export function useRandomMatch(onMatched: (duelId: string) => void) {
  const [state, setState] = useState<MatchState>('idle');
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(0);
  const active = useRef(false);
  const onMatchedRef = useRef(onMatched);
  onMatchedRef.current = onMatched;

  const stop = useCallback((leaveQueue: boolean) => {
    const wasActive = active.current;
    active.current = false;
    if (leaveQueue && wasActive) void callDuels('queue-leave').catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    startedAt.current = Date.now();
    setSeconds(0);
    setState('searching');
    try {
      const res = await callDuels<{ matched: boolean; duel_id?: string }>('queue-join', { lang: getTestLang() });
      if (res.matched && res.duel_id) {
        stop(false);
        setState('idle');
        onMatchedRef.current(res.duel_id);
      }
    } catch (e) {
      stop(false);
      const code = e instanceof Error ? e.message : '';
      setState(code === 'trial_locked' ? 'locked' : code === 'rate_limited' ? 'limit' : 'error');
    }
  }, [stop]);

  const cancel = useCallback(() => {
    stop(true);
    setState('idle');
  }, [stop]);

  useEffect(() => {
    if (state !== 'searching') return;
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    const poll = setInterval(async () => {
      if (!active.current) return;
      if (Date.now() - startedAt.current > MATCH_TIMEOUT_MS) {
        stop(true);
        setState('nobody');
        return;
      }
      try {
        const res = await callDuels<{ matched: boolean; duel_id?: string }>('queue-poll');
        if (res.matched && res.duel_id && active.current) {
          stop(false);
          setState('idle');
          onMatchedRef.current(res.duel_id);
        }
      } catch {
        /* a failed poll is retried on the next tick */
      }
    }, MATCH_POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [state, stop]);

  // Leaving the screen while searching takes the student out of the queue.
  useEffect(() => () => stop(true), [stop]);

  return { state, seconds, start, cancel };
}

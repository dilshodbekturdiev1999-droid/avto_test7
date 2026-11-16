-- Duels: random matchmaking, a server-authoritative start, leave/forfeit and
-- atomic scoring. Everything is additive: old columns and statuses keep their
-- meaning, so app builds already in the stores keep working.

ALTER TABLE public.duels
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'friend' CHECK (source IN ('friend', 'random')),
  ADD COLUMN IF NOT EXISTS lang text CHECK (lang IN ('uz', 'ru')),
  ADD COLUMN IF NOT EXISTS question_ids jsonb,
  ADD COLUMN IF NOT EXISTS question_time_sec integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_reason text,
  ADD COLUMN IF NOT EXISTS challenger_seen timestamptz,
  ADD COLUMN IF NOT EXISTS opponent_seen timestamptz,
  ADD COLUMN IF NOT EXISTS challenger_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS opponent_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Duels that never finished (the old build had no way to end them).
UPDATE public.duels
SET status = 'cancelled', ended_reason = 'expired'
WHERE status IN ('pending', 'active') AND created_at < now() - interval '1 hour';

-- One live duel per pair of players.
CREATE UNIQUE INDEX IF NOT EXISTS duels_one_live_per_pair
  ON public.duels (LEAST(challenger_id, opponent_id), GREATEST(challenger_id, opponent_id))
  WHERE status IN ('pending', 'active');

-- Who is searching for a random opponent right now. A row is only trusted while
-- its heartbeat is fresh, which is what "online" means for matchmaking.
CREATE TABLE IF NOT EXISTS public.duel_queue (
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('uz', 'ru')),
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.duel_queue ENABLE ROW LEVEL SECURITY;
-- No policies: only edge functions (service role) touch it.

-- Pick N random question ids from the bank of a language.
CREATE OR REPLACE FUNCTION public.duel_pick_questions(p_lang text, p_count integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ids jsonb;
BEGIN
  IF p_lang = 'ru' THEN
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO ids
    FROM (SELECT id FROM public.questions_ru ORDER BY random() LIMIT p_count) q;
  ELSE
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO ids
    FROM (SELECT id FROM public.questions ORDER BY random() LIMIT p_count) q;
  END IF;
  RETURN ids;
END
$$;

-- How many of the given answers ({question_id: answer_id}) are right.
CREATE OR REPLACE FUNCTION public.duel_score(p_lang text, p_question_ids jsonb, p_answers jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  score integer := 0;
BEGIN
  IF p_lang = 'ru' THEN
    SELECT count(*) INTO score
    FROM jsonb_array_elements_text(p_question_ids) AS qid
    JOIN public.answers_ru a ON a.question_id = qid::uuid AND a.id::text = p_answers ->> qid
    WHERE a.is_correct;
  ELSE
    SELECT count(*) INTO score
    FROM jsonb_array_elements_text(p_question_ids) AS qid
    JOIN public.answers a ON a.question_id = qid::uuid AND a.id::text = p_answers ->> qid
    WHERE a.is_correct;
  END IF;
  RETURN score;
END
$$;

-- Finish a duel and decide the winner. Caller must hold the row lock.
CREATE OR REPLACE FUNCTION public.duel_finish(p_duel public.duels, p_reason text, p_forfeiter uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c_score integer;
  o_score integer;
  win uuid;
BEGIN
  IF p_duel.question_ids IS NOT NULL THEN
    c_score := public.duel_score(p_duel.lang, p_duel.question_ids, p_duel.challenger_answers);
    o_score := public.duel_score(p_duel.lang, p_duel.question_ids, p_duel.opponent_answers);
  ELSE
    c_score := coalesce(p_duel.challenger_score, 0);
    o_score := coalesce(p_duel.opponent_score, 0);
  END IF;

  IF p_forfeiter IS NOT NULL THEN
    win := CASE WHEN p_forfeiter = p_duel.challenger_id THEN p_duel.opponent_id ELSE p_duel.challenger_id END;
  ELSIF c_score = o_score THEN
    win := NULL;
  ELSIF c_score > o_score THEN
    win := p_duel.challenger_id;
  ELSE
    win := p_duel.opponent_id;
  END IF;

  UPDATE public.duels
  SET status = 'completed',
      challenger_score = c_score,
      opponent_score = o_score,
      challenger_finished = true,
      opponent_finished = true,
      winner_id = win,
      ended_reason = p_reason,
      completed_at = now()
  WHERE id = p_duel.id;
END
$$;

-- Close duels nobody is playing any more. Called lazily from the edge function
-- and every minute from pg_cron.
CREATE OR REPLACE FUNCTION public.resolve_stale_duels(p_user uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d public.duels;
  n integer := 0;
  game_len interval;
  c_gone boolean;
  o_gone boolean;
BEGIN
  DELETE FROM public.duel_queue WHERE heartbeat_at < now() - interval '30 seconds';

  -- An invitation nobody answered.
  UPDATE public.duels SET status = 'cancelled', ended_reason = 'expired'
  WHERE status = 'pending' AND created_at < now() - interval '5 minutes'
    AND (p_user IS NULL OR challenger_id = p_user OR opponent_id = p_user);

  -- Old build duels: no start time, nobody can finish them.
  UPDATE public.duels SET status = 'cancelled', ended_reason = 'expired'
  WHERE status = 'active' AND start_at IS NULL AND created_at < now() - interval '1 hour'
    AND (p_user IS NULL OR challenger_id = p_user OR opponent_id = p_user);

  FOR d IN
    SELECT * FROM public.duels
    WHERE status = 'active' AND start_at IS NOT NULL
      AND (p_user IS NULL OR challenger_id = p_user OR opponent_id = p_user)
    FOR UPDATE SKIP LOCKED
  LOOP
    game_len := make_interval(secs => coalesce(jsonb_array_length(d.question_ids), 10) * d.question_time_sec + 60);
    c_gone := NOT d.challenger_finished AND now() > d.start_at + interval '45 seconds'
              AND coalesce(d.challenger_seen, d.start_at) < now() - interval '45 seconds';
    o_gone := NOT d.opponent_finished AND now() > d.start_at + interval '45 seconds'
              AND coalesce(d.opponent_seen, d.start_at) < now() - interval '45 seconds';

    IF c_gone AND o_gone THEN
      PERFORM public.duel_finish(d, 'abandoned');
      n := n + 1;
    ELSIF c_gone THEN
      PERFORM public.duel_finish(d, 'forfeit', d.challenger_id);
      n := n + 1;
    ELSIF o_gone THEN
      PERFORM public.duel_finish(d, 'forfeit', d.opponent_id);
      n := n + 1;
    ELSIF now() > d.start_at + game_len THEN
      PERFORM public.duel_finish(d, 'timeout');
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END
$$;

-- Find a partner or wait. Returns the new duel id, or NULL while waiting.
-- One advisory lock serialises searches, so two people can never grab the same
-- partner.
CREATE OR REPLACE FUNCTION public.duel_match_or_enqueue(p_user uuid, p_lang text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  partner uuid;
  new_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('duel_queue'));

  DELETE FROM public.duel_queue WHERE heartbeat_at < now() - interval '30 seconds';
  DELETE FROM public.duel_queue WHERE user_id = p_user;

  -- Already in a live duel: nothing to match.
  IF EXISTS (
    SELECT 1 FROM public.duels
    WHERE status IN ('pending', 'active') AND (challenger_id = p_user OR opponent_id = p_user)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT q.user_id INTO partner
  FROM public.duel_queue q
  WHERE q.lang = p_lang
    AND q.user_id <> p_user
    -- not the same person again within 10 minutes
    AND NOT EXISTS (
      SELECT 1 FROM public.duels d
      WHERE d.created_at > now() - interval '10 minutes'
        AND ((d.challenger_id = p_user AND d.opponent_id = q.user_id)
          OR (d.challenger_id = q.user_id AND d.opponent_id = p_user))
    )
  ORDER BY q.enqueued_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF partner IS NULL THEN
    INSERT INTO public.duel_queue (user_id, lang) VALUES (p_user, p_lang);
    RETURN NULL;
  END IF;

  DELETE FROM public.duel_queue WHERE user_id = partner;

  INSERT INTO public.duels
    (challenger_id, opponent_id, status, source, lang, question_ids, start_at, responded_at, total_questions)
  VALUES
    (partner, p_user, 'active', 'random', p_lang, public.duel_pick_questions(p_lang, 10),
     now() + interval '6 seconds', now(), 10)
  RETURNING id INTO new_id;

  RETURN new_id;
END
$$;

-- Hand in the answers: atomic, once per player, scored here and not by the client.
CREATE OR REPLACE FUNCTION public.duel_submit(p_duel uuid, p_user uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d public.duels;
  is_c boolean;
  my_score integer;
  other_done boolean;
BEGIN
  SELECT * INTO d FROM public.duels WHERE id = p_duel FOR UPDATE;
  IF NOT FOUND OR (d.challenger_id <> p_user AND d.opponent_id <> p_user) OR d.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  is_c := d.challenger_id = p_user;
  IF (is_c AND d.challenger_finished) OR (NOT is_c AND d.opponent_finished) THEN
    RETURN jsonb_build_object('error', 'already_submitted');
  END IF;

  my_score := public.duel_score(d.lang, d.question_ids, coalesce(p_answers, '{}'::jsonb));
  IF is_c THEN
    UPDATE public.duels SET challenger_answers = coalesce(p_answers, '{}'::jsonb),
      challenger_score = my_score, challenger_finished = true WHERE id = p_duel;
  ELSE
    UPDATE public.duels SET opponent_answers = coalesce(p_answers, '{}'::jsonb),
      opponent_score = my_score, opponent_finished = true WHERE id = p_duel;
  END IF;

  SELECT * INTO d FROM public.duels WHERE id = p_duel;
  other_done := CASE WHEN is_c THEN d.opponent_finished ELSE d.challenger_finished END;
  IF other_done THEN
    PERFORM public.duel_finish(d, 'finished');
  END IF;
  RETURN jsonb_build_object('ok', true, 'completed', other_done, 'my_score', my_score);
END
$$;

-- Leave a duel: before the start it is just cancelled, after it that player
-- forfeits and the other one wins.
CREATE OR REPLACE FUNCTION public.duel_leave(p_duel uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d public.duels;
  other uuid;
BEGIN
  SELECT * INTO d FROM public.duels WHERE id = p_duel FOR UPDATE;
  IF NOT FOUND OR (d.challenger_id <> p_user AND d.opponent_id <> p_user) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  other := CASE WHEN d.challenger_id = p_user THEN d.opponent_id ELSE d.challenger_id END;

  IF d.status = 'pending' OR (d.status = 'active' AND (d.start_at IS NULL OR now() < d.start_at)) THEN
    UPDATE public.duels SET status = 'cancelled', ended_reason = 'left' WHERE id = p_duel;
    RETURN jsonb_build_object('ok', true, 'other', other, 'result', 'cancelled');
  END IF;
  IF d.status = 'active' THEN
    PERFORM public.duel_finish(d, 'forfeit', p_user);
    RETURN jsonb_build_object('ok', true, 'other', other, 'result', 'forfeit');
  END IF;
  RETURN jsonb_build_object('ok', true, 'other', other, 'result', d.status);
END
$$;

REVOKE ALL ON FUNCTION public.duel_match_or_enqueue(uuid, text), public.duel_submit(uuid, uuid, jsonb),
  public.duel_leave(uuid, uuid), public.resolve_stale_duels(uuid), public.duel_pick_questions(text, integer),
  public.duel_score(text, jsonb, jsonb), public.duel_finish(public.duels, text, uuid)
FROM PUBLIC, anon, authenticated;

-- Clean up every minute, so a duel never hangs because nobody asked about it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('duels-resolve') FROM cron.job WHERE jobname = 'duels-resolve';
    PERFORM cron.schedule('duels-resolve', '* * * * *', 'select public.resolve_stale_duels()');
  END IF;
END
$$;

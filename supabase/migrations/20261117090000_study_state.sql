-- Per-student study state: "My mistakes" (questions whose LAST answer was wrong)
-- and bookmarks (questions, cheat sheets, sign hints). Only edge functions
-- (service-role key) touch these tables, like topic_progress.
--
-- lang is part of the key because the UZ and RU question banks are separate
-- tables with different ids.

CREATE TABLE IF NOT EXISTS public.user_mistakes (
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('uz', 'ru')),
  question_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang, question_id)
);

CREATE TABLE IF NOT EXISTS public.user_saved (
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('question', 'cheatsheet', 'sign')),
  item_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, item_key)
);

ALTER TABLE public.user_mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved ENABLE ROW LEVEL SECURITY;
-- No policies on purpose.

-- The content tables only had primary keys; the new features join on these.
CREATE INDEX IF NOT EXISTS idx_answers_question ON public.answers (question_id);
CREATE INDEX IF NOT EXISTS idx_answers_ru_question ON public.answers_ru (question_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions (topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_ru_topic ON public.questions_ru (topic_id);

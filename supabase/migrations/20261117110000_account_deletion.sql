-- Account deletion. A student can delete his own account from the app and the site
-- (App Store 5.1.1(v) and Google Play require it).
--
-- A student who never paid is deleted outright; his progress, mistakes, bookmarks and
-- friendships go with him (their foreign keys cascade) and his duels stay for the
-- opponent with the player blanked (the keys are ON DELETE SET NULL).
--
-- payments.user_id has no ON DELETE rule on purpose: payment records must be kept for
-- accounting. A student with payments is therefore anonymised instead: the row stays,
-- but login, phone, password, photo and sessions are wiped.
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_app_users_deleted ON public.app_users (deleted_at) WHERE deleted_at IS NOT NULL;

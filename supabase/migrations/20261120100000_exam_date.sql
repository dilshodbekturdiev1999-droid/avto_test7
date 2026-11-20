-- The student's exam day, kept on the server so it follows him between devices.
-- Written/read only by the study-sync edge function (service role).
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS exam_date date;

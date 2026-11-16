-- One Uzbek question had two answers marked correct. The picture shows an
-- unregulated intersection where the tram goes first, so the single correct
-- answer is "Трамвай, мотоцикл, автомобил". Guarded so a re-run is harmless.
UPDATE public.answers
SET is_correct = false
WHERE id = 'acf7b2b6-2c28-4cd6-b83a-a095cf99001f'
  AND question_id = 'ad82bb5b-9ce0-458b-bc03-5066a8777025'
  AND answer_uz_cyr = 'Мотоцикл, автомобил, трамвай';

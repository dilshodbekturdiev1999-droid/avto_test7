import { useEffect, useState } from 'react';
import { getBundledQuestionById, trialAllowedLessonIds, type IndexedQuestion } from '@/lib/offlineContent';
import { useFullAccess } from '@/hooks/useAuth';

/**
 * Resolve question ids to full entries from the bundle, in the given order.
 * A trial student only ever gets questions of the lesson open to him.
 */
export function useQuestionEntries(ids: string[]): { entries: IndexedQuestion[]; loading: boolean } {
  const fullAccess = useFullAccess();
  const [entries, setEntries] = useState<IndexedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const key = ids.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [found, allowed] = await Promise.all([
        Promise.all(ids.map((id) => getBundledQuestionById(id))),
        fullAccess ? Promise.resolve(null) : trialAllowedLessonIds(),
      ]);
      if (cancelled) return;
      setEntries(
        found.filter((e): e is IndexedQuestion => !!e && (allowed === null || allowed.has(e.lessonId))),
      );
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fullAccess]);

  return { entries, loading };
}

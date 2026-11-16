import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { isSaved, toggleSaved, useStudyVersion, type SavedKind } from './studyState';

/** Bookmark toggle, like saving a post: outline when not saved, filled when saved. */
export function SaveButton({ kind, itemKey, className }: { kind: SavedKind; itemKey: string; className?: string }) {
  useStudyVersion();
  const t = useT();
  const saved = isSaved(kind, itemKey);
  return (
    <button
      type="button"
      onClick={() => toggleSaved(kind, itemKey)}
      aria-pressed={saved}
      aria-label={saved ? t('Сақланганлардан олиш', 'Убрать из сохранённых') : t('Сақлаш', 'Сохранить')}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-90 hover:bg-foreground/5',
        saved && 'text-primary',
        className,
      )}
    >
      <Bookmark className={cn('h-6 w-6', saved && 'fill-current')} />
    </button>
  );
}

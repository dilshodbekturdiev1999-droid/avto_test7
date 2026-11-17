import { useEffect, useRef } from 'react';
import { cn, isAnswerCorrect } from '@/lib/utils';
import type { QuestionWithAnswers } from '@/types/database';
import { useT } from '@/hooks/useT';

interface QuestionNumbersProps {
  questions: QuestionWithAnswers[];
  currentIndex: number;
  answers: Record<string, string>;
  onSelect?: (index: number) => void;
}

/**
 * Question numbers in a single scrolling line: a row across the top in portrait,
 * a column on the left on a phone held sideways. The current number is kept in
 * view, so with hundreds of questions the student can still find his place.
 */
export function QuestionNumbers({ questions, currentIndex, answers, onSelect }: QuestionNumbersProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = listRef.current;
    const el = box?.children[currentIndex] as HTMLElement | undefined;
    if (!box || !el) return;
    // Only the scrollable axis moves; the other has no range, so it is clamped.
    box.scrollTo({
      left: Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2),
      top: Math.max(0, el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2),
      behavior: 'smooth',
    });
  }, [currentIndex]);

  return (
    <div
      ref={listRef}
      className={cn(
        'no-scrollbar relative flex shrink-0 gap-2 overflow-x-auto overflow-y-hidden p-1',
        'short:w-14 short:flex-col short:overflow-x-hidden short:overflow-y-auto',
      )}
    >
      {questions.map((q, i) => {
        const selectedId = answers[q.id];
        const isCurrent = i === currentIndex;
        let state: 'correct' | 'wrong' | 'idle' = 'idle';

        if (selectedId) {
          const selected = q.answers.find((a) => a.id === selectedId);
          state = selected && isAnswerCorrect(selected.is_correct) ? 'correct' : 'wrong';
        }

        const base = 'qn-item w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border transition-all shrink-0';
        const styles =
          state === 'correct'
            ? 'bg-success text-success-foreground border-success'
            : state === 'wrong'
            ? 'bg-destructive text-destructive-foreground border-destructive'
            : 'bg-secondary text-foreground border-border hover:border-primary/50';
        const ring = isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary' : '';

        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect?.(i)}
            data-state={state}
            className={cn(base, styles, ring, onSelect && 'cursor-pointer')}
            aria-label={`${t('Савол', 'Вопрос')} ${i + 1}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

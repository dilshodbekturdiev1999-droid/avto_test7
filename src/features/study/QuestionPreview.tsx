import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn, isAnswerCorrect } from '@/lib/utils';
import type { IndexedQuestion } from '@/lib/offlineContent';

/**
 * A question shown as information, not as a task: path (lesson > topic > number),
 * text, picture and all the answers with the right one marked. Used by
 * "My mistakes", saved questions and search.
 */
export function QuestionPreview({
  entry,
  actions,
  className,
  matchedAnswerIds,
}: {
  entry: IndexedQuestion;
  actions?: ReactNode;
  className?: string;
  /** Answers to point out (search hits). */
  matchedAnswerIds?: Set<string>;
}) {
  const { question } = entry;
  return (
    <article className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <div className="mb-2 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
          {entry.lessonTitle} › {entry.topicTitle} › №{entry.position}
          <span className="text-muted-foreground/60"> / {entry.topicCount}</span>
        </p>
        {actions}
      </div>
      <h3 className="mb-3 text-base font-semibold leading-snug text-foreground">{question.question_uz_cyr}</h3>
      {question.image_url && (
        <img
          src={question.image_url}
          alt=""
          loading="lazy"
          className="mb-3 max-h-56 w-full rounded-xl object-contain"
        />
      )}
      <ul className="space-y-2">
        {question.answers.map((a) => {
          const correct = isAnswerCorrect(a.is_correct);
          return (
            <li
              key={a.id}
              className={cn(
                'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
                correct ? 'border-success bg-success/15 text-foreground' : 'border-border text-muted-foreground',
                matchedAnswerIds?.has(a.id) && 'ring-2 ring-primary/60',
              )}
            >
              {correct && <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
              <span className="min-w-0">{a.answer_uz_cyr}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

import { cn, isAnswerCorrect } from '@/lib/utils';
import type { QuestionWithAnswers } from '@/types/database';
import placeholder1 from '@/assets/avto.jpg';
import placeholder2 from '@/assets/avto1.jpg';
import placeholder3 from '@/assets/avto2.jpg';
import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useT } from '@/hooks/useT';

interface QuestionViewProps {
  question: QuestionWithAnswers;
  selectedAnswer: string | null;
  onSelectAnswer: (answerId: string) => void;
  /** Small control shown at the end of the question line (e.g. a bookmark). */
  headerAction?: ReactNode;
}

const ANSWER_LABELS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];
const FALLBACK_IMAGES = [placeholder1, placeholder2, placeholder3];

export function QuestionView({ question, selectedAnswer, onSelectAnswer, headerAction }: QuestionViewProps) {
  // Use image_url from server proxy, fall back to image_path for backwards compat
  const imageUrl = (question as any).image_url || null;
  const [zoomOpen, setZoomOpen] = useState(false);
  const t = useT();
  const fallbackImage = useMemo(
    () => FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)],
    [question.id]
  );

  // Let F1-F8 OR plain 1-8 pick an answer, same as clicking. Both are bound
  // because many laptops map F-keys to volume/brightness by default (a
  // hardware/OS-level remap the page can never intercept, Fn Lock has to be
  // on for F-keys to behave as F-keys at all) -- plain number keys always
  // work regardless of that setting. preventDefault matters for the F-key
  // case: F5 reloads the page and would silently blow away the whole test.
  useEffect(() => {
    if (selectedAnswer !== null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      const fMatch = /^F([1-8])$/.exec(e.key);
      const digitMatch = /^[1-8]$/.exec(e.key);
      const idx = fMatch ? Number(fMatch[1]) - 1 : digitMatch ? Number(digitMatch[0]) - 1 : null;
      if (idx === null) return;

      const answer = question.answers[idx];
      if (!answer) return;
      e.preventDefault();
      onSelectAnswer(answer.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAnswer, question.answers, onSelectAnswer]);

  return (
    <div className="qv-root bg-card rounded-2xl border border-border overflow-hidden animate-scale-in">
      {/* Question text */}
      <div className="qv-head flex items-start gap-3 border-b border-border p-4 sm:p-6 short:p-3">
        <h2 className="flex-1 text-lg font-semibold leading-snug text-foreground sm:text-xl sm:leading-relaxed short:text-base">
          {question.question_uz_cyr}
        </h2>
        {headerAction}
      </div>

      {/* Content: Image + Answers */}
      <div className="qv-body flex flex-col lg:flex-row short:flex-row">
        {/* Image - always shown, either question image or logo */}
        <div className="p-3 sm:p-4 lg:w-3/5 short:w-1/2 short:p-2">
          {imageUrl ? (
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="block w-full cursor-zoom-in rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t('Расмни катталаштириш', 'Увеличить изображение')}
            >
              <img
                src={imageUrl}
                alt={t('Савол расми', 'Изображение вопроса')}
                className="w-full h-auto rounded-xl max-h-[min(400px,38dvh)] object-contain short:max-h-[48dvh]"
              />
            </button>
          ) : (
            <img
              src={fallbackImage}
              alt="AvtoTest 7"
              className="w-full h-auto rounded-xl max-h-[min(400px,38dvh)] object-cover short:max-h-[48dvh]"
            />
          )}

          <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 bg-black/95 border-none flex items-center justify-center">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={t('Савол расми', 'Изображение вопроса')}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Answers */}
        <div className="qv-answers flex-1 space-y-2 p-3 sm:space-y-3 sm:p-4 short:p-2">
          {question.answers.map((answer, idx) => {
            const isSelected = selectedAnswer === answer.id;
            const isCorrect = isAnswerCorrect(answer.is_correct);
            
            let buttonStyle = "bg-secondary border-primary/30 hover:border-primary/60";
            let labelStyle = "bg-muted text-muted-foreground";

            if (isSelected && isCorrect) {
              buttonStyle = "bg-success/20 border-success";
              labelStyle = "bg-success text-success-foreground";
            } else if (isSelected && !isCorrect) {
              buttonStyle = "bg-destructive/20 border-destructive";
              labelStyle = "bg-destructive text-destructive-foreground";
            } else if (selectedAnswer !== null && isCorrect) {
              // Hint: reveal the correct answer even when it wasn't picked --
              // students on video-free tariffs need this to actually learn
              // the material instead of just seeing "wrong" with no context.
              buttonStyle = "bg-success/20 border-success";
              labelStyle = "bg-success text-success-foreground";
            }

            return (
              <button
                key={answer.id}
                data-state={selectedAnswer === null ? 'idle' : isCorrect ? 'correct' : isSelected ? 'wrong' : 'dim'}
                onClick={() => onSelectAnswer(answer.id)}
                disabled={selectedAnswer !== null}
                className={cn(
                  "qv-answer w-full flex items-center gap-3 p-3 sm:gap-4 sm:p-4 rounded-xl border-2 transition-all duration-200 text-left",
                  buttonStyle,
                  selectedAnswer === null && "hover:scale-[1.01]",
                  selectedAnswer !== null && !isSelected && !isCorrect && "opacity-60"
                )}
              >
                <span className={cn(
                  "qv-key w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                  labelStyle
                )}>
                  {ANSWER_LABELS[idx] || `F${idx + 1}`}
                </span>
                <span className="text-foreground">{answer.answer_uz_cyr}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

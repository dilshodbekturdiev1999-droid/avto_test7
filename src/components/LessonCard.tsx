import { cn } from '@/lib/utils';
import { SIcon } from '@/components/ui/SIcon';
import { TariffCheckoutDialog } from '@/components/TariffCheckoutDialog';
import { useT } from '@/hooks/useT';

interface LessonCardProps {
  title: string;
  topicCount: number;
  completedCount: number;
  index: number;
  isUnlocked: boolean;
  onClick: () => void;
}

// One lesson in the list: number square, title, topics done, thin bar while in progress.
export function LessonCard({ title, topicCount, completedCount, index, isUnlocked, onClick }: LessonCardProps) {
  const done = completedCount === topicCount && topicCount > 0;
  const started = completedCount > 0 && !done;
  const pct = topicCount > 0 ? (completedCount / topicCount) * 100 : 0;
  const t = useT();

  // A <button> can't contain another interactive <button> (the "pay" link below),
  // so this is a <div> with button semantics.
  return (
    <div
      role={isUnlocked ? 'button' : undefined}
      tabIndex={isUnlocked ? 0 : undefined}
      onClick={isUnlocked ? onClick : undefined}
      onKeyDown={isUnlocked ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={cn(
        'w-full text-left flex items-center gap-3 p-3 pr-4',
        started ? 'w-card-lg' : 'w-card',
        isUnlocked ? 'cursor-pointer w-press' : 'opacity-70',
      )}
    >
      <span className={cn('w-lnum w-num', started && 'cur', done && 'done')}>{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="w-h2 text-base leading-snug text-foreground">{title}</p>
        {isUnlocked ? (
          <p className="text-[13px] text-muted-foreground w-num">
            {completedCount} / {topicCount} {t('мавзу', 'тем')}
          </p>
        ) : (
          <TariffCheckoutDialog
            trigger={
              <button type="button" onClick={(e) => e.stopPropagation()} className="text-[13px] font-semibold text-primary">
                {t('Тўлиқ доступ учун тўлаш →', 'Оплатить полный доступ →')}
              </button>
            }
          />
        )}
        {started && <div className="w-bar mt-2"><i style={{ width: `${pct}%` }} /></div>}
      </div>
      {!isUnlocked ? (
        <SIcon name="lock-keyhole-minimalistic" variant="bold" className="text-xl text-muted-foreground" />
      ) : done ? (
        <SIcon name="check-circle" variant="bold" className="text-2xl text-success" />
      ) : (
        <SIcon name="alt-arrow-right" variant="line" className="text-muted-foreground/60" />
      )}
    </div>
  );
}

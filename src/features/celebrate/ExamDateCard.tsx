import { CalendarDays } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { setExamDate } from './celebrate';
import { useExamDate } from './examDateSync';

/** "When is your exam?" On that day the app opens with a good-luck wish. */
export function ExamDateCard() {
  const t = useT();
  const date = useExamDate();
  return (
    <label className="flex items-center gap-3 rounded-[calc(var(--radius)+2px)] border border-border bg-card px-4 py-3">
      <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-foreground">{t('Имтиҳон куни', 'День экзамена')}</span>
        <span className="block text-xs text-muted-foreground">
          {t('Шу куни сизга омад тилаймиз', 'В этот день пожелаем вам удачи')}
        </span>
      </span>
      <input
        type="date"
        value={date}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => {
          setExamDate(e.target.value);
        }}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
      />
    </label>
  );
}

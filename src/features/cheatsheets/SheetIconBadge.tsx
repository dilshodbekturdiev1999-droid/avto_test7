import type { ComponentType } from 'react';
import { Ban, CircleDot, Gauge, Link2, Package, Ruler, Timer, TriangleAlert, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CheatSheet, SheetIcon, SheetTone } from './cheatsheets';

const ICONS: Record<SheetIcon, ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  timer: Timer,
  ban: Ban,
  warning: TriangleAlert,
  ruler: Ruler,
  package: Package,
  link: Link2,
  tyre: CircleDot,
  wrench: Wrench,
};

const TONES: Record<SheetTone, string> = {
  red: 'bg-red-500/10 text-red-500',
  blue: 'bg-sky-500/10 text-sky-500',
  purple: 'bg-violet-500/10 text-violet-500',
  yellow: 'bg-amber-500/10 text-amber-500',
  green: 'bg-emerald-500/10 text-emerald-500',
};

export function SheetIconBadge({ sheet, className }: { sheet: CheatSheet; className?: string }) {
  const Icon = ICONS[sheet.icon];
  return (
    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', TONES[sheet.tone], className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

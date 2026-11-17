import { memo } from 'react';
import { SOLAR, SOLAR_VIEWBOX } from './solarIcons';
import { cn } from '@/lib/utils';

export type SIconVariant = 'duo' | 'bold' | 'line';
const SUFFIX: Record<SIconVariant, string> = { duo: 'bold-duotone', bold: 'bold', line: 'linear' };

/** Solar icon from the bundled subset (works offline). Colour = currentColor, size = font-size or className. */
export const SIcon = memo(function SIcon({ name, variant = 'duo', className }: { name: string; variant?: SIconVariant; className?: string }) {
  const body = SOLAR[`${name}-${SUFFIX[variant]}`];
  if (!body) return null;
  return <svg viewBox={SOLAR_VIEWBOX} aria-hidden="true" className={cn('h-[1em] w-[1em] shrink-0', className)} dangerouslySetInnerHTML={{ __html: body }} />;
});

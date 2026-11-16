import type { ReactNode } from 'react';
import { ProgressBar } from '@/components/ProgressBar';

interface TestShellProps {
  /** Top row: back button, title, counter. */
  header: ReactNode;
  /** Thin progress bar under the header. */
  progress?: { current: number; total: number };
  /** Question number strip (horizontal in portrait, a left column in landscape). */
  numbers?: ReactNode;
  /** Bottom action bar, always visible. */
  footer?: ReactNode;
  /** The question itself; this is the only area that scrolls. */
  children: ReactNode;
}

/**
 * One full-height layout for every question screen (topic test, final test,
 * duel, mistakes). The header, number strip and action bar keep their size, and
 * only the question area scrolls, so nothing covers the question on a phone.
 * `short:` is a phone held sideways, see tailwind.config.ts.
 */
export function TestShell({ header, progress, numbers, footer, children }: TestShellProps) {
  return (
    <div className="test-shell mx-auto flex w-full max-w-5xl flex-col px-3 py-2 sm:px-4">
      <header className="flex shrink-0 items-center gap-2 pb-2 short:pb-1">{header}</header>
      {progress && <ProgressBar current={progress.current} total={progress.total} className="mb-2 shrink-0 short:hidden" />}
      <div className="flex min-h-0 flex-1 flex-col gap-2 short:flex-row">
        {numbers}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
      </div>
      {footer && <footer className="flex shrink-0 gap-3 border-t border-border pt-2 short:pt-1 short:[&>button]:h-9">{footer}</footer>}
    </div>
  );
}

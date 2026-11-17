import type { ReactNode } from 'react';
import { SiteShell, type SiteTab } from '@/components/site/SiteShell';

// Interior pages (profile, tournament, mistakes, …) inside the site frame:
// desktop menu + top bar, phone back button + large title.
// `icon` is accepted for old callers; the «Сайт (Apple)» design has no title icons.
export function PageShell({
  title,
  onBack,
  actions,
  active,
  children,
}: {
  title: string;
  icon?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
  active?: SiteTab;
  children: ReactNode;
}) {
  return (
    <SiteShell title={title} onBack={onBack} actions={actions} active={active}>
      {children}
    </SiteShell>
  );
}

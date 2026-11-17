import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIcon } from '@/components/ui/SIcon';
import { TabBar } from '@/components/TabBar';

// Interior page: small top bar (back + actions) and an iOS-style large title.
// (The old `icon` prop is accepted but no longer drawn: large titles stand on their own.)
// `tab` pages are the four main sections: no back button, tab bar at the bottom.
export function PageShell({
  title,
  onBack,
  actions,
  tab = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
  tab?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className={`min-h-screen relative ${tab ? 'w-with-tabs' : 'pb-10'}`}>
      <div className="max-w-2xl mx-auto px-4" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="h-11 flex items-center gap-2">
          {!tab && (
            <button
              onClick={onBack ?? (() => navigate(-1))}
              className="-ml-2 h-10 pl-1 pr-3 rounded-full flex items-center gap-1 text-primary font-medium active:bg-foreground/5"
              aria-label="Orqaga"
            >
              <SIcon name="alt-arrow-left" variant="line" className="text-2xl" />
            </button>
          )}
          <div className="flex-1" />
          {actions}
        </div>
        <h1 className="w-title text-foreground flex items-center gap-2 mt-1 mb-4">
          <span className="min-w-0">{title}</span>
        </h1>
        {children}
      </div>
      {tab && <TabBar />}
    </div>
  );
}

import { useLocation, useNavigate } from 'react-router-dom';
import { SIcon } from '@/components/ui/SIcon';
import { useT } from '@/hooks/useT';
import { Logo } from '@/components/landing/Logo';

// The four main sections. Everything else is reached from them and has a back button.
export const TAB_PATHS = ['/', '/lessons', '/practice', '/info'] as const;

export function TabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const tabs = [
    { to: '/', icon: 'home-2', label: t('Асосий', 'Главная') },
    { to: '/lessons', icon: 'book-2', label: t('Дарслар', 'Уроки') },
    { to: '/practice', icon: 'checklist-minimalistic', label: t('Машқ', 'Практика') },
    { to: '/info', icon: 'info-square', label: t('Маълумот', 'Справка') },
  ];
  return (
    <nav className="w-tabbar" aria-label={t('Бўлимлар', 'Разделы')}>
      {/* Only visible where the bar turns into a sidebar (wide screens on the site). */}
      <span className="w-tabbar-logo"><Logo height={24} /></span>
      {tabs.map((tab) => {
        const on = pathname === tab.to;
        return (
          <a key={tab.to} href={`#${tab.to}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); if (!on) navigate(tab.to); }}>
            <SIcon name={tab.icon} variant={on ? 'bold' : 'line'} />
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIcon } from '@/components/ui/SIcon';
import { Logo } from '@/components/landing/Logo';
import { useAccessInfo, useFullAccess } from '@/hooks/useAuth';
import { useT } from '@/hooks/useT';
import { safeStorage } from '@/lib/safeStorage';

export type SiteTab = 'home' | 'lessons' | 'practice' | 'info';

const TARIFF: Record<string, string> = { standard: 'Стандарт', pro: 'Про', max: 'Макс' };

// The site frame from the approved «Сайт (Apple)» sheets:
//  desktop — left menu (4 sections + quick links + the student at the bottom) and a top bar
//  (page title, search, avatar); phone — large title and a plain 4-tab bar for the main sections.
export function SiteShell({
  title,
  deskTitle,
  tab,
  active,
  onBack,
  actions,
  wide = true,
  children,
}: {
  title: string;
  /** Desktop top-bar title when it differs (home says «Хайрли кун, …»). */
  deskTitle?: string;
  /** One of the four main sections: no back button, tab bar on the phone. */
  tab?: SiteTab;
  /** Highlight a section in the desktop menu without making this a tab page. */
  active?: SiteTab;
  onBack?: () => void;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const t = useT();
  const fullAccess = useFullAccess();
  const { tariff, expiresAt } = useAccessInfo();
  const login = safeStorage.getItem('login') ?? '';
  const avatarUrl = safeStorage.getItem('avatar_url');
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)) : null;
  const plan = fullAccess
    ? `${tariff ? TARIFF[tariff] ?? tariff : t('Тўлиқ', 'Полный')}${daysLeft !== null ? ` · ${daysLeft} ${t('кун', 'дн.')}` : ''}`
    : t('Синов даври', 'Пробный период');

  const nav: { key: SiteTab; to: string; icon: string; label: string }[] = [
    { key: 'home', to: '/', icon: 'home-2', label: t('Асосий', 'Главная') },
    { key: 'lessons', to: '/lessons', icon: 'book-2', label: t('Дарслар', 'Уроки') },
    { key: 'practice', to: '/practice', icon: 'document-text', label: t('Машқ', 'Практика') },
    { key: 'info', to: '/info', icon: 'info-square', label: t('Маълумот', 'Справка') },
  ];
  const go = (to: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(to); };
  const ava = (
    <span className="sa-ava">{avatarUrl ? <img src={avatarUrl} alt="" /> : login.slice(0, 1).toUpperCase()}</span>
  );

  return (
    <div className="sa-app">
      <aside className="sa-side">
        <div className="brand"><Logo height={22} /></div>
        {nav.map((n) => (
          <a key={n.key} href={`#${n.to}`} onClick={go(n.to)} className={(tab ?? active) === n.key ? 'on' : ''}>
            <SIcon name={n.icon} variant={(tab ?? active) === n.key ? 'duo' : 'line'} />{n.label}
          </a>
        ))}
        <div className="cap">{t('Тез ўтиш', 'Быстрый доступ')}</div>
        <a href="#/leaderboard" onClick={go('/leaderboard')}><SIcon name="cup-star" variant="line" />{t('Турнир', 'Турнир')}</a>
        <a href="#/saved" onClick={go('/saved')}><SIcon name="bookmark" variant="line" />{t('Сақланганлар', 'Сохранённые')}</a>
        <a href="#/search" onClick={go('/search')}><SIcon name="magnifer" variant="line" />{t('Қидирув', 'Поиск')}</a>
        <div className="me" onClick={() => navigate('/profile')} role="button" tabIndex={0}>
          {ava}
          <div className="flex-1 min-w-0"><b className="truncate">{login}</b><small>{plan}</small></div>
          <SIcon name="settings" variant="line" className="text-xl" />
        </div>
      </aside>

      <div className="sa-content">
        <div className="sa-dtop">
          <h1>{deskTitle ?? title}</h1>
          {actions}
          <div className="sa-field" style={{ width: 360 }} onClick={() => navigate('/search')} role="button" tabIndex={0}>
            <SIcon name="magnifer" variant="line" />{t('Савол, белги ёки мавзу', 'Вопрос, знак или тема')}
          </div>
          <button type="button" onClick={() => navigate('/profile')} aria-label={t('Профиль', 'Профиль')}>{ava}</button>
        </div>

        <div className="sa-phead">
          <div className="bar">
            {tab ? <span /> : (
              <button type="button" className="sa-back" onClick={onBack ?? (() => navigate(-1))} aria-label={t('Орқага', 'Назад')}>
                <SIcon name="alt-arrow-left" variant="line" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              {actions}
              {tab === 'home' && (
                <>
                  <button type="button" onClick={() => navigate('/search')} aria-label={t('Қидирув', 'Поиск')}
                    className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-xl" style={{ background: 'var(--sa-card)' }}>
                    <SIcon name="magnifer" variant="line" />
                  </button>
                  <button type="button" onClick={() => navigate('/profile')} aria-label={t('Профиль', 'Профиль')}>{ava}</button>
                </>
              )}
            </div>
          </div>
          <div className="sa-h-page">{title}</div>
        </div>

        <main className="sa-main">
          <div className={wide ? 'sa-wrap' : 'sa-wrap max-w-[1000px]'}>{children}</div>
        </main>
      </div>

      {tab && (
        <nav className="sa-tabs">
          {nav.map((n) => (
            <a key={n.key} href={`#${n.to}`} onClick={go(n.to)} className={(tab ?? active) === n.key ? 'on' : ''}>
              <SIcon name={n.icon} variant={(tab ?? active) === n.key ? 'duo' : 'line'} />{n.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

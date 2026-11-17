import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { Switch } from '@/components/ui/switch';
import { SIcon } from '@/components/ui/SIcon';
import { useTheme } from '@/hooks/useTheme';
import { useTestLang } from '@/hooks/useTestLang';
import { clearSession } from '@/hooks/useAuth';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

// Settings on the profile screen: language, theme, tariffs, legal pages, sign out.
export function SettingsCard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [lang, setLang] = useTestLang();
  const t = useT();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleLogout = () => {
    clearSession();
    navigate('/auth');
  };

  return (
    <>
      <div className="w-list mb-3">
        <Row icon="global" label={t('Тил', 'Язык')} right={
          <div className="flex rounded-xl bg-secondary p-0.5">
            {(['uz', 'ru'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={cn('h-8 w-14 rounded-[10px] text-sm font-semibold', lang === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                {l === 'uz' ? 'Ўзб' : 'Рус'}
              </button>
            ))}
          </div>
        } />
        <Row icon="moon" label={t('Тунги режим', 'Тёмная тема')} right={<Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />} />
      </div>
      <div className="w-list mb-3">
        <Row icon="document-text" label={t('Оферта', 'Оферта')} onClick={() => navigate('/oferta')} chevron />
        <Row icon="bookmark" label={t('Махфийлик сиёсати', 'Политика конфиденциальности')} onClick={() => navigate('/privacy')} chevron />
      </div>
      <div className="w-list mb-3">
        <button type="button" onClick={handleLogout} className="w-row text-destructive">
          <SIcon name="logout-2" variant="line" className="text-[1.6rem]" />
          <span className="flex-1 font-semibold text-[15px]">{t('Чиқиш', 'Выйти')}</span>
        </button>
        <button type="button" onClick={() => setDeleteOpen(true)} className="w-row text-destructive">
          <Trash2 className="w-[1.4rem] h-[1.4rem] mx-[0.1rem]" />
          <span className="flex-1 font-semibold text-[15px]">{t('Ҳисобни ўчириш', 'Удалить аккаунт')}</span>
        </button>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function Row({ icon, label, onClick, right, chevron }: { icon: string; label: string; onClick?: () => void; right?: React.ReactNode; chevron?: boolean }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp {...(onClick ? { type: 'button' as const, onClick } : {})} className="w-row">
      <SIcon name={icon} className="w-icon text-[1.6rem]" />
      <span className="flex-1 font-semibold text-[15px] text-foreground">{label}</span>
      {right}
      {chevron && <SIcon name="alt-arrow-right" variant="line" className="text-muted-foreground/60" />}
    </Comp>
  );
}

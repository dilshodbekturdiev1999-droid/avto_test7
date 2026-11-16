import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invokeFunction } from '@/integrations/supabase/functionsClient';
import { getDeviceId } from '@/lib/deviceId';
import { safeStorage } from '@/lib/safeStorage';
import { clearSession } from '@/hooks/useAuth';
import { useT } from '@/hooks/useT';
import { useToast } from '@/hooks/use-toast';

/**
 * Permanent deletion of the student's own account. It asks for the password again so a
 * phone left unlocked is not enough, and says plainly what is removed and what is kept.
 */
export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (value: boolean) => {
    if (busy) return;
    setPassword('');
    setError(null);
    onOpenChange(value);
  };

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    const { error: err } = await invokeFunction('delete-account', {
      session_token: safeStorage.getItem('session_token'),
      device_id: getDeviceId(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(
        err === 'wrong_password'
          ? t('Парол нотўғри', 'Неверный пароль')
          : err === 'network_error'
            ? t('Интернет билан алоқа йўқ', 'Нет связи с интернетом')
            : t('Ўчириб бўлмади. Кейинроқ уриниб кўринг.', 'Не удалось удалить. Попробуйте позже.'),
      );
      return;
    }
    clearSession();
    toast({ title: t('Ҳисоб ўчирилди', 'Аккаунт удалён') });
    navigate('/auth', { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Ҳисобни ўчириш', 'Удалить аккаунт')}</DialogTitle>
          <DialogDescription className="space-y-2 text-left">
            <span className="block">
              {t(
                'Натижаларингиз, хатоларингиз, сақланганларингиз ва дўстларингиз ўчирилади. Буни ортга қайтариб бўлмайди.',
                'Ваши результаты, ошибки, сохранённое и друзья будут удалены. Это нельзя отменить.',
              )}
            </span>
            <span className="block">
              {t(
                'Тўловлар ҳақидаги ёзувлар ҳисоб-китоб учун сақланади. Тўланган кириш телефон рақамига боғланган.',
                'Записи об оплатах сохраняются для учёта. Оплаченный доступ привязан к номеру телефона.',
              )}
            </span>
          </DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('Тасдиқлаш учун паролни киритинг', 'Введите пароль для подтверждения')}
        />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>
            {t('Бекор қилиш', 'Отмена')}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!password || busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            {busy ? t('Ўчирилмоқда...', 'Удаляем...') : t('Ўчириш', 'Удалить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

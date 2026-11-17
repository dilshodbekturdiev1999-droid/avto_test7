import { SIcon } from '@/components/ui/SIcon';
import { Switch } from '@/components/ui/switch';
import { TariffCheckoutDialog } from '@/components/TariffCheckoutDialog';
import { useTheme } from '@/hooks/useTheme';
import { useTestLang } from '@/hooks/useTestLang';
import { clearSession, useAccessInfo } from '@/hooks/useAuth';
const TARIFF_NAMES: Record<string, string> = { standard: 'Стандарт', pro: 'Про', max: 'Макс' };
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, X, UserPlus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { invokeFunction } from '@/integrations/supabase/functionsClient';
import { getDeviceId } from '@/lib/deviceId';
import { compressImageToJpeg, blobToBase64 } from '@/lib/imageCompress';
import { useFriendsList, useFriendSearch, useSendFriendRequest, useRespondFriendRequest } from '@/hooks/useFriends';
import { useOnlineUsers } from '@/hooks/usePresence';
import { useUserStats } from '@/hooks/useUserStats';
import { safeStorage } from '@/lib/safeStorage';
import { AccessExpiryBadge } from '@/components/AccessExpiryBadge';
import { useT } from '@/hooks/useT';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { ExamDateCard } from '@/features/celebrate/ExamDateCard';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    safeStorage.getItem('avatar_url')
  );
  const login = safeStorage.getItem('login') ?? '';
  const { data: friendsData, isLoading: friendsLoading } = useFriendsList();
  const { data: searchResults, isLoading: searchLoading } = useFriendSearch(search);
  const sendRequest = useSendFriendRequest();
  const respondRequest = useRespondFriendRequest();
  const onlineIds = useOnlineUsers();
  const { data: stats, isLoading: statsLoading } = useUserStats();
  const t = useT();
  const { theme, toggleTheme } = useTheme();
  const [testLang, setTestLang] = useTestLang();
  const access = useAccessInfo();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressImageToJpeg(file);
      const base64 = await blobToBase64(compressed);

      const { data, error } = await invokeFunction<{ avatar_url: string }>('avatar-upload', {
        session_token: safeStorage.getItem('session_token'),
        device_id: getDeviceId(),
        image_base64: base64,
      });

      if (error || !data) {
        toast({ title: t('Хатолик', 'Ошибка'), description: t('Расмни юклаб бўлмади', 'Не удалось загрузить фото'), variant: 'destructive' });
        return;
      }

      const newUrl = data.avatar_url;
      setAvatarUrl(newUrl);
      safeStorage.setItem('avatar_url', newUrl);
      toast({ title: t('Муваффақият', 'Успешно'), description: t('Расм юкланди', 'Фото загружено') });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSendRequest = (targetLogin: string) => {
    sendRequest.mutate(targetLogin, {
      onSuccess: () => toast({ title: t('Юборилди', 'Отправлено'), description: t('Дўстлик сўрови юборилди', 'Запрос в друзья отправлен') }),
      onError: () => toast({ title: t('Хатолик', 'Ошибка'), description: t('Сўровни юбориб бўлмади', 'Не удалось отправить запрос'), variant: 'destructive' }),
    });
  };

  return (
    <PageShell title={t('Профиль', 'Профиль')}>
      <div className="lg:grid lg:grid-cols-[360px_1fr] lg:gap-7 lg:items-start max-w-[1000px]">
        <div className="flex flex-col gap-3">
          <div className="sa-card p-5 flex items-center gap-3.5">
            <label className="cursor-pointer relative shrink-0">
              <Avatar className="w-[62px] h-[62px]">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="text-2xl font-bold" style={{ background: 'var(--sa-blue-soft)', color: 'var(--sa-blue)' }}>{login.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploading} />
            </label>
            <div className="min-w-0">
              <p className="sa-disp text-[21px] font-bold truncate">{login}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--sa-muted)' }}>
                {t('Расмни ўзгартириш учун аватарни босинг', 'Нажмите на аватар, чтобы сменить фото')}
              </p>
            </div>
          </div>
          <div className="sa-group p-4 flex items-center gap-3.5">
            <div className="flex-1 min-w-0">
              <b className="block">{access.tariff ? `${TARIFF_NAMES[access.tariff] ?? access.tariff} ${t('тарифи', 'тариф')}` : t('Синов даври', 'Пробный период')}</b>
              {access.expiresAt && (
                <span className="sa-num text-[13.5px]" style={{ color: 'var(--sa-muted)' }}>
                  {new Date(access.expiresAt).toLocaleDateString(testLang === 'ru' ? 'ru-RU' : 'uz-Cyrl-UZ', { day: 'numeric', month: 'long', year: 'numeric' })} {t('гача', 'до')} · {Math.max(0, Math.ceil((new Date(access.expiresAt).getTime() - Date.now()) / 86400000))} {t('кун', 'дн.')}
                </span>
              )}
            </div>
            <TariffCheckoutDialog trigger={<button type="button" className="sa-btn soft sm">{t('Узайтириш', 'Продлить')}</button>} />
          </div>
          <div className="sa-group sa-stat3">
            <div><b className="sa-num">{statsLoading ? '…' : (stats?.correct_answers ?? 0) + (stats?.wrong_answers ?? 0)}</b><small>{t('савол ечилди', 'вопросов решено')}</small></div>
            <div><b className="sa-num">{statsLoading ? '…' : `${Math.round(((stats?.correct_answers ?? 0) / Math.max(1, (stats?.correct_answers ?? 0) + (stats?.wrong_answers ?? 0))) * 100)}%`}</b><small>{t('тўғри жавоб', 'верных ответов')}</small></div>
            <div><b className="sa-num">{statsLoading ? '…' : stats?.tests_taken ?? 0}</b><small>{t('тест ечилди', 'тестов пройдено')}</small></div>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-3 lg:mt-0">
          <div className="sa-sec !my-0">{t('Ўқиш', 'Учёба')}</div>
          <ExamDateCard />
          <div className="sa-group">
            <div className="sa-li">
              <SIcon name="global" variant="line" />
              <div className="tx"><b>{t('Тил', 'Язык')}</b></div>
              <div className="sa-seg w-[150px]" style={{ padding: 2 }}>
                {(['uz', 'ru'] as const).map((l) => (
                  <button key={l} type="button" className={testLang === l ? 'on' : ''} style={{ padding: '5px 0' }} onClick={() => setTestLang(l)}>{l === 'uz' ? 'Ўзб' : 'Рус'}</button>
                ))}
              </div>
            </div>
            <div className="sa-li">
              <SIcon name="moon" variant="line" />
              <div className="tx"><b>{t('Тунги режим', 'Тёмная тема')}</b></div>
              <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
            </div>
          </div>

          <div className="sa-sec !mb-0 !mt-2">{t('Дўстлар', 'Друзья')}</div>
          <div className="grid xl:grid-cols-2 gap-3 items-start">

      <div className="sa-card p-5">
        <h2 className="sa-disp text-[17px] font-bold mb-3">{t('Дўст қидириш', 'Поиск друзей')}</h2>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Логин бўйича қидириш', 'Поиск по логину')}
          className="mb-3"
        />
        {searchLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        <div className="space-y-2">
          {(searchResults ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>{u.login.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground">{u.login}</span>
              </div>
              {u.friendship_status === 'none' && (
                <Button size="sm" variant="outline" onClick={() => handleSendRequest(u.login)}>
                  <UserPlus className="w-4 h-4 mr-1" /> {t('Қўшиш', 'Добавить')}
                </Button>
              )}
              {u.friendship_status === 'pending_sent' && (
                <span className="text-xs text-muted-foreground">{t('Сўров юборилган', 'Запрос отправлен')}</span>
              )}
              {u.friendship_status === 'pending_received' && (
                <span className="text-xs text-muted-foreground">{t('Сизга сўров бор', 'Вам пришёл запрос')}</span>
              )}
              {u.friendship_status === 'accepted' && (
                <span className="text-xs text-muted-foreground">{t('Дўстсиз', 'Вы друзья')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {friendsLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          {(friendsData?.incoming?.length ?? 0) > 0 && (
            <div className="sa-card p-5">
              <h2 className="sa-disp text-[17px] font-bold mb-3">{t('Кирувчи сўровлар', 'Входящие запросы')}</h2>
              <div className="space-y-2">
                {friendsData!.incoming.map((r) => (
                  <div key={r.friendship_id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={r.user.avatar_url ?? undefined} />
                        <AvatarFallback>{r.user.login.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">{r.user.login}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => respondRequest.mutate({ friendshipId: r.friendship_id, accept: true })}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => respondRequest.mutate({ friendshipId: r.friendship_id, accept: false })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sa-card p-5">
            <h2 className="sa-disp text-[17px] font-bold mb-3">{t('Дўстлар', 'Друзья')}</h2>
            {(friendsData?.friends?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t('Ҳали дўстларингиз йўқ', 'У вас пока нет друзей')}</p>
            ) : (
              <div className="space-y-2">
                {friendsData!.friends.map((f) => {
                  const isOnline = onlineIds.has(f.id);
                  return (
                    <div key={f.id} className="flex items-center gap-2">
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={f.avatar_url ?? undefined} />
                          <AvatarFallback>{f.login.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                            isOnline ? 'bg-green-500' : 'bg-muted-foreground/40'
                          }`}
                        />
                      </div>
                      <span className="text-sm text-foreground">{f.login}</span>
                      <span className="text-xs text-muted-foreground">{isOnline ? t('онлайн', 'онлайн') : t('офлайн', 'офлайн')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
                </div>

          <div className="sa-sec !mb-0 !mt-2">{t('Бошқа', 'Другое')}</div>
          <div className="sa-group">
            <button type="button" className="sa-li" onClick={() => navigate('/oferta')}><SIcon name="document" variant="line" /><div className="tx"><b>{t('Оферта', 'Оферта')}</b></div><SIcon name="alt-arrow-right" variant="line" className="chev" /></button>
            <button type="button" className="sa-li" onClick={() => navigate('/privacy')}><SIcon name="shield-check" variant="line" /><div className="tx"><b>{t('Махфийлик сиёсати', 'Политика конфиденциальности')}</b></div><SIcon name="alt-arrow-right" variant="line" className="chev" /></button>
            <button type="button" className="sa-li" onClick={() => { clearSession(); navigate('/auth'); }} style={{ color: 'var(--sa-bad)' }}>
              <span className="flex text-2xl"><SIcon name="logout-2" variant="line" /></span><div className="tx"><b>{t('Чиқиш', 'Выйти')}</b></div>
            </button>
          </div>
          <button type="button" onClick={() => setDeleteOpen(true)} className="text-sm py-1.5" style={{ color: 'var(--sa-faint)' }}>
            {t('Ҳисобни ўчириш', 'Удалить аккаунт')}
          </button>
        </div>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </PageShell>
  );
};

export default ProfilePage;

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getMistakeIds, getSavedCount, useStudyVersion } from '@/features/study/studyState';
import { celebrateAllLessonsOnce, celebrateExamDayIfDue, getExamDate } from '@/features/celebrate/celebrate';
import { useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SIcon } from '@/components/ui/SIcon';
import { TabBar } from '@/components/TabBar';
import { YAKUNIY_PATH } from '@/features/nav/routes';
import { Logo } from '@/components/landing/Logo';
import { useLessons, useAllTopics } from '@/hooks/useSupabase';
import { getActiveTopic, getTopicProgress, isTopicUnlocked, useProgressVersion } from '@/lib/progress';
import { useAccessInfo, useFullAccess } from '@/hooks/useAuth';
import { useFriendsList } from '@/hooks/useFriends';
import { useDuelList } from '@/hooks/useDuels';
import { useTestLang } from '@/hooks/useTestLang';
import { useT } from '@/hooks/useT';
import { AccessExpiryBadge } from '@/components/AccessExpiryBadge';
import { safeStorage } from '@/lib/safeStorage';

const TARIFF_LABELS: Record<string, string> = { standard: 'Стандарт', pro: 'Про', max: 'Макс' };

// Where the green "Continue" tile should go: the topic the student was in the
// middle of, otherwise the first unfinished topic they are allowed to open.
function useContinueTarget(): { to: string; label: string | null } {
  const { data: lessons } = useLessons();
  const { data: allTopics } = useAllTopics();
  const fullAccess = useFullAccess();
  const { trialExpiresAt } = useAccessInfo();
  useProgressVersion();

  if (!lessons || !allTopics) return { to: '/lessons', label: null };

  const active = getActiveTopic();
  const activeTopic = active ? allTopics.find((tp) => tp.id === active) : undefined;
  if (activeTopic && !getTopicProgress(activeTopic.id)?.completed) {
    return { to: `/test/${activeTopic.id}`, label: activeTopic.title_uz_cyr };
  }

  const trialExpired = !fullAccess && !!trialExpiresAt && new Date(trialExpiresAt).getTime() < Date.now();
  for (let i = 0; i < lessons.length; i++) {
    // Same access rule as the lessons list: trial students only get lesson 1.
    if (!(fullAccess || (i === 0 && !trialExpired))) continue;
    const topics = allTopics
      .filter((tp) => tp.lesson_id === lessons[i].id)
      .sort((a, b) => a.order_index - b.order_index);
    const next = topics.find((tp) => !getTopicProgress(tp.id)?.completed && isTopicUnlocked(tp.id, allTopics, lessons));
    if (next) return { to: `/lesson/${lessons[i].id}`, label: next.title_uz_cyr };
  }
  return { to: '/lessons', label: null };
}

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useProgressVersion();
  const { isError } = useLessons();
  const { data: allTopics } = useAllTopics();
  const { data: friendsData } = useFriendsList();
  const { data: duelData } = useDuelList();
  const fullAccess = useFullAccess();
  const { tariff } = useAccessInfo();
  const [testLang] = useTestLang();
  const t = useT();
  const cont = useContinueTarget();

  const login = safeStorage.getItem('login') ?? '';
  const avatarUrl = safeStorage.getItem('avatar_url');
  const totalTopics = allTopics?.length ?? 0;
  const completedTopics = allTopics?.filter((tp) => getTopicProgress(tp.id)?.completed).length ?? 0;
  const overallPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  useEffect(() => {
    if (totalTopics > 0 && overallPct >= 100) celebrateAllLessonsOnce();
    else celebrateExamDayIfDue();
  }, [overallPct, totalTopics]);
  const duelInvites = duelData?.incoming?.length ?? 0;
  useStudyVersion();
  const mistakeCount = getMistakeIds().length;
  const savedCount = getSavedCount();
  const friendRequests = friendsData?.incoming?.length ?? 0;

  const statusLabel = fullAccess
    ? tariff
      ? `${t('Тариф', 'Тариф')} ${TARIFF_LABELS[tariff] ?? tariff}`
      : t('Тўлиқ доступ', 'Полный доступ')
    : t('Синов даври', 'Пробный период');

  const examDate = getExamDate();
  const today = new Date(new Date().toDateString()).getTime();
  const daysLeft = examDate ? Math.ceil((new Date(examDate + 'T00:00:00').getTime() - today) / 86400000) : null;
  const examLabel = examDate ? new Date(examDate + 'T00:00:00').toLocaleDateString(testLang === 'ru' ? 'ru-RU' : 'uz-Cyrl-UZ', { day: 'numeric', month: 'short' }) : '';
  const continueLabel = cont.label ?? t('Тест ечишни бошланг', 'Начните решать тесты');
  const actions: { icon: string; title: string; sub: ReactNode; to: string }[] = [
    { icon: 'book-2', title: t('Дарслар', 'Уроки'), sub: `${completedTopics} / ${totalTopics} ${t('мавзу', 'тем')}`, to: '/lessons' },
    {
      icon: 'close-square', title: t('Хатоларим', 'Мои ошибки'), to: '/mistakes',
      sub: mistakeCount > 0 ? <><b className="text-destructive font-semibold">{mistakeCount} {t('та', 'шт.')}</b> · {t('қайта еч', 'перерешать')}</> : t('Ҳозирча йўқ', 'Пока нет'),
    },
    { icon: 'shuffle', title: t('1200+ савол', '1200+ вопросов'), sub: t('Аралаш ёки тартиб', 'Вперемешку'), to: '/all-questions' },
    { icon: 'flag', title: t('Якуний тест', 'Итоговый тест'), sub: t('20 – 200 савол', '20 – 200 вопросов'), to: YAKUNIY_PATH },
    {
      icon: 'cup-star', title: t('Турнир', 'Турнир'), to: '/leaderboard',
      sub: duelInvites > 0 ? <b className="text-destructive font-semibold">{duelInvites} {t('таклиф', 'вызов')}</b> : t('Рақиб билан', 'С соперником'),
    },
    { icon: 'signpost-2', title: t('Белгилар', 'Знаки'), sub: t('248 та · изоҳ', '248 · описание'), to: '/foydali-malumotlar' },
  ];
  const infoRows = [
    { icon: 'notes', title: t('Шпаргалкалар', 'Шпаргалки'), val: '9', to: '/cheat-sheets' },
    { icon: 'map-point', title: t('Имтиҳон марказлари', 'Экзаменационные центры'), val: '14', to: '/exam-centers' },
    { icon: 'bookmark', title: t('Сақланганлар', 'Сохранённые'), val: String(savedCount), to: '/saved' },
  ];
  return (
    <div className="min-h-screen w-with-tabs">
      <div className="max-w-2xl mx-auto px-4" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <header className="h-12 flex items-center gap-2 mb-1.5">
          <Logo height={22} />
          <div className="flex-1" />
          <button type="button" onClick={() => navigate('/search')} aria-label={t('Қидирув', 'Поиск')} className="w-10 h-10 rounded-full w-card flex items-center justify-center text-foreground w-press">
            <SIcon name="magnifer" variant="line" className="text-xl" />
          </button>
          <button type="button" onClick={() => navigate('/profile')} aria-label={t('Профиль', 'Профиль')} className="relative shrink-0 w-press">
            <Avatar className="w-10 h-10">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="font-semibold bg-card text-foreground">{login.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            {friendRequests > 0 && <Dot />}
          </button>
        </header>

        <section className="w-hero px-[18px] pt-3 pb-4">
          <p className="text-sm opacity-80">{t('Имтиҳонга тайёргарлик', 'Готовность к экзамену')}</p>
          <div className="flex items-end justify-between mt-0.5 mb-3.5">
            <p className="w-num text-[3.25rem] font-extrabold leading-none tracking-[-0.045em]">{overallPct}%</p>
            {daysLeft !== null && daysLeft >= 0 ? (
              <button type="button" onClick={() => navigate('/profile')} className="text-right pb-1">
                <span className="block w-num text-[1.375rem] font-bold leading-tight">{daysLeft} {t('кун', 'дн.')}</span>
                <span className="block text-xs opacity-75">{t('имтиҳонгача', 'до экзамена')} · {examLabel}</span>
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/profile')} className="text-right pb-1 text-xs opacity-85 underline underline-offset-2">
                {t('Имтиҳон кунини белгиланг', 'Укажите дату экзамена')}
              </button>
            )}
          </div>
          <div className="w-ticks" role="progressbar" aria-valuenow={overallPct} aria-valuemin={0} aria-valuemax={100}>
            {Array.from({ length: Math.max(totalTopics, 1) }, (_, k) => <i key={k} className={k < completedTopics ? 'd' : ''} />)}
          </div>
          <div className="flex justify-between text-xs opacity-80 mt-2 w-num">
            <span>{completedTopics} / {totalTopics} {t('мавзу', 'тем')}</span>
            <span>{statusLabel}</span>
          </div>
        </section>

        <button type="button" onClick={() => navigate(cont.to)} className="w-card-lg w-press mt-3 w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-muted-foreground">{t('Давом этиш', 'Продолжить')}</span>
            <span className="block w-h2 text-lg text-foreground truncate">{continueLabel}</span>
          </span>
          <span className="w-[3.25rem] h-[3.25rem] rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_8px_18px_-10px_hsl(var(--primary))]">
            <SIcon name="play" variant="bold" className="text-[1.375rem]" />
          </span>
        </button>
        <div className="mt-2"><AccessExpiryBadge /></div>

        <div className="w-acts mt-1">
          {actions.map((a) => (
            <button key={a.title} type="button" onClick={() => navigate(a.to)} className="w-act">
              <SIcon name={a.icon} className="w-icon text-[2rem]" />
              <span className="min-w-0 flex-1"><b>{a.title}</b><small>{a.sub}</small></span>
            </button>
          ))}
        </div>

        <div className="w-sec"><b>{t('Маълумот', 'Справка')}</b></div>
        <div className="w-list">
          {infoRows.map((r) => (
            <button key={r.to} type="button" onClick={() => navigate(r.to)} className="w-row">
              <SIcon name={r.icon} className="w-icon text-[1.6rem]" />
              <span className="flex-1 font-semibold text-[15px] text-foreground">{r.title}</span>
              <span className="text-sm text-muted-foreground w-num">{r.val}</span>
              <SIcon name="alt-arrow-right" variant="line" className="text-muted-foreground/60" />
            </button>
          ))}
        </div>
        {isError && (
          <button type="button" onClick={() => queryClient.refetchQueries()} className="mt-4 w-full text-sm text-primary font-medium">
            {t('Маълумотларни қайта юклаш', 'Загрузить данные заново')}
          </button>
        )}
      </div>
      <TabBar />
    </div>
  );
};

function Dot() {
  return <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive border-2 border-background" />;
}

export default Index;

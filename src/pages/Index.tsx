import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SiteShell } from '@/components/site/SiteShell';
import { SIcon } from '@/components/ui/SIcon';
import { useLessons, useAllTopics } from '@/hooks/useSupabase';
import { getActiveTopic, getProgress, getTopicProgress, isTopicUnlocked, useProgressVersion } from '@/lib/progress';
import { useAccessInfo, useFullAccess } from '@/hooks/useAuth';
import { useDuelList } from '@/hooks/useDuels';
import { useUserStats } from '@/hooks/useUserStats';
import { useT } from '@/hooks/useT';
import { getMistakeIds, getSavedCount, useStudyVersion } from '@/features/study/studyState';
import { celebrateAllLessonsOnce, celebrateExamDayIfDue } from '@/features/celebrate/celebrate';
import { useExamDate } from '@/features/celebrate/examDateSync';
import { YAKUNIY_PATH } from '@/features/nav/routes';
import { safeStorage } from '@/lib/safeStorage';

// Where «Давом этиш» goes: the topic the student was in, otherwise the first open unfinished topic.
function useContinueTarget(): { to: string; label: string | null } {
  const { data: lessons } = useLessons();
  const { data: allTopics } = useAllTopics();
  const fullAccess = useFullAccess();
  const { trialExpiresAt } = useAccessInfo();
  useProgressVersion();
  if (!lessons || !allTopics) return { to: '/lessons', label: null };
  const active = getActiveTopic();
  const activeTopic = active ? allTopics.find((tp) => tp.id === active) : undefined;
  if (activeTopic && !getTopicProgress(activeTopic.id)?.completed) return { to: `/test/${activeTopic.id}`, label: activeTopic.title_uz_cyr };
  const trialExpired = !fullAccess && !!trialExpiresAt && new Date(trialExpiresAt).getTime() < Date.now();
  for (let i = 0; i < lessons.length; i++) {
    if (!(fullAccess || (i === 0 && !trialExpired))) continue;
    const topics = allTopics.filter((tp) => tp.lesson_id === lessons[i].id).sort((a, b) => a.order_index - b.order_index);
    const next = topics.find((tp) => !getTopicProgress(tp.id)?.completed && isTopicUnlocked(tp.id, allTopics, lessons));
    if (next) return { to: `/lesson/${lessons[i].id}`, label: `${i + 1}-дарс · ${next.title_uz_cyr}` };
  }
  return { to: '/lessons', label: null };
}

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useT();
  useProgressVersion();
  useStudyVersion();
  const { isError } = useLessons();
  const { data: allTopics } = useAllTopics();
  const { data: duelData } = useDuelList();
  const { data: stats } = useUserStats();
  const cont = useContinueTarget();

  const login = safeStorage.getItem('login') ?? '';
  const total = allTopics?.length ?? 0;
  const done = allTopics?.filter((tp) => getTopicProgress(tp.id)?.completed).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  useEffect(() => {
    if (total > 0 && pct >= 100) celebrateAllLessonsOnce();
    else celebrateExamDayIfDue();
  }, [pct, total]);
  const answered = stats ? stats.correct_answers + stats.wrong_answers : null;
  const examDate = useExamDate();
  const daysLeft = examDate ? Math.ceil((new Date(`${examDate}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
  const mistakes = getMistakeIds().length;
  const invites = duelData?.incoming?.length ?? 0;

  // «Ечилган мавзулар»: topics with a result. The server keeps only the best score per topic (no dates),
  // so this replaces the mock's «Охирги тестлар» list, which would need a dated history we do not store.
  const progress = getProgress();
  const tried = (allTopics ?? [])
    .filter((tp) => (progress[tp.id]?.bestScore ?? 0) > 0)
    .sort((a, b) => Number(!!progress[a.id]?.completed) - Number(!!progress[b.id]?.completed))
    .slice(0, 3);

  const hero = (
    <div className="sa-card p-[18px] lg:p-[26px] lg:h-full flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--sa-muted)' }} className="text-sm">{t('Имтиҳонга тайёргарлик', 'Готовность к экзамену')}</span>
        {daysLeft !== null && daysLeft >= 0 ? (
          <button type="button" onClick={() => navigate('/profile')} className="flex items-center gap-1 text-[13.5px] font-semibold" style={{ color: 'var(--sa-blue)' }}>
            <SIcon name="calendar" variant="line" className="text-base" />{daysLeft} {t('кун қолди', 'дн. осталось')}
          </button>
        ) : (
          <button type="button" onClick={() => navigate('/profile')} className="text-[13.5px] font-medium" style={{ color: 'var(--sa-blue)' }}>
            {t('Имтиҳон кунини белгиланг', 'Укажите дату экзамена')}
          </button>
        )}
      </div>
      <div className="sa-num text-[58px] lg:text-[84px] font-semibold leading-none tracking-[-0.05em] mt-2.5 mb-3.5">
        {pct}<span className="text-[26px] lg:text-[36px] ml-0.5" style={{ color: 'var(--sa-muted)' }}>%</span>
      </div>
      <div>
        <div className="sa-bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="sa-num text-[13.5px] mt-[9px] mb-4" style={{ color: 'var(--sa-muted)' }}>
          {done} / {total} {t('мавзу', 'тем')}{answered !== null ? ` · ${answered} ${t('савол', 'вопросов')}` : ''}
        </div>
        <button type="button" onClick={() => navigate(cont.to)} className="w-full flex items-center gap-2.5 h-14 px-4 rounded-[14px] text-left text-white" style={{ background: 'var(--sa-blue)' }}>
          <SIcon name="play" variant="duo" className="text-xl" />
          <span className="flex-1 min-w-0 leading-tight">
            <b className="block font-semibold">{t('Давом этиш', 'Продолжить')}</b>
            <span className="block text-[12.5px] opacity-80 truncate">{cont.label ?? t('Тест ечишни бошланг', 'Начните решать тесты')}</span>
          </span>
          <SIcon name="alt-arrow-right" variant="line" />
        </button>
      </div>
    </div>
  );

  const four = (
    <div className="sa-b3grid">
      {[
        { icon: 'book-2', title: t('Дарслар', 'Уроки'), sub: `${done} / ${total} ${t('мавзу', 'тем')}`, to: '/lessons', cnt: 0 },
        { icon: 'close-circle', title: t('Хатоларим', 'Мои ошибки'), sub: t('Тўғри ечмагунча', 'Пока не решите верно'), to: '/mistakes', cnt: mistakes },
        { icon: 'flag', title: t('Якуний тест', 'Итоговый тест'), sub: '20 · 50 · 100 · 200', to: YAKUNIY_PATH, cnt: 0 },
        { icon: 'cup-star', title: t('Турнир', 'Турнир'), sub: invites > 0 ? `${invites} ${t('таклиф', 'вызов')}` : t('Тасодифий рақиб', 'Случайный соперник'), to: '/leaderboard', cnt: 0 },
      ].map((b) => (
        <button key={b.to} type="button" className="sa-b3" onClick={() => navigate(b.to)}>
          <SIcon name={b.icon} variant="duo" />
          {b.cnt > 0 && <span className="sa-cnt sa-num">{b.cnt}</span>}
          <span><b>{b.title}</b><small>{b.sub}</small></span>
        </button>
      ))}
    </div>
  );

  const triedList = (
    <div className="sa-group">
      {tried.length === 0 ? (
        <div className="sa-li noic"><div className="tx"><small>{t('Ҳали тест ечилмаган', 'Тестов пока нет')}</small></div></div>
      ) : tried.map((tp) => {
        const p = progress[tp.id];
        return (
          <button key={tp.id} type="button" className="sa-li noic" onClick={() => navigate(`/test/${tp.id}`)}>
            <div className="tx"><b>{tp.title_uz_cyr}</b><small>{p?.completed ? t('Ўтилди', 'Пройдено') : t('Ўтиш учун 95% керак', 'Нужно 95%')}</small></div>
            <b className="sa-num font-bold" style={{ color: p?.completed ? 'var(--sa-ok)' : 'var(--sa-bad)' }}>{p?.bestScore ?? 0}%</b>
          </button>
        );
      })}
    </div>
  );

  const infoRows = (
    <div className="sa-group">
      {[
        { icon: 'signpost-2', title: t('Йўл белгилари', 'Дорожные знаки'), val: `248 ${t('та', '')}`, to: '/foydali-malumotlar' },
        { icon: 'notes', title: t('Шпаргалкалар', 'Шпаргалки'), val: `9 ${t('та', '')}`, to: '/cheat-sheets' },
        { icon: 'map-point', title: t('Имтиҳон марказлари', 'Экзаменационные центры'), val: `14 ${t('та', '')}`, to: '/exam-centers' },
        { icon: 'bookmark', title: t('Сақланганлар', 'Сохранённые'), val: `${getSavedCount()} ${t('та', '')}`, to: '/saved' },
      ].map((r) => (
        <button key={r.to} type="button" className="sa-li" onClick={() => navigate(r.to)}>
          <SIcon name={r.icon} variant="duo" />
          <div className="tx"><b>{r.title}</b></div>
          <span className="val sa-num">{r.val}</span>
          <SIcon name="alt-arrow-right" variant="line" className="chev" />
        </button>
      ))}
    </div>
  );

  // the Avtodrom tile opens at once: fetch the game in the background after the page settles
  useEffect(() => {
    const id = window.setTimeout(() => {
      void import('@/game/warm').then((m) => m.warmUpAvtodrom());
    }, 800);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <SiteShell tab="home" title={t('Асосий', 'Главная')} deskTitle={`${t('Хайрли кун', 'Добрый день')}, ${login}`}>
      {isError && (
        <button type="button" onClick={() => queryClient.refetchQueries()} className="mb-3 text-sm font-medium" style={{ color: 'var(--sa-blue)' }}>
          {t('Маълумотларни юклаб бўлмади — қайта уриниш', 'Не удалось загрузить данные — повторить')}
        </button>
      )}
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-2.5 lg:gap-4 items-stretch">
        {hero}
        <div className="flex flex-col gap-2.5">
          {four}
          <button type="button" className="sa-b3 sa-wide" onClick={() => navigate('/avtodrom')}>
            <SIcon name="wheel" variant="duo" />
            <span className="flex-1 min-w-0"><b>{t('Автодром', 'Автодром')}</b><small>{t('B ва C тоифа · амалий имтиҳон жарима баллари билан', 'Категории B и C · практический экзамен со штрафами')}</small></span>
            <SIcon name="alt-arrow-right" variant="line" className="chev" />
          </button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-x-4">
        <div className="hidden lg:block">
          <div className="sa-sec"><span>{t('Ечилган мавзулар', 'Решённые темы')}</span><button type="button" onClick={() => navigate('/lessons')}>{t('Барчаси', 'Все')}</button></div>
          {triedList}
        </div>
        <div>
          <div className="sa-sec">{t('Маълумот', 'Справка')}</div>
          {infoRows}
        </div>
      </div>
    </SiteShell>
  );
};

export default Index;

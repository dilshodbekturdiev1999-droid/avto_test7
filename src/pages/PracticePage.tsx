import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { SIcon } from '@/components/ui/SIcon';
import { getMistakeIds, useStudyVersion } from '@/features/study/studyState';
import { useDuelList } from '@/hooks/useDuels';
import { useT } from '@/hooks/useT';
import { YAKUNIY_PATH } from '@/features/nav/routes';

// «Машқ» tab: every way to practise, in one place. Only links to existing screens.
const PracticePage = () => {
  const navigate = useNavigate();
  const t = useT();
  useStudyVersion();
  const mistakes = getMistakeIds().length;
  const { data: duelData } = useDuelList();
  const invites = duelData?.incoming?.length ?? 0;

  return (
    <PageShell title={t('Машқ', 'Практика')} tab>
      <div className="w-acts">
        <button type="button" className="w-act" onClick={() => navigate('/all-questions')}>
          <SIcon name="shuffle" className="w-icon text-[2rem]" />
          <span className="min-w-0 flex-1"><b>{t('1200+ савол', '1200+ вопросов')}</b><small>{t('Аралаш ёки тартиб', 'Вперемешку')}</small></span>
        </button>
        <button type="button" className="w-act" onClick={() => navigate('/mistakes')}>
          <SIcon name="close-square" className="w-icon text-[2rem]" />
          <span className="min-w-0 flex-1"><b>{t('Хатоларим', 'Мои ошибки')}</b>
            <small>{mistakes > 0 ? <><b className="inline text-destructive font-semibold text-xs">{mistakes} {t('та', 'шт.')}</b> · {t('қайта еч', 'перерешать')}</> : t('Ҳозирча йўқ', 'Пока нет')}</small></span>
        </button>
      </div>

      <button type="button" onClick={() => navigate(YAKUNIY_PATH)} className="w-card w-press mt-2.5 w-full p-4 flex items-center gap-3 text-left">
        <SIcon name="flag" className="w-icon text-[2.25rem]" />
        <span className="min-w-0 flex-1">
          <span className="block w-h2 text-[17px] text-foreground">{t('Якуний тест', 'Итоговый тест')}</span>
          <span className="block text-[13px] text-muted-foreground">{t('Имтиҳон шаклида · 20, 50, 100 ёки 200 савол', 'Как на экзамене · 20, 50, 100 или 200 вопросов')}</span>
        </span>
        <span className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center">{t('Бошлаш', 'Начать')}</span>
      </button>

      <div className="w-sec"><b>{t('Беллашув', 'Соревнование')}</b></div>
      <div className="w-list">
        <button type="button" className="w-row" onClick={() => navigate('/leaderboard')}>
          <SIcon name="cup-star" className="w-icon text-[1.6rem]" />
          <span className="flex-1 py-2.5"><span className="block font-semibold text-[15px] text-foreground">{t('Турнир', 'Турнир')}</span>
            <span className="block text-[13px] text-muted-foreground">{t('Тасодифий рақиб ёки дўст', 'Случайный соперник или друг')}</span></span>
          {invites > 0 && <span className="h-6 min-w-6 px-2 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">{invites}</span>}
          <SIcon name="alt-arrow-right" variant="line" className="text-muted-foreground/60" />
        </button>
      </div>
    </PageShell>
  );
};

export default PracticePage;

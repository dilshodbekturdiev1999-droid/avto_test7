import { useNavigate } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { SIcon } from '@/components/ui/SIcon';
import { getMistakeIds, useStudyVersion } from '@/features/study/studyState';
import { useDuelList } from '@/hooks/useDuels';
import { useT } from '@/hooks/useT';
import { YAKUNIY_PATH } from '@/features/nav/routes';

// «Машқ»: questions on the left (1200+, mistakes, final test), competition on the right.
// The final test's 20/50/100/200 choice is made on its own start screen.
const PracticePage = () => {
  const navigate = useNavigate();
  const t = useT();
  useStudyVersion();
  const mistakes = getMistakeIds().length;
  const { data: duelData } = useDuelList();
  const invites = duelData?.incoming?.length ?? 0;

  return (
    <SiteShell tab="practice" title={t('Машқ', 'Практика')}>
      <div className="lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-6 lg:items-start max-w-[980px]">
        <div>
          <div className="sa-sec lg:mt-0">{t('Саволлар', 'Вопросы')}</div>
          <div className="sa-group">
            <button type="button" className="sa-li" onClick={() => navigate('/all-questions')}>
              <SIcon name="shuffle" variant="line" />
              <div className="tx"><b>{t('1200+ савол', '1200+ вопросов')}</b><small>{t('Аралаш ёки тартиб билан', 'Вперемешку или по порядку')}</small></div>
              <span className="val sa-num">1304</span>
              <SIcon name="alt-arrow-right" variant="line" className="chev" />
            </button>
            <button type="button" className="sa-li" onClick={() => navigate('/mistakes')}>
              <SIcon name="close-circle" variant="line" />
              <div className="tx"><b>{t('Хатоларим', 'Мои ошибки')}</b><small>{t('Тўғри ечмагунча қолади', 'Остаются, пока не решите верно')}</small></div>
              {mistakes > 0 && <span className="sa-cnt sa-num">{mistakes}</span>}
              <SIcon name="alt-arrow-right" variant="line" className="chev" />
            </button>
            <button type="button" className="sa-li" onClick={() => navigate(YAKUNIY_PATH)}>
              <SIcon name="flag" variant="line" />
              <div className="tx"><b>{t('Якуний тест', 'Итоговый тест')}</b><small>{t('Имтиҳон шаклида · 20, 50, 100 ёки 200 савол', 'Как на экзамене · 20, 50, 100 или 200 вопросов')}</small></div>
              <span className="sa-btn blue sm" style={{ height: 34, borderRadius: 17 }}>{t('Бошлаш', 'Начать')}</span>
            </button>
          </div>
        </div>
        <div>
          <div className="sa-sec lg:mt-0">{t('Беллашув', 'Соревнование')}</div>
          <div className="sa-group">
            <button type="button" className="sa-li" onClick={() => navigate('/leaderboard')}>
              <SIcon name="cup-star" variant="line" />
              <div className="tx"><b>{t('Турнир', 'Турнир')}</b><small>{invites > 0 ? `${invites} ${t('таклиф', 'вызов')}` : t('Тасодифий рақиб ёки дўст', 'Случайный соперник или друг')}</small></div>
              {invites > 0 && <span className="sa-cnt sa-num">{invites}</span>}
              <SIcon name="alt-arrow-right" variant="line" className="chev" />
            </button>
          </div>
          <div className="sa-sec">{t('Амалий имтиҳон', 'Практический экзамен')}</div>
          <div className="sa-group">
            <button type="button" className="sa-li" onClick={() => navigate('/avtodrom')}>
              <SIcon name="wheel" variant="line" />
              <div className="tx"><b>{t('Автодром', 'Автодром')}</b><small>{t('B ва C тоифа · жарима баллари билан', 'Категории B и C · со штрафными баллами')}</small></div>
              <SIcon name="alt-arrow-right" variant="line" className="chev" />
            </button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
};

export default PracticePage;

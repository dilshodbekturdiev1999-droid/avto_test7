import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { SIcon } from '@/components/ui/SIcon';
import { getSavedCount, useStudyVersion } from '@/features/study/studyState';
import { useT } from '@/hooks/useT';

// «Маълумот» tab: reference material and search.
const InfoPage = () => {
  const navigate = useNavigate();
  const t = useT();
  useStudyVersion();
  const rows = [
    { icon: 'signpost-2', title: t('Йўл белгилари', 'Дорожные знаки'), val: '248', to: '/foydali-malumotlar' },
    { icon: 'notes', title: t('Шпаргалкалар', 'Шпаргалки'), val: '9', to: '/cheat-sheets' },
    { icon: 'map-point', title: t('Имтиҳон марказлари', 'Экзаменационные центры'), val: '14', to: '/exam-centers' },
    { icon: 'bookmark', title: t('Сақланганлар', 'Сохранённые'), val: String(getSavedCount()), to: '/saved' },
  ];
  return (
    <PageShell title={t('Маълумот', 'Справка')} tab>
      <button type="button" onClick={() => navigate('/search')} className="w-card w-press w-full h-12 px-4 mb-3 flex items-center gap-2.5 text-muted-foreground text-[15px]">
        <SIcon name="magnifer" variant="line" className="text-xl text-foreground" />
        {t('Савол, белги ёки мавзу', 'Вопрос, знак или тема')}
      </button>
      <div className="w-list">
        {rows.map((r) => (
          <button key={r.to} type="button" onClick={() => navigate(r.to)} className="w-row">
            <SIcon name={r.icon} className="w-icon text-[1.6rem]" />
            <span className="flex-1 font-semibold text-[15px] text-foreground">{r.title}</span>
            <span className="text-sm text-muted-foreground w-num">{r.val}</span>
            <SIcon name="alt-arrow-right" variant="line" className="text-muted-foreground/60" />
          </button>
        ))}
      </div>
    </PageShell>
  );
};

export default InfoPage;

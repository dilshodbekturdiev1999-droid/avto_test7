import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { SIcon } from '@/components/ui/SIcon';
import { useTrafficSigns } from '@/hooks/useSupabase';
import { getSavedCount, useStudyVersion } from '@/features/study/studyState';
import { useT } from '@/hooks/useT';

const CATS = [
  { key: 'all', uz: 'Барчаси', ru: 'Все', cat: null },
  { key: 'warn', uz: 'Огоҳлантирувчи', ru: 'Предупреждающие', cat: 'Ogohlantiruvchi belgilar' },
  { key: 'ban', uz: 'Тақиқловчи', ru: 'Запрещающие', cat: 'Taqiqlovchi belgilar' },
] as const;

// «Маълумот»: reference list on the left, road signs on the right (phone: list, then a few signs).
const InfoPage = () => {
  const navigate = useNavigate();
  const t = useT();
  useStudyVersion();
  const { data: signs } = useTrafficSigns();
  const [cat, setCat] = useState<(typeof CATS)[number]['key']>('all');
  const chosen = CATS.find((c) => c.key === cat)!;
  const shown = (signs ?? []).filter((s) => s.image_url && (!chosen.cat || s.category === chosen.cat)).slice(0, 12);

  const rows = [
    { icon: 'signpost-2', title: t('Йўл белгилари', 'Дорожные знаки'), val: `${signs?.length ?? 248} ${t('та', '')}`, to: '/foydali-malumotlar' },
    { icon: 'notes', title: t('Шпаргалкалар', 'Шпаргалки'), val: `9 ${t('та', '')}`, to: '/cheat-sheets' },
    { icon: 'map-point', title: t('Имтиҳон марказлари', 'Экзаменационные центры'), val: `14 ${t('та', '')}`, to: '/exam-centers' },
    { icon: 'bookmark', title: t('Сақланганлар', 'Сохранённые'), val: `${getSavedCount()} ${t('та', '')}`, to: '/saved' },
    { icon: 'magnifer', title: t('Қидирув', 'Поиск'), val: t('Савол ва жавоблар', 'Вопросы и ответы'), to: '/search' },
  ];

  return (
    <SiteShell tab="info" title={t('Маълумот', 'Справка')}>
      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-7 lg:items-start">
        <div>
          <div className="sa-field lg:hidden mb-3" style={{ background: 'var(--sa-card)' }} onClick={() => navigate('/search')} role="button" tabIndex={0}>
            <SIcon name="magnifer" variant="line" />{t('Савол, белги ёки мавзу', 'Вопрос, знак или тема')}
          </div>
          <div className="sa-group">
            {rows.map((r) => (
              <button key={r.to} type="button" className="sa-li" onClick={() => navigate(r.to)}>
                <SIcon name={r.icon} variant="duo" />
                <div className="tx"><b>{r.title}</b></div>
                <span className="val sa-num">{r.val}</span>
                <SIcon name="alt-arrow-right" variant="line" className="chev" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-[22px] lg:mt-0 mb-3 px-1 lg:px-0">
            <div className="sa-disp text-xl font-bold">{t('Йўл белгилари', 'Дорожные знаки')} <span className="text-[15px] font-medium" style={{ color: 'var(--sa-muted)' }}>{signs?.length ?? ''} {t('та', '')}</span></div>
            <div className="sa-seg w-full lg:w-[440px]">
              {CATS.map((c) => (
                <button key={c.key} type="button" className={cat === c.key ? 'on' : ''} onClick={() => setCat(c.key)}>{t(c.uz, c.ru)}</button>
              ))}
            </div>
          </div>
          <div className="sa-sgrid">
            {shown.map((s) => (
              <button key={s.id} type="button" className="sa-sg" onClick={() => navigate('/foydali-malumotlar')}>
                <img src={s.image_url!} alt={s.title} loading="lazy" />
                <b className="sa-num">{s.number}</b>
                <small>{s.title}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  );
};

export default InfoPage;

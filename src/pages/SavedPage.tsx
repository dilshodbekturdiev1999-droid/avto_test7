import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronRight } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { useT } from '@/hooks/useT';
import { useTrafficSigns } from '@/hooks/useSupabase';
import { cn } from '@/lib/utils';
import { getSavedKeys, useStudyVersion } from '@/features/study/studyState';
import { QuestionPreview } from '@/features/study/QuestionPreview';
import { SaveButton } from '@/features/study/SaveButton';
import { useQuestionEntries } from '@/features/study/useQuestionEntries';
import { CHEAT_SHEETS } from '@/features/cheatsheets/cheatsheets';
import { SheetIconBadge } from '@/features/cheatsheets/SheetIconBadge';
import { SHEET_RU } from '@/features/cheatsheets/ru';
import { useTestLang } from '@/hooks/useTestLang';

type Tab = 'question' | 'sign' | 'cheatsheet';

/**
 * Everything the student bookmarked, to show the teacher at the next lesson.
 * It only shows the material (picture, question, right answer, where it comes
 * from); it is not a place to solve it.
 */
const SavedPage = () => {
  const t = useT();
  const navigate = useNavigate();
  const [lang] = useTestLang();
  const tr = (s: string) => (lang === 'ru' ? SHEET_RU[s] ?? s : s);
  useStudyVersion();
  const [tab, setTab] = useState<Tab>('question');
  const questionIds = getSavedKeys('question');
  const signIds = getSavedKeys('sign');
  const sheetIds = getSavedKeys('cheatsheet');
  const savedSheets = sheetIds.map((id) => CHEAT_SHEETS.find((s) => s.id === id)).filter((s) => !!s);
  const { entries, loading } = useQuestionEntries(questionIds);
  const { data: signs } = useTrafficSigns();
  const signKey = signIds.join(',');
  const savedSigns = useMemo(() => {
    const byId = new Map((signs ?? []).map((s) => [s.id, s]));
    return signKey
      .split(',')
      .filter(Boolean)
      .map((id) => byId.get(id))
      .filter((s): s is NonNullable<typeof s> => !!s);
  }, [signs, signKey]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'question', label: t('Саволлар', 'Вопросы'), count: questionIds.length },
    { id: 'sign', label: t('Белгилар', 'Знаки'), count: signIds.length },
    { id: 'cheatsheet', label: t('Шпаргалкалар', 'Шпаргалки'), count: savedSheets.length },
  ];

  return (
    <PageShell title="Saqlanganlar" icon={<Bookmark className="h-5 w-5" />}>
      <div className="mb-4 flex gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={cn(
              'rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors',
              tab === x.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground',
            )}
          >
            {x.label} {x.count > 0 && <span className="opacity-80">({x.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'question' &&
        (loading ? (
          <p className="py-10 text-center text-muted-foreground">{t('Юкланмоқда...', 'Загрузка...')}</p>
        ) : entries.length === 0 ? (
          <Empty
            text={t(
              'Тушунарсиз савол чиқса, ёнидаги белгини босинг. У шу ерда сақланади.',
              'Непонятный вопрос? Нажмите закладку рядом с ним, он сохранится здесь.',
            )}
          />
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <QuestionPreview
                key={e.question.id}
                entry={e}
                actions={<SaveButton kind="question" itemKey={e.question.id} className="-mr-1 -mt-1" />}
              />
            ))}
          </div>
        ))}

      {tab === 'cheatsheet' &&
        (savedSheets.length === 0 ? (
          <Empty text={t('Шпаргалкани очиб, сақлаш белгисини босинг.', 'Откройте шпаргалку и нажмите закладку.')} />
        ) : (
          <div className="space-y-3">
            {savedSheets.map((s) => (
              <div key={s!.id} className="flex items-center gap-2 rounded-2xl border-2 border-border bg-card p-3">
                <button type="button" onClick={() => navigate(`/cheat-sheets/${s!.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <SheetIconBadge sheet={s!} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-tight text-foreground">{tr(s!.title)}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{tr(s!.subtitle)}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
                <SaveButton kind="cheatsheet" itemKey={s!.id} />
              </div>
            ))}
          </div>
        ))}

      {tab === 'sign' &&
        (savedSigns.length === 0 ? (
          <Empty text={t('Белгини очиб, сақлаш белгисини босинг.', 'Откройте знак и нажмите закладку.')} />
        ) : (
          <div className="space-y-3">
            {savedSigns.map((s) => (
              <article key={s.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                {s.image_url && <img src={s.image_url} alt="" loading="lazy" className="h-20 w-20 shrink-0 object-contain" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary">{s.number}</p>
                  <p className="font-semibold text-foreground">«{s.title}»</p>
                  {s.description && s.description.trim() !== s.title.trim() && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  )}
                </div>
                <SaveButton kind="sign" itemKey={s.id} className="-mr-1 -mt-1" />
              </article>
            ))}
          </div>
        ))}
    </PageShell>
  );
};

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <Bookmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default SavedPage;

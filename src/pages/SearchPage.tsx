import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { useT } from '@/hooks/useT';
import { useTestLang } from '@/hooks/useTestLang';
import { useFullAccess } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { getBundledAllQuestions, trialAllowedLessonIds, type IndexedQuestion } from '@/lib/offlineContent';
import { QuestionPreview } from '@/features/study/QuestionPreview';
import { SaveButton } from '@/features/study/SaveButton';
import { skeleton } from '@/features/search/skeleton';

type Scope = 'all' | 'question' | 'answer';

interface Indexed {
  entry: IndexedQuestion;
  q: string;
  answers: string[];
}

const PAGE = 30;

/**
 * Search through every question and answer by a word or a phrase, with the
 * path (lesson > topic > number) and the picture. Runs entirely on the bundled
 * bank, so it costs the server nothing.
 */
const SearchPage = () => {
  const t = useT();
  const [lang] = useTestLang();
  const fullAccess = useFullAccess();
  const [index, setIndex] = useState<Indexed[] | null>(null);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, allowed] = await Promise.all([
        getBundledAllQuestions(lang),
        fullAccess ? Promise.resolve(null) : trialAllowedLessonIds(),
      ]);
      if (cancelled) return;
      const list = allowed ? all.filter((e) => allowed.has(e.lessonId)) : all;
      setIndex(
        list.map((entry) => ({
          entry,
          q: skeleton(entry.question.question_uz_cyr),
          answers: entry.question.answers.map((a) => skeleton(a.answer_uz_cyr)),
        })),
      );
    })().catch(() => !cancelled && setIndex([]));
    return () => {
      cancelled = true;
    };
  }, [lang, fullAccess]);

  // Wait for a pause in typing before searching 1300 questions.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(skeleton(text));
      setShown(PAGE);
    }, 200);
    return () => clearTimeout(id);
  }, [text]);

  const results = useMemo(() => {
    if (!index || query.length < 2) return [];
    const out: { entry: IndexedQuestion; matchedAnswers: Set<string> }[] = [];
    for (const row of index) {
      const inQuestion = scope !== 'answer' && row.q.includes(query);
      const matchedAnswers = new Set<string>();
      if (scope !== 'question') {
        row.answers.forEach((a, i) => {
          if (a.includes(query)) matchedAnswers.add(row.entry.question.answers[i].id);
        });
      }
      if (inQuestion || matchedAnswers.size > 0) out.push({ entry: row.entry, matchedAnswers });
    }
    return out;
  }, [index, query, scope]);

  const scopes: { id: Scope; label: string }[] = [
    { id: 'all', label: t('Ҳаммаси', 'Везде') },
    { id: 'question', label: t('Савол', 'Вопрос') },
    { id: 'answer', label: t('Жавоб', 'Ответ') },
  ];

  return (
    <PageShell title="Qidiruv" icon={<SearchIcon className="h-5 w-5" />}>
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('Сўз ёки ибора ёзинг...', 'Введите слово или фразу...')}
          className="h-12 pl-10 pr-10"
          inputMode="search"
        />
        {text && (
          <button
            type="button"
            onClick={() => setText('')}
            aria-label={t('Тозалаш', 'Очистить')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {scopes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setScope(s.id);
              setShown(PAGE);
            }}
            className={cn(
              'rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors',
              scope === s.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {index === null ? (
        <p className="py-10 text-center text-muted-foreground">{t('Юкланмоқда...', 'Загрузка...')}</p>
      ) : query.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('Камида 2 та ҳарф киритинг. Лотин ёки кирилл ҳарфларида ёзиш мумкин.', 'Введите минимум 2 буквы. Можно писать латиницей или кириллицей.')}
        </p>
      ) : results.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t('Ҳеч нарса топилмади', 'Ничего не найдено')}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('Топилди', 'Найдено')}: {results.length}
          </p>
          <div className="space-y-3">
            {results.slice(0, shown).map(({ entry, matchedAnswers }) => (
              <QuestionPreview
                key={entry.question.id}
                entry={entry}
                matchedAnswerIds={matchedAnswers}
                actions={<SaveButton kind="question" itemKey={entry.question.id} className="-mr-1 -mt-1" />}
              />
            ))}
          </div>
          {results.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mt-4 w-full rounded-2xl border-2 border-border bg-card py-3 text-sm font-semibold text-foreground"
            >
              {t('Яна кўрсатиш', 'Показать ещё')}
            </button>
          )}
        </>
      )}
    </PageShell>
  );
};

export default SearchPage;

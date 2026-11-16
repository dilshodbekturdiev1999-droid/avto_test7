import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, NotebookText } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { useT } from '@/hooks/useT';
import { useTestLang } from '@/hooks/useTestLang';
import { SaveButton } from '@/features/study/SaveButton';
import { SheetIconBadge } from '@/features/cheatsheets/SheetIconBadge';
import { CHEAT_SHEETS, CHEAT_SHEETS_HEADING, getCheatSheet } from '@/features/cheatsheets/cheatsheets';
import { SHEET_RU, UNIT_RU, VALUE_RU } from '@/features/cheatsheets/ru';

/** List of cheat sheets, or one sheet when the URL has an id. */
const CheatSheetsPage = () => {
  const { sheetId } = useParams<{ sheetId?: string }>();
  const navigate = useNavigate();
  const t = useT();
  const [lang] = useTestLang();
  const sheet = getCheatSheet(sheetId);
  const tr = (s: string) => (lang === 'ru' ? SHEET_RU[s] ?? s : s);
  const unit = (s: string) => (lang === 'ru' ? UNIT_RU[s] ?? s : s);
  const value = (s: string) => (lang === 'ru' ? VALUE_RU[s] ?? s : s);

  if (sheetId && sheet) {
    return (
      <PageShell
        title={tr(sheet.title)}
        icon={<SheetIconBadge sheet={sheet} className="h-8 w-8 rounded-xl" />}
        onBack={() => navigate('/cheat-sheets')}
        actions={<SaveButton kind="cheatsheet" itemKey={sheet.id} />}
      >
        <p className="mb-4 text-sm text-muted-foreground">{tr(sheet.subtitle)}</p>
        <div className="space-y-4">
          {sheet.sections.map((section) => (
            <section key={section.title} className="overflow-hidden rounded-2xl border border-border bg-card">
              <h2 className="bg-secondary/60 px-4 py-2.5 text-sm font-bold text-foreground">{tr(section.title)}</h2>
              <ul className="divide-y divide-border">
                {section.rows.map((row, i) => (
                  <li key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-28 shrink-0 text-right">
                      <span className="text-2xl font-extrabold leading-none text-success">{value(row.value)}</span>
                      {row.unit && <span className="ml-1 text-[11px] font-semibold text-success/80">{unit(row.unit)}</span>}
                    </div>
                    <p className="min-w-0 flex-1 border-l border-border pl-4 text-sm font-medium text-foreground">
                      {tr(row.text)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Shpargalkalar" icon={<NotebookText className="h-5 w-5" />}>
      <p className="mb-4 text-sm text-muted-foreground">{tr(CHEAT_SHEETS_HEADING)}</p>
      {sheetId && !sheet && (
        <p className="mb-3 text-sm text-destructive">{t('Шпаргалка топилмади', 'Шпаргалка не найдена')}</p>
      )}
      <div className="space-y-3">
        {CHEAT_SHEETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(`/cheat-sheets/${s.id}`)}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-left transition-colors active:bg-secondary/60"
          >
            <SheetIconBadge sheet={s} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-tight text-foreground">{tr(s.title)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{tr(s.subtitle)}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </PageShell>
  );
};

export default CheatSheetsPage;

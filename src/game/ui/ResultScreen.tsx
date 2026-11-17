import { useT } from '@/hooks/useT';
import type { Penalty } from '../engine/exam';

/** End of the exam: passed or not by the rules, with every mistake and its points. */
export default function ResultScreen({
  total,
  list,
  reason,
  onAgain,
  onSetup,
  onExit,
}: {
  total: number;
  list: Penalty[];
  reason: 'finish' | 'fail';
  onAgain: () => void;
  onSetup: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const passed = reason === 'finish' && total < 100;
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-[min(94vw,28rem)] flex-col rounded-3xl bg-[#121826] p-5 text-white shadow-2xl">
        <div className={`mb-1 text-center text-2xl font-bold ${passed ? 'text-lime-400' : 'text-red-400'}`}>
          {passed ? t('Имтиҳондан ўтдингиз', 'Экзамен сдан') : t('Имтиҳондан ўта олмадингиз', 'Экзамен не сдан')}
        </div>
        <div className="mb-4 text-center text-sm text-white/70">
          {t('Жарима баллари', 'Штрафные баллы')}: <span className="font-bold text-white">{total}</span> / 100
        </div>
        <div className="mb-4 min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white/5">
          {list.length === 0 ? (
            <div className="p-4 text-center text-sm text-white/70">{t('Битта ҳам хато йўқ', 'Ни одной ошибки')}</div>
          ) : (
            list.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5 text-sm last:border-0">
                <span>{t(p.uz, p.ru)}</span>
                <span className="shrink-0 font-bold text-red-300">+{p.points}</span>
              </div>
            ))
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onAgain} className="rounded-xl bg-lime-400 py-3 text-sm font-semibold text-black">
            {t('Қайта', 'Ещё раз')}
          </button>
          <button onClick={onSetup} className="rounded-xl bg-white/10 py-3 text-sm font-semibold">
            {t('Машина', 'Машина')}
          </button>
          <button onClick={onExit} className="rounded-xl bg-white/10 py-3 text-sm font-semibold">
            {t('Чиқиш', 'Выйти')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { VEHICLES, type Category } from '../engine/vehicles';

export type GameMode = 'exam' | 'free';

export interface GameSetup {
  category: Category;
  vehicleId: string;
  color: number | null;
  mode: GameMode;
}

export const COLORS = [
  { name: 'Oq', hex: 0xeeeeea },
  { name: 'Qora', hex: 0x0d0e10 },
  { name: 'Kumush', hex: 0x9ea3aa },
  { name: 'Qizil', hex: 0x8e0d16 },
  { name: "Ko'k", hex: 0x173a7a },
  { name: 'Kulrang', hex: 0x4a4f57 },
];

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Before driving: category, car, colour and whether penalties are counted. */
export default function SetupScreen({ initial, onStart, onBack }: { initial: GameSetup | null; onStart: (s: GameSetup) => void; onBack: () => void }) {
  const t = useT();
  const [category, setCategory] = useState<Category>(initial?.category ?? 'B');
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? VEHICLES[0].id);
  const [color, setColor] = useState<number | null>(initial?.color ?? VEHICLES[0].defaultColor);
  const [mode, setMode] = useState<GameMode>(initial?.mode ?? 'exam');
  const cars = VEHICLES.filter((v) => v.category === category);
  const car = cars.find((v) => v.id === vehicleId) ?? cars[0];

  const pickCategory = (c: Category) => {
    setCategory(c);
    const first = VEHICLES.find((v) => v.category === c);
    if (first) {
      setVehicleId(first.id);
      setColor(first.defaultColor);
    }
  };

  const chip = (on: boolean) =>
    `rounded-2xl border px-4 py-3 text-left transition-colors ${on ? 'border-lime-400 bg-lime-400/10' : 'border-white/10 bg-white/5 active:bg-white/10'}`;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0b0f17] text-white">
      <div className="mx-auto w-full max-w-lg px-4 pb-8" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5" aria-label="Orqaga">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">{t('Автодром', 'Автодром')}</h1>
        </div>

        <p className="mb-2 text-sm text-white/60">{t('Тоифа', 'Категория')}</p>
        <div className="mb-5 grid grid-cols-2 gap-3">
          {(['B', 'C'] as Category[]).map((c) => (
            <button key={c} onClick={() => pickCategory(c)} className={chip(category === c)}>
              <div className="text-2xl font-bold">{c}</div>
              <div className="text-xs text-white/60">{c === 'B' ? t('Енгил машина', 'Легковой автомобиль') : t('Юк машинаси', 'Грузовой автомобиль')}</div>
            </button>
          ))}
        </div>

        <p className="mb-2 text-sm text-white/60">{t('Машина', 'Машина')}</p>
        <div className="mb-5 grid gap-2">
          {cars.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setVehicleId(v.id);
                setColor(v.defaultColor);
              }}
              className={`${chip(car?.id === v.id)} flex items-center justify-between`}
            >
              <span className="font-semibold">{v.name}</span>
              {car?.id === v.id && <Check className="h-5 w-5 text-lime-400" />}
            </button>
          ))}
        </div>

        {car && car.defaultColor !== null && (
          <>
            <p className="mb-2 text-sm text-white/60">{t('Ранги', 'Цвет')}</p>
            <div className="mb-5 flex flex-wrap gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.hex)}
                  className={`h-10 w-10 rounded-full border-2 ${color === c.hex ? 'border-lime-400' : 'border-white/20'}`}
                  style={{ background: hex(c.hex) }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </>
        )}

        <p className="mb-2 text-sm text-white/60">{t('Режим', 'Режим')}</p>
        <div className="mb-6 grid gap-2">
          <button onClick={() => setMode('exam')} className={chip(mode === 'exam')}>
            <div className="font-semibold">{t('Имтиҳон (жарима баллари билан)', 'Экзамен (со штрафными баллами)')}</div>
            <div className="mt-0.5 text-xs text-white/60">
              {t('Ҳар бир хато учун жарима ёзилади. 100 баллга етса — ўтмадингиз.', 'За каждую ошибку — штраф. 100 баллов — не сдал.')}
            </div>
          </button>
          <button onClick={() => setMode('free')} className={chip(mode === 'free')}>
            <div className="font-semibold">{t('Эркин ҳайдаш (жаримасиз)', 'Свободная езда (без штрафов)')}</div>
            <div className="mt-0.5 text-xs text-white/60">{t('Машқларни бемалол ўрганинг', 'Тренируйтесь без подсчёта баллов')}</div>
          </button>
        </div>

        <button
          onClick={() => car && onStart({ category, vehicleId: car.id, color: car.defaultColor === null ? null : color, mode })}
          className="w-full rounded-2xl bg-lime-400 py-4 text-base font-bold text-black active:scale-[0.99]"
        >
          {t('Бошлаш', 'Начать')}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { primeAudio } from '../engine/sound';
import { ArrowLeft } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { VEHICLES, type Category } from '../engine/vehicles';
import { preloadGame } from '../engine/preload';
import HandPicker, { loadHand } from './HandPicker';

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

const BLUE = '#2563EB';
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const card = 'rounded-[20px] bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-shadow';
const ring = (on: boolean) => (on ? { boxShadow: `0 0 0 2px ${BLUE}` } : undefined);

/** Before driving: category, car, colour and whether penalties are counted. */
export default function SetupScreen({ initial, onStart, onBack }: { initial: GameSetup | null; onStart: (s: GameSetup) => void; onBack: () => void }) {
  const t = useT();
  const [category, setCategory] = useState<Category>(initial?.category ?? 'B');
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? VEHICLES[0].id);
  const [color, setColor] = useState<number | null>(initial?.color ?? VEHICLES[0].defaultColor);
  const [mode, setMode] = useState<GameMode>(initial?.mode ?? 'exam');
  const [hand, setHand] = useState(loadHand);
  const cars = VEHICLES.filter((v) => v.category === category);
  const car = cars.find((v) => v.id === vehicleId) ?? cars[0];
  // car pictures first (tiny), then the game files while the player is still choosing
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!car) return;
    const id = window.setTimeout(() => void preloadGame(car.file, car.hasLow), shown >= cars.length ? 0 : 1200);
    return () => window.clearTimeout(id);
  }, [car, shown, cars.length]);

  const pickCategory = (c: Category) => {
    setCategory(c);
    const first = VEHICLES.find((v) => v.category === c);
    if (first) {
      setVehicleId(first.id);
      setColor(first.defaultColor);
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#f2f4f7] text-slate-900">
      <div className="mx-auto w-full max-w-3xl px-4 pb-8" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mb-5 flex items-center gap-3">
          <button onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]" aria-label="Orqaga">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold leading-tight">{t('Автодром', 'Автодром')}</h1>
            <div className="text-sm text-slate-500">{t('Амалий имтиҳон машқи', 'Тренировка практического экзамена')}</div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-500">{t('Тоифа', 'Категория')}</p>
            <div className="mb-5 grid grid-cols-2 gap-2.5">
              {(['B', 'C'] as Category[]).map((c) => (
                <button key={c} onClick={() => pickCategory(c)} className={`${card} px-4 py-3.5`} style={ring(category === c)}>
                  <div className="text-2xl font-semibold" style={category === c ? { color: BLUE } : undefined}>{c}</div>
                  <div className="text-xs text-slate-500">{c === 'B' ? t('Енгил машина', 'Легковой автомобиль') : t('Юк машинаси', 'Грузовой автомобиль')}</div>
                </button>
              ))}
            </div>

            <p className="mb-2 text-[13px] font-medium text-slate-500">{t('Режим', 'Режим')}</p>
            <div className="grid gap-2.5">
              <button onClick={() => setMode('exam')} className={`${card} px-4 py-3.5`} style={ring(mode === 'exam')}>
                <div className="font-semibold">{t('Имтиҳон', 'Экзамен')}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {t('Ҳар бир хато учун жарима ёзилади. 100 баллга етса — ўтмадингиз.', 'За каждую ошибку — штраф. 100 баллов — не сдал.')}
                </div>
              </button>
              <button onClick={() => setMode('free')} className={`${card} px-4 py-3.5`} style={ring(mode === 'free')}>
                <div className="font-semibold">{t('Эркин ҳайдаш', 'Свободная езда')}</div>
                <div className="mt-0.5 text-xs text-slate-500">{t('Жаримасиз, машқларни бемалол ўрганинг', 'Без штрафов, тренируйтесь спокойно')}</div>
              </button>
            </div>

            <p className="mb-2 mt-5 text-[13px] font-medium text-slate-500">{t('Бошқарув', 'Управление')}</p>
            <HandPicker value={hand} onChange={setHand} />
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-500">{t('Машина', 'Машина')}</p>
            <div className="mb-5 grid grid-cols-2 gap-2.5">
              {cars.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setVehicleId(v.id);
                    setColor(v.defaultColor);
                  }}
                  className={`${card} overflow-hidden`}
                  style={ring(car?.id === v.id)}
                >
                  <div className="aspect-[16/9] bg-gradient-to-b from-slate-50 to-slate-100">
                    <img
                      src={`${import.meta.env.BASE_URL}game/cars/${v.id}.webp`}
                      alt=""
                      className="h-full w-full object-cover"
                      decoding="async"
                      fetchPriority="high"
                      onLoad={() => setShown((n) => n + 1)}
                      onError={() => setShown((n) => n + 1)}
                    />
                  </div>
                  <div className="px-3 py-2.5 text-sm font-semibold">{v.name}</div>
                </button>
              ))}
            </div>

            {car && car.defaultColor !== null && (
              <>
                <p className="mb-2 text-[13px] font-medium text-slate-500">{t('Ранги', 'Цвет')}</p>
                <div className="mb-2 flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColor(c.hex)}
                      className="h-9 w-9 rounded-full border border-slate-200"
                      style={{ background: hex(c.hex), boxShadow: color === c.hex ? `0 0 0 3px #f2f4f7, 0 0 0 5px ${BLUE}` : undefined }}
                      aria-label={c.name}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => { primeAudio(); if (car) onStart({ category, vehicleId: car.id, color: car.defaultColor === null ? null : color, mode }); }}
          className="mt-6 h-14 w-full rounded-2xl text-base font-semibold text-white active:scale-[0.99]"
          style={{ background: BLUE }}
        >
          {t('Бошлаш', 'Начать')}
        </button>
      </div>
    </div>
  );
}

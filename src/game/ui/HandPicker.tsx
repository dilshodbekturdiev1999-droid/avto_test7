// Which side the steering wheel is on (left- and right-handed players).
// 'left': wheel on the left, gears and pedals on the right (default). 'right': mirrored.
import { useT } from '@/hooks/useT';

export type Hand = 'left' | 'right';
const KEY = 'avtodrom.wheelSide';
const BLUE = '#2563EB';

export function loadHand(): Hand {
  try {
    return localStorage.getItem(KEY) === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
}

export function saveHand(h: Hand) {
  try {
    localStorage.setItem(KEY, h);
  } catch {
    /* private mode: the choice lasts this visit only */
  }
}

/** Small picture of the screen: wheel circle on one side, gears + pedals on the other. */
function Scheme({ hand, on }: { hand: Hand; on: boolean }) {
  const c = on ? BLUE : '#94a3b8';
  const wheelX = hand === 'left' ? 14 : 66;
  const padX = hand === 'left' ? 52 : 6;
  return (
    <svg viewBox="0 0 80 40" className="h-9 w-[72px] shrink-0" aria-hidden>
      <rect x="1" y="1" width="78" height="38" rx="6" fill="#f8fafc" stroke="#e2e8f0" />
      <circle cx={wheelX} cy="26" r="9" fill="none" stroke={c} strokeWidth="2.6" />
      <rect x={padX} y="18" width="5" height="16" rx="1.5" fill={c} opacity="0.55" />
      <rect x={padX + 8} y="22" width="8" height="12" rx="1.5" fill={c} />
      <rect x={padX + 18} y="17" width="5" height="17" rx="1.5" fill={c} />
    </svg>
  );
}

export default function HandPicker({ value, onChange, compact = false }: { value: Hand; onChange: (h: Hand) => void; compact?: boolean }) {
  const t = useT();
  const opts: { h: Hand; label: string; sub: string }[] = [
    { h: 'left', label: t('Рул чапда', 'Руль слева'), sub: t('Педаллар ўнгда', 'Педали справа') },
    { h: 'right', label: t('Рул ўнгда', 'Руль справа'), sub: t('Педаллар чапда', 'Педали слева') },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {opts.map((o) => {
        const on = value === o.h;
        return (
          <button
            key={o.h}
            onClick={() => {
              saveHand(o.h);
              onChange(o.h);
            }}
            aria-pressed={on}
            className={`flex items-center gap-2.5 rounded-[18px] text-left transition-shadow ${compact ? 'bg-slate-100 px-2.5 py-2' : 'bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'}`}
            style={on ? { boxShadow: `0 0 0 2px ${BLUE}` } : undefined}
          >
            <Scheme hand={o.h} on={on} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight" style={on ? { color: BLUE } : undefined}>{o.label}</span>
              <span className="block text-[11px] leading-tight text-slate-500">{o.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

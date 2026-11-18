import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { isTouchDevice } from './engine/device';
import { lockLandscape } from './engine/platform';
import SetupScreen, { type GameSetup } from './ui/SetupScreen';

// The 3D part (three.js + physics) is a separate chunk: the car menu shows at once
// and the game code downloads in the background while the player chooses.
const loadGameView = () => import('./GameView');
const GameView = lazy(loadGameView);

/** Avtodrom: choose category, car and mode, then drive (exam with penalties or free). */
export default function AvtodromPage() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [last, setLast] = useState<GameSetup | null>(null);
  const [run, setRun] = useState(0);
  const exit = () => navigate(-1);

  // Draw edge to edge on phones with a notch (iPhone landscape): without viewport-fit=cover
  // Safari leaves empty bars at the sides. Only while the game is open; restored on leave.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const before = meta?.getAttribute('content') ?? null;
    if (meta && before && !/viewport-fit=cover/.test(before)) meta.setAttribute('content', `${before}, viewport-fit=cover`);
    const html = document.documentElement;
    const bg = html.style.backgroundColor;
    html.style.backgroundColor = '#dfe7f1';
    return () => {
      if (meta && before !== null) meta.setAttribute('content', before);
      html.style.backgroundColor = bg;
    };
  }, []);

  useEffect(() => {
    void loadGameView().then(() => import('./engine/physics')).then((m) => m.initRapier());
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-[#f2f4f7]">
      {setup ? (
        <Suspense
          fallback={
            <div className="absolute inset-0 grid place-items-center">
              <div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-[#2563EB]" />
              </div>
            </div>
          }
        >
          <GameView
            key={run}
            setup={setup}
            onExit={exit}
            onSetup={() => {
              setLast(setup);
              setSetup(null);
            }}
            onRestart={() => {}}
          />
        </Suspense>
      ) : (
        <SetupScreen
          initial={last}
          onBack={exit}
          onStart={(s) => {
            // inside the tap, so the browser allows fullscreen + landscape lock
            if (isTouchDevice()) void lockLandscape();
            setSetup(s);
            setRun((r) => r + 1);
          }}
        />
      )}
    </div>,
    document.body,
  );
}

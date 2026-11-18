import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import GameView from './GameView';
import { isTouchDevice } from './engine/device';
import { lockLandscape } from './engine/platform';
import SetupScreen, { type GameSetup } from './ui/SetupScreen';

/** Avtodrom: choose category, car and mode, then drive (exam with penalties or free). */
export default function AvtodromPage() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [last, setLast] = useState<GameSetup | null>(null);
  const [run, setRun] = useState(0);
  const exit = () => navigate(-1);

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-[#f2f4f7]">
      {setup ? (
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

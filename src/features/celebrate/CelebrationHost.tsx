import { lazy, Suspense, useEffect, useState } from 'react';
import { useTestLang } from '@/hooks/useTestLang';
import { onCelebrate, type CelebrationRequest } from './celebrate';

// The 3D player (three.js + gsap) is downloaded only when a celebration actually plays.
const CelebrationPlayer = lazy(() => import('./CelebrationPlayer'));

/** Mounted once at the app root; plays whatever celebrate() asks for. */
export function CelebrationHost() {
  const [req, setReq] = useState<CelebrationRequest | null>(null);
  const [lang] = useTestLang();
  useEffect(() => onCelebrate(setReq), []);
  if (!req) return null;
  return (
    <Suspense fallback={null}>
      <CelebrationPlayer kind={req.kind} value={req.value} lang={lang} onDone={() => setReq(null)} />
    </Suspense>
  );
}

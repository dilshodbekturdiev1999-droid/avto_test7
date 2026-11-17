// Plays one celebration scene full screen (loaded only when a celebration happens).
// The scenes are the approved 3D clips; here they run live, so the number is the
// student's real result and the words are in his language.
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import * as L from './lib3d';
import { SCENES } from './scenes.generated';
import { sceneText, type CelebrationKind } from './celebrate';

const BASE_CSS = `
.cel-stage * { margin: 0; padding: 0; box-sizing: border-box; }
.cel-stage { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; transform-origin: 0 0; font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
.cel-stage canvas { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; display: block; }
.cel-stage .ui { position: absolute; left: 60px; width: 960px; text-align: center; color: #fff; }
.cel-stage .title { font-weight: 600; letter-spacing: -0.025em; line-height: 1.1; }
.cel-stage .sub { font-weight: 400; color: rgba(255,255,255,.72); letter-spacing: -0.005em; line-height: 1.35; }
.cel-stage .num { font-weight: 600; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
.cel-stage .pct { font-size: 0.42em; font-weight: 500; letter-spacing: 0; margin-left: 0.06em; opacity: .85; }
`;

// How much of the 1080x1920 canvas to actually render: enough for a sharp picture on
// this screen, less on modest phones so the animation stays smooth.
function pickQuality(): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let q = Math.min(0.75, (window.innerHeight * dpr) / 1920);
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 4) q = Math.min(q, 0.5);
  return Math.max(0.4, q);
}

export default function CelebrationPlayer({
  kind,
  value,
  lang,
  onDone,
}: {
  kind: CelebrationKind;
  value: number;
  lang: 'uz' | 'ru';
  onDone: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [canClose, setCanClose] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fit = () => {
      // Nearly fill the screen: on tall phones at most a sliver of the empty side margin
      // is cut (the text stays whole), the rest is the scene's dark edge.
      const contain = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
      const cover = Math.max(window.innerWidth / 1080, window.innerHeight / 1920);
      const s = Math.min(cover, contain * 1.06);
      setScale(s);
      setOffset({ x: (window.innerWidth - 1080 * s) / 2, y: (window.innerHeight - 1920 * s) / 2 });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const scene = SCENES[kind];
    const host = hostRef.current;
    if (!scene || !host) return onDone();

    let raf = 0;
    let stage: { dispose?: () => void } | null = null;
    let cancelled = false;
    const style = document.createElement('style');
    // the scene's own positions, scoped to this stage
    style.textContent = BASE_CSS + scene.css.replace(/(^|\n)\s*#/g, '$1.cel-stage #');
    document.head.appendChild(style);
    host.innerHTML = '<canvas></canvas>' + scene.body;
    const canvas = host.querySelector('canvas') as HTMLCanvasElement;
    const text = sceneText(kind, lang);
    for (const [id, words] of Object.entries(text.dom)) {
      const el = host.querySelector('#' + id);
      if (el) el.textContent = words;
    }

    const scoped = {
      getElementById: (id: string) => host.querySelector('#' + id),
      createElement: (tag: string) => document.createElement(tag),
      fonts: document.fonts,
    };
    const lib = {
      ...L,
      createStage: (opts: Record<string, unknown>) => {
        const s = L.createStage({ ...opts, canvas, quality: pickQuality() });
        stage = s;
        return s;
      },
    };
    (async () => {
      try {
        await document.fonts.ready;
        if (cancelled) return;
        const tl = gsap.timeline({ paused: true });
        // gsap selectors like '#title' must hit this stage, not the page
        const sel = gsap.utils.selector(host);
        const scopedGsap = new Proxy(gsap, {
          get(target, prop) {
            const v = (target as never)[prop as never] as unknown;
            if (prop === 'set' || prop === 'to' || prop === 'fromTo' || prop === 'from') {
              return (t: unknown, ...rest: unknown[]) => (v as (...a: unknown[]) => unknown).call(target, typeof t === 'string' ? sel(t) : t, ...rest);
            }
            return v;
          },
        });
        const scopedTl = new Proxy(tl, {
          get(target, prop) {
            const v = (target as never)[prop as never] as unknown;
            if (prop === 'set' || prop === 'to' || prop === 'fromTo' || prop === 'from') {
              return (t: unknown, ...rest: unknown[]) => {
                (v as (...a: unknown[]) => unknown).call(target, typeof t === 'string' ? sel(t) : t, ...rest);
                return scopedTl;
              };
            }
            return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
          },
        });
        const renderAt = scene.run(lib, THREE, scopedGsap, scopedTl, scoped, { value, text: text.canvas });
        // the first frame compiles the shaders (can take a moment on a phone): do it before the clock starts
        tl.seek(0, false);
        renderAt(0);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (cancelled) return;
        const start = performance.now();
        const frame = () => {
          const t = Math.min((performance.now() - start) / 1000, scene.dur);
          tl.seek(t, false);
          renderAt(t);
          if (t > 1.2) setCanClose(true);
          if (t < scene.dur) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch (err) {
        console.warn('celebration failed, skipping', err);
        onDone();
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stage?.dispose?.();
      style.remove();
      host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, value, lang]);

  return (
    <div
      className="fixed inset-0 z-[500] bg-black"
      role="dialog"
      aria-label={sceneText(kind, lang).dom.title ?? ''}
      onClick={() => canClose && onDone()}
    >
      <div
        ref={hostRef}
        className="cel-stage"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
        className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-white/12 px-6 py-3 text-sm font-medium text-white backdrop-blur transition-opacity"
        style={{ opacity: canClose ? 1 : 0, pointerEvents: canClose ? 'auto' : 'none', background: 'rgba(255,255,255,.14)' }}
      >
        {lang === 'ru' ? 'Продолжить' : 'Давом этиш'}
      </button>
    </div>
  );
}

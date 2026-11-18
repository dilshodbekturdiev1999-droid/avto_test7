// What the game runs on: phone/tablet or computer, and how strong the GPU is.
import type { Quality } from './scene';

export function isTouchDevice() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const short = Math.min(window.screen.width, window.screen.height);
  return coarse && short < 900;
}

function gpuName(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/** Old GPUs that really cannot do shadows and MSAA at phone resolution. */
const WEAK_GPU = /(Mali-4\d\d|Mali-T[67]\d\d|Adreno \(TM\) [345]\d\d|Adreno [345]\d\d|PowerVR SGX|PowerVR Rogue G6|Intel\(R\) HD Graphics [234]\d{3}|SwiftShader)/i;

export function pickQuality(): Quality {
  const forced = new URLSearchParams(window.location.search).get('q');
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced;
  const gpu = gpuName();
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  if (WEAK_GPU.test(gpu) && !/SwiftShader/i.test(gpu)) return 'low';
  if (mem <= 2) return 'low';
  return isTouchDevice() ? 'medium' : 'high';
}

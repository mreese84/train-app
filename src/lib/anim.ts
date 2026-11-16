/**
 * Animation math for the exercise figures, exactly as described in
 * exercises.json: cosine-eased phase over [toFinish, holdFinish, toStart,
 * holdStart], mapped across k keyframes with pos = s * (k - 1).
 */
import type { AnimElement, Point } from '../data/exercises';

export const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

/** Phase s in [0, 1] at time t (ms) within the looping cycle. */
export function phaseAt(timingMs: readonly [number, number, number, number], t: number): number {
  const [toFinish, holdFinish, toStart, holdStart] = timingMs;
  const total = toFinish + holdFinish + toStart + holdStart;
  if (total <= 0) return 0;
  let x = ((t % total) + total) % total;
  if (x < toFinish) return ease(x / toFinish);
  x -= toFinish;
  if (x < holdFinish) return 1;
  x -= holdFinish;
  if (x < toStart) return 1 - ease(x / toStart);
  return 0;
}

/** Which keyframe segment and how far along it, for phase s. */
export function segmentAt(k: number, s: number): { i: number; t: number } {
  if (k < 2) return { i: 0, t: 0 };
  const pos = Math.min(Math.max(s, 0), 1) * (k - 1);
  const i = Math.min(Math.floor(pos), k - 2);
  return { i, t: pos - i };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPoint = (a: Point, b: Point, t: number): Point => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** SVG `points` attribute for a polyline element at phase s. */
export function polylinePoints(keyframes: AnimElement[][], index: number, s: number): string {
  const { i, t } = segmentAt(keyframes.length, s);
  const a = keyframes[i][index];
  const b = keyframes[Math.min(i + 1, keyframes.length - 1)][index];
  if (a.type !== 'polyline' || b.type !== 'polyline') return '';
  return a.points.map((p, j) => {
    const q = lerpPoint(p, b.points[j] ?? p, t);
    return `${fmt(q[0])},${fmt(q[1])}`;
  }).join(' ');
}

/** Circle center at phase s. */
export function circleCenter(keyframes: AnimElement[][], index: number, s: number): Point {
  const { i, t } = segmentAt(keyframes.length, s);
  const a = keyframes[i][index];
  const b = keyframes[Math.min(i + 1, keyframes.length - 1)][index];
  if (a.type !== 'circle' || b.type !== 'circle') return [0, 0];
  return lerpPoint(a.c, b.c, t);
}

/**
 * Raw snippets are static, but one exercise (Pallof press) has a raw snippet
 * that differs between keyframes; we show the snippet of the nearest keyframe.
 */
export function nearestKeyframe(k: number, s: number): number {
  return Math.round(Math.min(Math.max(s, 0), 1) * (k - 1));
}

/**
 * The animated exercise figure. Rendered once by React at frame 0; after that
 * a requestAnimationFrame loop writes SVG attributes directly (no React state
 * at 60 fps). Pauses when the tab is hidden and starts paused when the phone
 * asks for reduced motion.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '../data/exercises';
import { circleCenter, nearestKeyframe, phaseAt, polylinePoints } from '../lib/anim';

type Props = {
  exercise: Exercise;
  /** Small paused thumbnail (frame 0, no label or controls). */
  thumbnail?: boolean;
  size?: number;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ExerciseAnimation({ exercise, thumbnail = false, size }: Props) {
  const anim = exercise.animation;
  const kfs = anim.keyframes;
  const [playing, setPlaying] = useState(() => !thumbnail && !prefersReducedMotion());
  const elRefs = useRef<(SVGElement | null)[]>([]);
  // Animation clock: elapsed ms survives pause/resume so the figure doesn't jump.
  const elapsed = useRef(0);

  const scaleTransform = anim.scale
    ? `translate(${80 * (1 - anim.scale)},${185 * (1 - anim.scale)}) scale(${anim.scale})`
    : undefined;

  // Static first frame, rendered by React.
  const initial = useMemo(
    () =>
      kfs[0].map((el, i) => {
        if (el.type === 'polyline') {
          return (
            <polyline
              key={i}
              ref={(n) => { elRefs.current[i] = n; }}
              points={polylinePoints(kfs, i, 0)}
              fill="none"
              stroke={el.stroke}
              strokeWidth={el.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (el.type === 'circle') {
          return (
            <circle
              key={i}
              ref={(n) => { elRefs.current[i] = n; }}
              cx={el.c[0]}
              cy={el.c[1]}
              r={el.r}
              fill={el.fill}
            />
          );
        }
        // Raw static SVG from exercises.json (the owner's own file; trusted).
        return (
          <g key={i} ref={(n) => { elRefs.current[i] = n; }} data-kf="0" dangerouslySetInnerHTML={{ __html: el.svg }} />
        );
      }),
    [kfs],
  );

  useEffect(() => {
    if (thumbnail || !playing) return;
    let raf = 0;
    let last: number | null = null;

    const draw = (s: number) => {
      const nearest = nearestKeyframe(kfs.length, s);
      kfs[0].forEach((el, i) => {
        const node = elRefs.current[i];
        if (!node) return;
        if (el.type === 'polyline') node.setAttribute('points', polylinePoints(kfs, i, s));
        else if (el.type === 'circle') {
          const [cx, cy] = circleCenter(kfs, i, s);
          node.setAttribute('cx', cx.toFixed(2));
          node.setAttribute('cy', cy.toFixed(2));
        } else if (node.dataset.kf !== String(nearest)) {
          const rawEl = kfs[nearest][i];
          if (rawEl.type === 'raw' && rawEl.svg !== (kfs[Number(node.dataset.kf)][i] as { svg?: string }).svg) {
            node.innerHTML = rawEl.svg;
          }
          node.dataset.kf = String(nearest);
        }
      });
    };

    const tick = (now: number) => {
      if (last !== null) elapsed.current += now - last;
      last = now;
      draw(phaseAt(anim.timingMs, elapsed.current));
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf) return;
      last = null;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playing, thumbnail, kfs, anim.timingMs]);

  const svg = (
    <svg
      viewBox="0 0 160 200"
      role="img"
      aria-label={anim.alt}
      className={thumbnail ? 'anim-svg anim-thumb' : 'anim-svg'}
      width={size}
      height={size ? (size * 200) / 160 : undefined}
    >
      {anim.ground && <line x1={6} y1={186} x2={154} y2={186} stroke="#CBD2CD" strokeWidth={2} />}
      {scaleTransform ? <g transform={scaleTransform}>{initial}</g> : initial}
    </svg>
  );

  if (thumbnail) return svg;

  return (
    <figure className="anim">
      <figcaption className="anim-label">
        {exercise.labels[0]} ⇄ {exercise.labels[1]}
        {exercise.view ? ` · ${exercise.view}` : ''}
      </figcaption>
      {svg}
      <button
        type="button"
        className="anim-toggle"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause animation' : 'Play animation'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
        )}
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>
    </figure>
  );
}

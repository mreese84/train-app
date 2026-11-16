/** A number field with big −/+ buttons that also accepts typing. */
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  placeholder?: string;
  decimal?: boolean;
  label: string;
};

const fmt = (v: number | null) => (v === null ? '' : String(Math.round(v * 100) / 100));

export function NumberStepper({ value, onChange, step, min = 0, max = 9999, placeholder, decimal = false, label }: Props) {
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);

  // Follow outside changes (steppers, prefill from the row above) unless typing.
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const bump = (dir: 1 | -1) => {
    const base = value ?? (dir > 0 ? 0 : step);
    // Snap to the step grid, so 47 + 5 → 50 rather than 52.
    const next = dir > 0 ? Math.floor(base / step + 1e-9) * step + step : Math.ceil(base / step - 1e-9) * step - step;
    const v = clamp(Math.round(next * 100) / 100);
    setText(fmt(v));
    onChange(v);
  };

  return (
    <div className="stepper">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-1)}>−</button>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => { focused.current = true; e.target.select(); }}
        onBlur={() => { focused.current = false; setText(fmt(value)); }}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.');
          setText(t);
          if (t.trim() === '') return onChange(null);
          const n = Number(t);
          if (Number.isFinite(n)) onChange(clamp(decimal ? n : Math.round(n)));
        }}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(1)}>+</button>
    </div>
  );
}

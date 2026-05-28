"use client";

import { useEffect, useState } from "react";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  initialMin?: number;
  initialMax?: number;
  onChange: (values: { min: number; max: number }) => void;
  labelPrefix?: string;
}

export default function RangeSlider({
  min,
  max,
  step = 100,
  initialMin,
  initialMax,
  onChange,
  labelPrefix = "$",
}: RangeSliderProps) {
  const [minVal, setMinVal] = useState(initialMin ?? min);
  const [maxVal, setMaxVal] = useState(initialMax ?? max);

  useEffect(() => {
    onChange({ min: minVal, max: maxVal });
  }, [minVal, maxVal]);

  return (
    <div className="flex flex-col gap-4 w-full bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
      {/* Slider Value Displays */}
      <div className="flex justify-between items-center text-xs font-semibold text-text-secondary">
        <span>
          Min: {labelPrefix}
          {minVal.toLocaleString()}
        </span>
        <span>
          Max: {labelPrefix}
          {maxVal.toLocaleString()}
        </span>
      </div>

      {/* Dual HTML inputs slider wrapper */}
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={(e) => {
            const val = Math.min(Number(e.target.value), maxVal - step);
            setMinVal(val);
          }}
          className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
          aria-label="Minimum Value Range Selection"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={(e) => {
            const val = Math.max(Number(e.target.value), minVal + step);
            setMaxVal(val);
          }}
          className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
          aria-label="Maximum Value Range Selection"
        />
      </div>
    </div>
  );
}

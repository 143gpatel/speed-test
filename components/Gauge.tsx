"use client";

type GaugeProps = {
  value: number;
  label: string;
  unit?: string;
  max?: number;
};

export default function Gauge({ value, label, unit = "Mbps", max = 200 }: GaugeProps) {
  const dynamicMax = Math.max(max, Math.ceil(Math.max(value, max) / 50) * 50);
  const safeValue = Math.min(Math.max(value, 0), dynamicMax);
  const percent = safeValue / dynamicMax;
  const progress = Number((percent * 100).toFixed(1));

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-5 backdrop-blur-xl shadow-glow">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-300">{label}</p>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
          Max {dynamicMax} {unit}
        </span>
      </div>
      <div className="relative mx-auto h-56 w-56">
        <svg viewBox="0 0 220 180" className="h-full w-full">
          <path
            d="M24 140 A86 86 0 0 1 196 140"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <path
            d="M24 140 A86 86 0 0 1 196 140"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="20"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={String(100 - progress)}
            className="transition-all duration-500"
          />

          {[0, 20, 40, 60, 80, 100].map((tick) => {
            const angle = 180 - tick * 1.8;
            const rad = (angle * Math.PI) / 180;
            const x1 = 110 + Math.cos(rad) * 76;
            const y1 = 140 - Math.sin(rad) * 76;
            const x2 = 110 + Math.cos(rad) * 66;
            const y2 = 140 - Math.sin(rad) * 66;

            return (
              <line
                key={String(tick)}
                x1={String(x1.toFixed(2))}
                y1={String(y1.toFixed(2))}
                x2={String(x2.toFixed(2))}
                y2={String(y2.toFixed(2))}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}

          <defs>
            <linearGradient id="gaugeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-8 text-center">
          <div className="text-5xl font-bold tracking-tight text-slate-100">{safeValue.toFixed(1)}</div>
          <div className="text-sm text-slate-300">{unit}</div>
          <div className="mt-2 text-xs text-slate-400">{progress}% of max</div>
        </div>
      </div>
    </div>
  );
}

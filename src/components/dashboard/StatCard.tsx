import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <div
      className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-lg transition-all hover:border-slate-700/80"
      role="region"
      aria-label={`${title} Metric Card`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider font-display">
          {title}
        </span>
        {icon && <div className="text-text-accent h-5 w-5">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-display text-text-primary tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`inline-flex items-center text-xs font-bold ${
              trend.isPositive ? "text-text-success" : "text-text-error"
            }`}
          >
            {trend.isPositive ? "\u2191" : "\u2193"} {trend.value}%
          </span>
        )}
      </div>

      {description && <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">{description}</p>}
    </div>
  );
}

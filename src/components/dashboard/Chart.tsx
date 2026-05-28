interface ChartDataPoint {
  label: string;
  value: number;
}

interface ChartProps {
  data: ChartDataPoint[];
  title?: string;
}

export default function Chart({ data, title }: ChartProps) {
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value), 1) : 1;

  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-lg w-full">
      {title && (
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider font-display mb-6">
          {title}
        </h3>
      )}

      {/* Responsive Bar Layout */}
      <div className="flex h-48 items-end gap-3 px-2">
        {data.length === 0 ? (
          <div className="flex-1 h-full flex items-center justify-center text-text-muted text-xs">
            No chart data available.
          </div>
        ) : (
          data.map((item, idx) => {
            const heightPercent = (item.value / maxValue) * 100;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
              >
                {/* Tooltip on hover */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-800 absolute transform -translate-y-8 pointer-events-none">
                  {item.value.toLocaleString()}
                </span>
                
                {/* Visual Bar block */}
                <div
                  style={{ height: `${Math.max(heightPercent, 5)}%` }}
                  className="w-full bg-emerald-500/20 group-hover:bg-emerald-500/40 border-t border-emerald-500/50 rounded-t transition-all duration-300"
                  aria-label={`${item.label}: ${item.value}`}
                />
                
                {/* Label */}
                <span className="text-[10px] font-semibold text-text-muted select-none truncate max-w-full">
                  {item.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

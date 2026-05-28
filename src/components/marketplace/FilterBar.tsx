"use client";

import { SlidersHorizontal, X, RotateCcw } from "lucide-react";

import { SearchFilters } from "@/hooks/useMarketplaceSearch";

interface FilterBarProps {
  filters: SearchFilters;
  updateFilters: (filters: SearchFilters) => void;
  clearFilters: () => void;
  onTogglePanel?: () => void;
  panelOpen?: boolean;
}

export default function FilterBar({
  filters,
  updateFilters,
  clearFilters,
  onTogglePanel,
  panelOpen,
}: FilterBarProps) {
  // Count active filters
  const activeCount = [
    filters.category ? 1 : 0,
    filters.rating_min && filters.rating_min > 0 ? 1 : 0,
    filters.price_max && filters.price_max < 50000 ? 1 : 0,
  ].reduce((sum, val) => sum + val, 0);

  const removeFilter = (key: keyof SearchFilters) => {
    updateFilters({
      ...filters,
      [key]: undefined,
    });
  };

  return (
    <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3 md:flex-row md:items-center justify-between w-full">
      {/* Active chips list */}
      <div className="flex flex-wrap items-center gap-2">
        {activeCount === 0 ? (
          <span className="text-xs text-text-muted">No active filters applied</span>
        ) : (
          <>
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
              Active Filters ({activeCount}):
            </span>

            {/* Category chip */}
            {filters.category && (
              <span className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-text-secondary px-2.5 py-1 rounded-lg flex items-center gap-1.5 capitalize">
                Category: {filters.category === "saas" ? "SaaS Dev" : filters.category === "design" ? "UI/UX" : filters.category}
                <button
                  onClick={() => removeFilter("category")}
                  className="hover:text-cyan-400 transition"
                  title="Remove Category"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Rating chip */}
            {filters.rating_min && filters.rating_min > 0 && (
              <span className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-text-secondary px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                Rating: {filters.rating_min}+ ★
                <button
                  onClick={() => removeFilter("rating_min")}
                  className="hover:text-cyan-400 transition"
                  title="Remove Rating"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Price chip */}
            {filters.price_max && filters.price_max < 50000 && (
              <span className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-text-secondary px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                Max starting: ${filters.price_max.toLocaleString()}
                <button
                  onClick={() => removeFilter("price_max")}
                  className="hover:text-cyan-400 transition"
                  title="Remove budget cap"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Clear All action button */}
            <button
              onClick={clearFilters}
              className="text-[10px] font-bold text-text-muted hover:text-cyan-400 flex items-center gap-1.5 ml-2"
              title="Clear all filters"
            >
              <RotateCcw className="h-3 w-3" /> Clear All
            </button>
          </>
        )}
      </div>

      {/* Toggle button panel */}
      {onTogglePanel && (
        <button
          onClick={onTogglePanel}
          className={`flex items-center gap-2 self-start md:self-auto text-xs font-semibold px-4 py-2 border rounded-xl transition ${
            panelOpen
              ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
              : "bg-slate-900 border-slate-800 text-text-secondary hover:border-slate-700"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>{panelOpen ? "Hide Filters" : "Filter Panel"}</span>
          {activeCount > 0 && (
            <span className="bg-cyan-500 text-slate-950 font-bold h-4 w-4 rounded-full flex items-center justify-center text-[9px] ml-0.5">
              {activeCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

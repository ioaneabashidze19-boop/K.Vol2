"use client";

import { X, Star, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

import { SearchFilters } from "@/hooks/useMarketplaceSearch";

interface FilterPanelProps {
  filters: SearchFilters;
  updateFilters: (filters: SearchFilters) => void;
  clearFilters: () => void;
  resultsCount: number;
  onClose?: () => void;
}

export default function FilterPanel({
  filters,
  updateFilters,
  clearFilters,
  resultsCount,
  onClose,
}: FilterPanelProps) {
  const [category, setCategory] = useState<string>(filters.category || "");
  const [ratingMin, setRatingMin] = useState<number>(filters.rating_min || 0);
  const [priceMax, setPriceMax] = useState<number>(filters.price_max || 50000);

  // Sync state with incoming filter updates
  useEffect(() => {
    setCategory(filters.category || "");
    setRatingMin(filters.rating_min || 0);
    setPriceMax(filters.price_max || 50000);
  }, [filters]);

  const handleApply = () => {
    updateFilters({
      category: category || undefined,
      rating_min: ratingMin || undefined,
      price_max: priceMax || undefined,
    });
    if (onClose) onClose();
  };

  const handleClear = () => {
    clearFilters();
    setCategory("");
    setRatingMin(0);
    setPriceMax(50000);
    if (onClose) onClose();
  };

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-6 backdrop-blur-md sticky top-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-850">
        <h3 className="text-xs uppercase font-bold text-text-primary tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Filter Criteria
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-slate-800 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category Checklist */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
          Service Category
        </label>
        <div className="flex flex-col gap-2">
          {[
            { value: "saas", label: "SaaS Dev" },
            { value: "design", label: "UI/UX Design" },
            { value: "cloud", label: "Cloud Infrastructure" },
            { value: "data", label: "Data Intelligence" },
          ].map((cat) => (
            <label
              key={cat.value}
              className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary"
            >
              <input
                type="radio"
                name="category"
                checked={category === cat.value}
                onChange={() => setCategory(cat.value)}
                className="rounded-full border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
              />
              <span>{cat.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Rating scale */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
            Min Rating
          </label>
          <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-0.5">
            {ratingMin || "Any"} <Star className="h-3 w-3 fill-cyan-400 text-cyan-400" />
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="5"
          step="0.5"
          value={ratingMin}
          onChange={(e) => setRatingMin(parseFloat(e.target.value))}
          className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
        />
      </div>

      {/* Price boundary scale */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
            Max Starting Price
          </label>
          <span className="text-[10px] font-bold text-cyan-400">
            ${priceMax.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min="1000"
          max="50000"
          step="1000"
          value={priceMax}
          onChange={(e) => setPriceMax(parseInt(e.target.value))}
          className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
        />
      </div>

      {/* Results indicator & actions */}
      <div className="border-t border-slate-850 pt-4 flex flex-col gap-3">
        <span className="text-[10px] text-text-muted text-center leading-normal">
          Matches: <strong className="text-text-primary">{resultsCount} vendors</strong>
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg text-xs font-semibold transition"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

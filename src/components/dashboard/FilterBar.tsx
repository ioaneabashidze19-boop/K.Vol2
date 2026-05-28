"use client";

import { useState } from "react";

interface FilterBarProps {
  categories: string[];
  onFilterChange: (filters: { search: string; category: string; sortBy: string }) => void;
  placeholder?: string;
}

export default function FilterBar({ categories, onFilterChange, placeholder = "Search..." }: FilterBarProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const handleApply = () => {
    onFilterChange({ search, category, sortBy });
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900/40 p-4 border border-slate-800 rounded-xl w-full">
      {/* Search Input bar */}
      <div className="relative flex-1 w-full">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-950/70 border border-slate-850 rounded-lg pl-4 pr-10 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-500 transition-colors"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          aria-label="Search filter keywords"
        />
      </div>

      {/* Category Dropdown */}
      <div className="w-full md:w-48">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            onFilterChange({ search, category: e.target.value, sortBy });
          }}
          className="w-full bg-slate-950/70 border border-slate-850 rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-emerald-500 cursor-pointer"
          aria-label="Filter by Service Category"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option
              key={cat}
              value={cat}
            >
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Sort selection */}
      <div className="w-full md:w-48">
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            onFilterChange({ search, category, sortBy: e.target.value });
          }}
          className="w-full bg-slate-950/70 border border-slate-850 rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-emerald-500 cursor-pointer"
          aria-label="Sort configuration options"
        >
          <option value="recent">Most Recent</option>
          <option value="rating">Highest Rated</option>
          <option value="budget_low">Budget: Low to High</option>
          <option value="budget_high">Budget: High to Low</option>
        </select>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleApply}
        className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        Filter
      </button>
    </div>
  );
}

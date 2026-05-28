"use client";

import { useState, useEffect, useCallback } from "react";

export interface SearchFilters {
  category?: string;
  rating_min?: number;
  price_min?: number;
  price_max?: number;
  page?: number;
}

export interface ProviderResult {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  location: string;
  rating: number;
  reviewCount: number;
  minPrice: number;
  maxPrice: number;
  categories: string[];
  techStack: string[];
}

export interface SearchState {
  query: string;
  filters: SearchFilters;
  results: ProviderResult[];
  loading: boolean;
  error: string | null;
  history: string[];
}

const HISTORY_KEY = "kavshare_search_history";

export function useMarketplaceSearch(initialFilters: SearchFilters = {}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    page: 1,
    ...initialFilters,
  });
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  // Load search history from localStorage (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors on server/restricted envs
    }
  }, []);

  // Debounce the query to prevent fast sequential API fetches
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // Execute API Search Query
  const triggerSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (filters.category) params.set("category", filters.category);
      if (filters.rating_min) params.set("rating_min", filters.rating_min.toString());
      if (filters.price_min) params.set("price_min", filters.price_min.toString());
      if (filters.price_max) params.set("price_max", filters.price_max.toString());
      if (filters.page) params.set("page", filters.page.toString());

      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search request failed");

      const responseData = await res.json();
      if (responseData.success) {
        setResults(responseData.data);

        // Append non-empty query to history list
        if (debouncedQuery.trim()) {
          setHistory((prev) => {
            const nextHistory = [
              debouncedQuery.trim(),
              ...prev.filter((h) => h !== debouncedQuery.trim()),
            ].slice(0, 10);
            try {
              localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
            } catch {
              // Ignore storage errors
            }
            return nextHistory;
          });
        }
      } else {
        throw new Error(responseData.error || "Search error");
      }
    } catch (err: any) {
      setError(err.message || "Failed resolving search query");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filters]);

  // Run search whenever debounced query or filters modify
  useEffect(() => {
    triggerSearch();
  }, [triggerSearch]);

  const updateFilters = useCallback((newFilters: SearchFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setFilters({ page: 1 });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    query,
    setQuery,
    filters,
    updateFilters,
    clearFilters,
    results,
    loading,
    error,
    history,
    clearHistory,
    refetch: triggerSearch,
  };
}

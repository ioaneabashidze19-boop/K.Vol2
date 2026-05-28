"use client";

import { Search, Filter, SlidersHorizontal, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

import ProviderCard from "@/components/marketplace/ProviderCard";
import { supabase } from "@/lib/supabaseClient";

// Pre-seeded high-fidelity mock providers in case local database is unseeded
const mockProviders = [
  {
    id: "provider-1",
    name: "Apex Software Labs",
    description: "Specialized in high-throughput enterprise SaaS development and robust cloud integrations.",
    category: "saas",
    rating: 4.8,
    reviewCount: 34,
    minPrice: 5000,
    maxPrice: 25000,
    techStack: ["React", "Node.js", "GraphQL", "AWS"],
    available: true,
  },
  {
    id: "provider-2",
    name: "PixelCraft Studios",
    description: "Award-winning UI/UX design agency focused on crafting modern digital products and landing pages.",
    category: "design",
    rating: 4.9,
    reviewCount: 28,
    minPrice: 3000,
    maxPrice: 12000,
    techStack: ["Figma", "Tailwind CSS", "Next.js", "Framer Motion"],
    available: true,
  },
  {
    id: "provider-3",
    name: "Nimbus Architects",
    description: "Architecting serverless backend databases and Kubernetes orchestration layouts.",
    category: "cloud",
    rating: 4.7,
    reviewCount: 19,
    minPrice: 8000,
    maxPrice: 45000,
    techStack: ["Kubernetes", "Docker", "Terraform", "Go"],
    available: false,
  },
  {
    id: "provider-4",
    name: "Vortex Data Analytics",
    description: "Extracting complex data intelligence streams and setting up telemetry pipelines.",
    category: "data",
    rating: 4.6,
    reviewCount: 22,
    minPrice: 6000,
    maxPrice: 30000,
    techStack: ["Python", "Apache Kafka", "PostgreSQL", "ClickHouse"],
    available: true,
  },
];

export default function MarketplacePage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(50000);
  const [sortBy, setSortBy] = useState<string>("rating");
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);

  // Fetch from Supabase
  const loadProviders = async () => {
    setLoading(true);
    try {
      // 1. Fetch companies
      const { data: dbCompanies, error: compError } = await supabase
        .from("companies")
        .select("id, name, description, logo_url, location, status");

      if (compError) throw compError;

      // 2. Fetch services for prices and tags
      const { data: dbServices, error: servError } = await supabase
        .from("services")
        .select("company_id, category, starting_price, tech_stack");

      if (servError) throw servError;

      // 3. Fetch reviews for calculating average rating
      const { data: dbReviews, error: revError } = await supabase
        .from("reviews")
        .select("rating, engagement_id, engagements (company_id)");

      if (revError) throw revError;

      if (!dbCompanies || dbCompanies.length === 0) {
        // Fallback to high-fidelity mocks if empty
        setProviders(mockProviders);
        setLoading(false);
        return;
      }

      // Map Supabase rows to ProviderCard model
      const mapped = dbCompanies.map((company: any) => {
        const companyServices = dbServices?.filter((s) => s.company_id === company.id) || [];
        const companyReviews = dbReviews?.filter((r: any) => r.engagements?.company_id === company.id) || [];

        const avgRating =
          companyReviews.length > 0
            ? Number((companyReviews.reduce((sum, r) => sum + r.rating, 0) / companyReviews.length).toFixed(1))
            : 5.0; // Default to high score if unreviewed

        const minPrice = companyServices.length > 0 ? Math.min(...companyServices.map((s) => Number(s.starting_price))) : 1500;
        const maxPrice = companyServices.length > 0 ? Math.max(...companyServices.map((s) => Number(s.starting_price))) * 3 : 10000;
        const category = companyServices[0]?.category || "saas";
        const techStack = Array.from(new Set(companyServices.flatMap((s) => s.tech_stack || [])));

        return {
          id: company.id,
          name: company.name,
          description: company.description || "No description provided.",
          category,
          rating: avgRating,
          reviewCount: companyReviews.length,
          minPrice,
          maxPrice,
          techStack: techStack.length > 0 ? techStack : ["Web Development", "Cloud Solutions"],
          available: company.status === "active",
        };
      });

      setProviders(mapped);
    } catch (err) {
      // Graceful fallback to mock data on local connection errors
      setProviders(mockProviders);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  // Filter and sorting evaluation
  const filteredProviders = providers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.techStack.some((tech: string) => tech.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(p.category);

    const matchesRating = p.rating >= minRating;
    const matchesPrice = p.minPrice <= maxPrice;
    const matchesAvailability = !onlyAvailable || p.available;

    return matchesSearch && matchesCategory && matchesRating && matchesPrice && matchesAvailability;
  });

  // Sort calculation
  const sortedProviders = [...filteredProviders].sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "price_asc") return a.minPrice - b.minPrice;
    if (sortBy === "price_desc") return b.minPrice - a.minPrice;
    return 0;
  });

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setMinRating(0);
    setMaxPrice(50000);
    setOnlyAvailable(false);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 gap-8">
      {/* 1. FILTER SIDEBAR */}
      <aside className="w-full lg:w-64 flex flex-col gap-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 h-fit backdrop-blur-md">
        <div className="flex items-center justify-between pb-4 border-b border-slate-850">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-text-primary">Filters</h2>
          </div>
          {filteredProviders.length !== providers.length && (
            <button
              onClick={clearFilters}
              className="text-xs text-brand-accent hover:text-cyan-300 font-semibold"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
            Keywords
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search stack, names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-text-primary focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
            Category
          </label>
          <div className="flex flex-col gap-2">
            {["saas", "design", "cloud", "data"].map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer hover:text-text-primary"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                />
                <span className="capitalize">{cat === "saas" ? "SaaS Dev" : cat === "design" ? "UI/UX Design" : cat === "cloud" ? "Cloud Infra" : "Data Science"}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rating filter */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
              Min Rating
            </label>
            <span className="text-[10px] font-bold text-cyan-400">{minRating || "Any"} ★</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        {/* Price filter */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
              Max Starting Budget
            </label>
            <span className="text-[10px] font-bold text-cyan-400">${maxPrice.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min="1000"
            max="50000"
            step="1000"
            value={maxPrice}
            onChange={(e) => setMaxPrice(parseInt(e.target.value))}
            className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        {/* Availability Switch */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-850/55">
          <span className="text-xs text-text-secondary">Available Only</span>
          <button
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className={`w-9 h-5 rounded-full transition-colors relative flex items-center ${
              onlyAvailable ? "bg-cyan-500" : "bg-slate-950 border border-slate-850"
            }`}
          >
            <span
              className={`h-3.5 w-3.5 rounded-full bg-slate-100 absolute transition-all ${
                onlyAvailable ? "right-1" : "left-1"
              }`}
            />
          </button>
        </div>
      </aside>

      {/* 2. MAIN DIRECTORY GRID */}
      <main className="flex-1 flex flex-col gap-6">
        {/* Marketplace subheader */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-900">
          <div>
            <h2 className="text-xl font-bold text-text-primary">All Active Providers</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Showing {sortedProviders.length} of {providers.length} registered agencies
            </p>
          </div>

          <div className="flex items-center gap-2 self-end">
            <SlidersHorizontal className="h-3.5 w-3.5 text-text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-text-secondary px-3 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="rating">Sort: Best Rating</option>
              <option value="price_asc">Sort: Price Low to High</option>
              <option value="price_desc">Sort: Price High to Low</option>
            </select>
            <button
              onClick={loadProviders}
              className="p-2 hover:bg-slate-900 rounded-lg border border-slate-800 transition"
              title="Refresh provider database"
            >
              <RefreshCw className="h-3.5 w-3.5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-slate-900/30 border border-slate-850 rounded-xl p-5 space-y-4 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="h-5 w-20 bg-slate-800 rounded" />
                  <div className="h-4 w-12 bg-slate-800 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-5 w-2/3 bg-slate-800 rounded" />
                  <div className="h-3 w-full bg-slate-800 rounded" />
                  <div className="h-3 w-5/6 bg-slate-800 rounded" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-4 w-12 bg-slate-800 rounded" />
                  <div className="h-4 w-16 bg-slate-800 rounded" />
                </div>
                <div className="border-t border-slate-850 pt-3 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="h-3 w-16 bg-slate-800 rounded" />
                    <div className="h-4 w-12 bg-slate-800 rounded" />
                  </div>
                  <div className="h-8 w-24 bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedProviders.length === 0 ? (
          /* Empty state placeholder */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/20 border border-dashed border-slate-850 rounded-3xl p-8">
            <span className="text-4xl mb-4">🔍</span>
            <h3 className="text-lg font-bold text-text-primary mb-1">No matches found</h3>
            <p className="text-xs text-text-secondary max-w-sm leading-relaxed">
              We couldn't find any provider companies matching your current filters. Try relaxing your budget limits or selecting additional category tags.
            </p>
            <button
              onClick={clearFilters}
              className="mt-6 bg-slate-800 hover:bg-slate-700 text-text-primary px-5 py-2.5 rounded-lg text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Provider Cards Grid */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                id={provider.id}
                name={provider.name}
                description={provider.description}
                category={provider.category}
                rating={provider.rating}
                reviewCount={provider.reviewCount}
                minPrice={provider.minPrice}
                maxPrice={provider.maxPrice}
                techStack={provider.techStack}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

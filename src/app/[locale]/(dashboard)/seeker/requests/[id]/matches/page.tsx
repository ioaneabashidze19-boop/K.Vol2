"use client";

import {
  ChevronDown,
  ChevronUp,
  Star,
  SlidersHorizontal,
  Layers,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Inbox,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState, useEffect } from "react";

interface MatchPageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

interface MatchedProvider {
  company_id: string;
  company_name: string;
  logo_url: string;
  description: string;
  rating: number;
  reviewCount: number;
  totalScore: number;
  scoreBreakdown: {
    categoryFit: number;
    industryRelevance: number;
    clientSizeFit: number;
    priceFit: number;
    performance: number;
    reliabilityWorkflow: number;
  };
  matchExplanations: string[];
  services: any[];
  priceRange: {
    min: number;
    max: number;
  };
  viewProfileUrl: string;
}

export default function SeekerRequestMatchesPage({ params }: MatchPageProps) {
  const resolvedParams = use(params);
  const requestId = resolvedParams.id;
  const currentLocale = resolvedParams.locale;
  const router = useRouter();

  const [requestDetails, setRequestDetails] = useState<any>(null);
  const [matches, setMatches] = useState<MatchedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "price">("relevance");
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [expandedProviderBreakdown, setExpandedProviderBreakdown] = useState<string | null>(null);
  const [successEngagement, setSuccessEngagement] = useState<string | null>(null);
  const [engagingId, setEngagingId] = useState<string | null>(null);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matching/providers?request_id=${requestId}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load matching providers");
      }
      setRequestDetails(payload.data.requestDetails);
      setMatches(payload.data.matches);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred loading match data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [requestId]);

  const handleRequestService = async (providerId: string) => {
    setEngagingId(providerId);
    // Simulate API engagement post submission
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setEngagingId(null);
    setSuccessEngagement(providerId);
    setTimeout(() => {
      setSuccessEngagement(null);
    }, 4000);
  };

  // Sort logic applied client-side based on filter selection
  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === "rating") {
      return b.rating - a.rating;
    }
    if (sortBy === "price") {
      return a.priceRange.min - b.priceRange.min;
    }
    return b.totalScore - a.totalScore;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-32 bg-slate-950 text-slate-100">
        <div className="h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-technical text-text-secondary animate-pulse">Running advanced matchmaking scoring engine...</span>
      </div>
    );
  }

  if (error || !requestDetails) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-24 bg-slate-950 text-slate-100 text-center px-6">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold">Failed to Load Matches</h2>
        <p className="text-xs text-text-muted mt-2 max-w-md mx-auto">{error || "Could not retrieve request configurations."}</p>
        <div className="flex gap-4 mt-8">
          <button
            onClick={fetchMatches}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try Again
          </button>
          <Link
            href={`/${currentLocale}/seeker/new-request`}
            className="bg-cyan-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition hover:bg-cyan-400"
          >
            Create New Request
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
        {/* Back Link */}
        <Link
          href={`/${currentLocale}`}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-cyan-400 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>

        {/* 1. REQUEST SUMMARY CARD */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md">
          <div
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-900/20 transition select-none"
          >
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Matching Reference Request
              </span>
              <h1 className="text-lg font-black text-text-primary tracking-tight">{requestDetails.title}</h1>
            </div>
            <button className="p-2 bg-slate-950 border border-slate-850 rounded-xl text-text-muted hover:text-text-primary transition">
              {isSummaryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {isSummaryExpanded && (
            <div className="px-5 pb-6 pt-2 border-t border-slate-850/60 space-y-4 text-xs text-text-secondary">
              <p className="leading-relaxed whitespace-pre-line">{requestDetails.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-850/40">
                <div>
                  <span className="text-[10px] text-text-muted block">Target Budget</span>
                  <span className="font-extrabold text-cyan-400 mt-0.5 block">
                    ${Number(requestDetails.budget).toLocaleString()} ({requestDetails.budget_type})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block">Primary Category</span>
                  <span className="font-semibold text-text-primary mt-0.5 block flex items-center gap-1">
                    <Layers className="h-3 w-3 text-cyan-400" /> {requestDetails.category}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block">Industry Sector</span>
                  <span className="font-semibold text-text-primary mt-0.5 block capitalize">{requestDetails.industry}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block">Timeline / PM Style</span>
                  <span className="font-semibold text-text-primary mt-0.5 block capitalize">{requestDetails.pm_style}</span>
                </div>
              </div>

              {requestDetails.required_tools.length > 0 && (
                <div className="pt-3 border-t border-slate-850/40">
                  <span className="text-[10px] text-text-muted block mb-1.5">Required Tech Stack</span>
                  <div className="flex flex-wrap gap-1.5">
                    {requestDetails.required_tools.map((tool: string) => (
                      <span key={tool} className="bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-[10px] font-semibold text-text-muted">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. MATCH RESULTS HEADER & CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
          <div>
            <h2 className="text-xl font-black text-text-primary tracking-tight">
              {sortedMatches.length} Provider{sortedMatches.length === 1 ? "" : "s"} Matched
            </h2>
            <p className="text-xs text-text-muted">Ranked dynamically by weighted suitability score</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted flex items-center gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Sort By:
            </span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-text-primary rounded-xl px-3 py-1.5 outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="relevance">Match Score (High to Low)</option>
              <option value="rating">Client Rating</option>
              <option value="price">Starting Price (Low to High)</option>
            </select>
          </div>
        </div>

        {/* 3. MATCH CARDS LIST / NO RESULTS */}
        {sortedMatches.length === 0 ? (
          <div className="bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl p-12 text-center space-y-4">
            <div className="h-12 w-12 bg-slate-950 rounded-full flex items-center justify-center mx-auto border border-slate-850">
              <Inbox className="h-5 w-5 text-text-muted" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-text-primary">No Matching Providers Found</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                Try widening your budget, reducing compliance requirements, or modifying preferred technology filters.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => router.push(`/${currentLocale}/seeker/new-request`)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold text-text-primary transition"
              >
                Refine Parameters
              </button>
              <button
                onClick={() => {}}
                className="bg-cyan-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition hover:bg-cyan-400"
              >
                Post Public Request
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMatches.map((provider) => {
              const isExpanded = expandedProviderBreakdown === provider.company_id;
              const hasProposalSent = successEngagement === provider.company_id;

              return (
                <div
                  key={provider.company_id}
                  className="bg-slate-900/40 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-6 transition-all duration-300 relative group overflow-hidden"
                >
                  <div className="absolute top-0 right-0 h-[100px] w-[100px] bg-gradient-to-br from-cyan-500/5 to-transparent blur-md pointer-events-none" />

                  {/* Top Header Row */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-850/60">
                    <div className="flex items-center gap-4">
                      {provider.logo_url ? (
                        <img
                          src={provider.logo_url}
                          alt={provider.company_name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0"
                        />
                      ) : (
                        <span className="w-12 h-12 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-center font-bold text-cyan-400 shrink-0 text-sm">
                          {provider.company_name[0]}
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-text-primary group-hover:text-cyan-400 transition">
                            {provider.company_name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <div className="flex items-center text-amber-400 gap-0.5">
                            <Star className="h-3.5 w-3.5 fill-amber-400" />
                            <span className="font-bold">{provider.rating.toFixed(1)}</span>
                          </div>
                          <span className="text-text-muted">({provider.reviewCount} reviews)</span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Score Circle Indicator */}
                    <div className="flex items-center gap-3 self-stretch md:self-auto justify-between bg-slate-950/60 border border-slate-850 px-4 py-2.5 rounded-2xl">
                      <div className="text-left">
                        <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block">Match Rating</span>
                        <span className="text-xs text-text-secondary">Weighted criteria</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-cyan-400">{provider.totalScore.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Summary Body */}
                  <div className="grid md:grid-cols-3 gap-6 pt-4 text-xs">
                    {/* Brief description */}
                    <div className="md:col-span-2 space-y-4">
                      <p className="text-text-secondary leading-relaxed line-clamp-3">{provider.description}</p>
                      
                      {/* Explanations bullets */}
                      <div className="space-y-1.5">
                        {provider.matchExplanations.map((exp, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>{exp}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Meta stats right col */}
                    <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Est. Price Range:</span>
                          <span className="font-extrabold text-cyan-400">
                            {provider.priceRange.min > 0
                              ? `$${provider.priceRange.min.toLocaleString()} - $${provider.priceRange.max.toLocaleString()}`
                              : "Custom Quote"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Service Type:</span>
                          <span className="text-text-primary capitalize font-medium">
                            {provider.services[0]?.format || "Contract"}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/${currentLocale}/marketplace/providers/${provider.company_id}`}
                          className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-center py-2.5 rounded-xl text-[10px] font-bold text-text-primary flex items-center justify-center gap-1.5 transition"
                          target="_blank"
                        >
                          View Profile <ExternalLink className="h-3 w-3" />
                        </Link>
                        
                        {hasProposalSent ? (
                          <button
                            disabled
                            className="flex-1 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 py-2.5 rounded-xl text-[10px] font-bold"
                          >
                            Requested ✓
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRequestService(provider.company_id)}
                            disabled={engagingId === provider.company_id}
                            className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-extrabold py-2.5 rounded-xl text-[10px] transition disabled:opacity-50"
                          >
                            {engagingId === provider.company_id ? "Sending..." : "Request Service"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Score Breakdown details */}
                  <div className="mt-4 pt-4 border-t border-slate-850/60">
                    <button
                      onClick={() => setExpandedProviderBreakdown(isExpanded ? null : provider.company_id)}
                      className="text-text-muted hover:text-text-primary text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-cyan-400" /> 
                      {isExpanded ? "Hide detailed score evaluation" : "Show detailed score evaluation"}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 bg-slate-950/60 border border-slate-850 rounded-2xl p-4 grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-text-muted">
                            <span>Service Match:</span>
                            <span className="font-semibold text-text-primary">{provider.scoreBreakdown.categoryFit}/30 pts</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(provider.scoreBreakdown.categoryFit / 30) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-text-muted">
                            <span>Industry Relevance:</span>
                            <span className="font-semibold text-text-primary">{provider.scoreBreakdown.industryRelevance}/15 pts</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(provider.scoreBreakdown.industryRelevance / 15) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-text-muted">
                            <span>Client Size Fit:</span>
                            <span className="font-semibold text-text-primary">{provider.scoreBreakdown.clientSizeFit}/10 pts</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(provider.scoreBreakdown.clientSizeFit / 10) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-text-muted">
                            <span>Budget/Price Fit:</span>
                            <span className="font-semibold text-text-primary">{provider.scoreBreakdown.priceFit}/15 pts</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(provider.scoreBreakdown.priceFit / 15) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-text-muted">
                            <span>Performance Vetting:</span>
                            <span className="font-semibold text-text-primary">{provider.scoreBreakdown.performance}/15 pts</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(provider.scoreBreakdown.performance / 15) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-text-muted">
                            <span>Workflow & PM style:</span>
                            <span className="font-semibold text-text-primary">{provider.scoreBreakdown.reliabilityWorkflow}/15 pts</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(provider.scoreBreakdown.reliabilityWorkflow / 15) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

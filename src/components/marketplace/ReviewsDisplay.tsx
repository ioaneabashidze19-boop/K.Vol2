"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Star,
  Loader2,
  CheckCircle,
  MessageSquare,
  ChevronDown,
  ArrowUpDown,
  AlertCircle
} from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string;
  anonymous: boolean;
  created_at: string;
  reviewer?: {
    name: string;
    role?: string;
  } | null;
}

interface ReviewsDisplayProps {
  companyId: string;
  locale?: string;
}

export default function ReviewsDisplay({ companyId, locale = "en" }: ReviewsDisplayProps) {
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Data states
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibleContractId, setEligibleContractId] = useState<string | null>(null);

  // Filter/Sort states
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Expanded card states (for read more truncation)
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  async function fetchReviewsAndEligibility() {
    try {
      setLoading(true);

      // 1. Fetch all reviews for this company's engagements
      // Join: reviews -> engagements -> companies
      const { data: rawReviews, error: reviewsErr } = await supabase
        .from("reviews")
        .select(`
          id,
          rating,
          comment,
          anonymous,
          created_at,
          engagement:engagements!inner(
            company_id
          ),
          reviewer:users(
            name,
            role
          )
        `)
        .eq("engagement.company_id", companyId);

      if (reviewsErr) throw reviewsErr;

      setReviews((rawReviews as any) || []);

      // 2. If logged in, check if user is eligible to write a review
      if (user) {
        // Resolve dbUser
        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (dbUser) {
          // Find seeker profile
          const { data: seeker } = await supabase
            .from("seekers")
            .select("id")
            .eq("user_id", dbUser.id)
            .single();

          if (seeker) {
            // Find completed engagements for this company & seeker
            const { data: completedEngagements } = await supabase
              .from("engagements")
              .select("id")
              .eq("company_id", companyId)
              .eq("seeker_id", seeker.id)
              .eq("status", "completed");

            if (completedEngagements && completedEngagements.length > 0) {
              const engagementIds = completedEngagements.map((e) => e.id);

              // Check if any of these engagements DO NOT have a review yet
              const { data: existingReviews } = await supabase
                .from("reviews")
                .select("engagement_id")
                .in("engagement_id", engagementIds);

              const reviewedEngagementIds = (existingReviews || []).map((r) => r.engagement_id);
              const unreviewedEngagement = completedEngagements.find(
                (e) => !reviewedEngagementIds.includes(e.id)
              );

              if (unreviewedEngagement) {
                // Find corresponding contract
                const { data: contract } = await supabase
                  .from("contracts")
                  .select("id")
                  .eq("engagement_id", unreviewedEngagement.id)
                  .limit(1)
                  .single();

                if (contract) {
                  setEligibleContractId(contract.id);
                }
              }
            }
          }
        }
      }

    } catch (err) {
      console.error("Error loading reviews layout:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    fetchReviewsAndEligibility();
  }, [companyId, isLoaded, user]);

  // Aggregate stats
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : "0.0";

  // Stars breakdown calculation
  const starCounts = [0, 0, 0, 0, 0]; // Index 0 = 1 star, 4 = 5 star
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      starCounts[r.rating - 1]++;
    }
  });

  const getPercentage = (count: number) => {
    return totalReviews > 0 ? ((count / totalReviews) * 100).toFixed(0) : "0";
  };

  // Toggle comment expand
  const toggleComment = (id: string) => {
    setExpandedComments((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Format relative date (e.g. 2 months ago)
  const formatRelativeDate = (dateStr: string) => {
    const past = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return isKa ? "დღეს" : "today";
    if (diffDays === 1) return isKa ? "გუშინ" : "yesterday";
    if (diffDays < 30) return isKa ? `${diffDays} დღის წინ` : `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return isKa ? "1 თვის წინ" : "1 month ago";
    return isKa ? `${diffMonths} თვის წინ` : `${diffMonths} months ago`;
  };

  // Filtering & Sorting logic
  const filteredReviews = reviews
    .filter((r) => {
      if (ratingFilter === "all") return true;
      const numFilter = parseInt(ratingFilter, 10);
      return r.rating === numFilter;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "highest") {
        return b.rating - a.rating;
      }
      if (sortBy === "lowest") {
        return a.rating - b.rating;
      }
      return 0;
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 text-cyan-450 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Review Header Stats Grid */}
      <div className="grid md:grid-cols-3 gap-6 bg-slate-900/20 border border-slate-850 p-6 rounded-3xl">
        
        {/* Overall Rating Card */}
        <div className="flex flex-col justify-center items-center text-center p-4 border-b md:border-b-0 md:border-r border-slate-850/80">
          <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">
            {isKa ? "საშუალო შეფასება" : "Average Rating"}
          </span>
          <h2 className="text-5xl font-black text-cyan-400 mt-2 tracking-tight">
            {averageRating}
          </h2>
          <div className="flex items-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= Math.round(Number(averageRating))
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-700"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-text-muted mt-2 font-mono">
            {totalReviews} {isKa ? "შეფასება" : "verified reviews"}
          </span>
        </div>

        {/* Star Breakdown Card */}
        <div className="md:col-span-2 flex flex-col justify-center gap-2 p-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = starCounts[stars - 1];
            const pct = getPercentage(count);
            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-right text-text-secondary font-mono">
                  {stars} {isKa ? "ვარსკ." : "stars"}
                </span>
                <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-text-muted font-mono">{pct}%</span>
              </div>
            );
          })}
        </div>

      </div>

      {/* Eligible Write Review Alert Banner */}
      {eligibleContractId && (
        <div className="bg-gradient-to-r from-emerald-950/20 to-slate-900/30 border border-emerald-800/30 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">Write Verified Review</h4>
              <p className="text-[11px] text-text-secondary mt-0.5">
                You have a completed engagement with this company. Share your verified experience!
              </p>
            </div>
          </div>

          <Link
            href={`/seeker/contracts/${eligibleContractId}/review`}
            className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition text-xs shrink-0"
          >
            {isKa ? "შეფასების დაწერა" : "Write Review Now"}
          </Link>
        </div>
      )}

      {/* Filter and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/10 border border-slate-850 px-5 py-3 rounded-2xl text-xs">
        
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-text-muted" />
          <span className="font-bold text-text-secondary">{isKa ? "ფილტრი:" : "Filter:"}</span>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 focus:outline-none focus:border-slate-700 transition"
          >
            <option value="all">{isKa ? "ყველა შეფასება" : "All ratings"}</option>
            <option value="5">5 {isKa ? "ვარსკვლავი" : "stars only"}</option>
            <option value="4">4 {isKa ? "ვარსკვლავი" : "stars only"}</option>
            <option value="3">3 {isKa ? "ვარსკვლავი" : "stars only"}</option>
            <option value="2">2 {isKa ? "ვარსკვლავი" : "stars only"}</option>
            <option value="1">1 {isKa ? "ვარსკვლავი" : "star only"}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-text-muted" />
          <span className="font-bold text-text-secondary">{isKa ? "სორტირება:" : "Sort:"}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 focus:outline-none focus:border-slate-700 transition"
          >
            <option value="newest">{isKa ? "უახლესი" : "Newest"}</option>
            <option value="highest">{isKa ? "უმაღლესი შეფასება" : "Highest Rated"}</option>
            <option value="lowest">{isKa ? "უმდაბლესი შეფასება" : "Lowest Rated"}</option>
          </select>
        </div>

      </div>

      {/* Reviews Cards List */}
      {filteredReviews.length === 0 ? (
        <div className="bg-slate-900/10 border border-slate-850 p-10 rounded-2xl text-center space-y-2">
          <AlertCircle className="h-7 w-7 text-text-muted mx-auto" />
          <p className="text-xs text-text-muted">
            {totalReviews === 0
              ? isKa
                ? "შეფასებები ჯერ არ არის"
                : "No verified reviews posted yet."
              : isKa
              ? "მოთხოვნილი შეფასება ვერ მოიძებნა"
              : "No reviews match your selected filter criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => {
            const isCommentTooLong = (review.comment || "").length > 300;
            const isExpanded = expandedComments[review.id];
            const displayComment =
              isCommentTooLong && !isExpanded
                ? `${review.comment.slice(0, 300)}...`
                : review.comment;

            return (
              <div
                key={review.id}
                className="bg-slate-900/20 border border-slate-850 p-6 rounded-2xl hover:border-slate-800 transition duration-200 space-y-4 relative overflow-hidden"
              >
                
                {/* Verified transaction ribbon */}
                <div className="absolute top-0 right-0 bg-cyan-950/40 text-cyan-400 text-[8px] uppercase tracking-widest font-mono font-black border-l border-b border-cyan-800/30 px-3 py-1 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {isKa ? "ვერიფიცირებული" : "Verified Client"}
                </div>

                {/* Stars and date */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">
                    {formatRelativeDate(review.created_at)}
                  </span>
                </div>

                {/* Comment Text */}
                <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                  {displayComment}
                  {isCommentTooLong && (
                    <button
                      onClick={() => toggleComment(review.id)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold ml-1.5 focus:outline-none flex items-center gap-0.5 inline-flex"
                    >
                      {isExpanded ? (isKa ? "ნაკლების ჩვენება" : "Read Less") : (isKa ? "სრულად წაკითხვა" : "Read More")}
                      <ChevronDown className={`h-3 w-3 transition duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>

                {/* Reviewer Details */}
                <div className="border-t border-slate-900/40 pt-3 flex items-center justify-between text-[10px]">
                  <div>
                    <span className="text-text-muted">Reviewer:</span>{" "}
                    <strong className="text-text-primary">
                      {review.anonymous ? (isKa ? "ანონიმი" : "Anonymous client") : review.reviewer?.name || "Client User"}
                    </strong>
                    {(!review.anonymous && review.reviewer?.role) && (
                      <span className="text-text-muted font-mono ml-1.5 uppercase text-[9px] bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded">
                        {review.reviewer.role}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

"use client";

import { use, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Loader2,
  Star,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ArrowLeft
} from "lucide-react";

interface ReviewSubmissionProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default function ReviewSubmissionPage({ params }: ReviewSubmissionProps) {
  const { locale, id: contractId } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Lifecycle & data states
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any | null>(null);
  const [existingReview, setExistingReview] = useState<any | null>(null);
  
  // Form states
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load contract details and previous review
  async function loadReviewSetup() {
    try {
      setLoading(true);
      setSubmitError(null);

      // 1. Fetch Clerk user corresponding database user
      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", user?.id)
        .single();

      if (!dbUser) return;

      // 2. Fetch contract & parent engagement
      const { data: contractData, error: contractErr } = await supabase
        .from("contracts")
        .select(`
          id,
          status,
          start_date,
          end_date,
          monthly_value,
          engagement:engagements(
            id,
            seeker_id,
            company_id,
            status,
            company:companies(id, name),
            procurement:procurement_requests(id, title)
          )
        `)
        .eq("id", contractId)
        .single();

      if (contractErr || !contractData) {
        console.error("Contract load error:", contractErr);
        setSubmitError(isKa ? "კონტრაქტი ვერ მოიძებნა" : "Contract record not found.");
        return;
      }

      const engagementObj = Array.isArray(contractData.engagement)
        ? contractData.engagement[0]
        : (contractData.engagement as any);

      if (!engagementObj) {
        setSubmitError(isKa ? "კავშირი ვერ მოიძებნა" : "Contract engagement record not found.");
        return;
      }

      const formattedContract = {
        ...contractData,
        engagement: engagementObj
      };

      setContract(formattedContract);

      // 3. Fetch existing review for this engagement
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("*")
        .eq("engagement_id", engagementObj.id)
        .single();

      if (reviewData) {
        setExistingReview(reviewData);
        setRating(reviewData.rating);
        setComment(reviewData.comment || "");
        setAnonymous(reviewData.anonymous || false);
      }
    } catch (err: any) {
      console.error("Error setting up review page:", err);
      setSubmitError(err.message || "Failed loading contract parameters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadReviewSetup();
  }, [isLoaded, user]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    setSubmitError(null);

    // Star validation
    if (rating < 1 || rating > 5) {
      setSubmitError(isKa ? "გთხოვთ აირჩიოთ შეფასება (1-5 ვარსკვლავი)" : "Please select a rating of 1 to 5 stars.");
      return;
    }

    // Length check
    if (comment.length < 100 || comment.length > 500) {
      setSubmitError(
        isKa
          ? "შეფასების ტექსტი უნდა იყოს 100-დან 500 სიმბოლომდე"
          : "Review testimonial text must be between 100 and 500 characters long."
      );
      return;
    }

    try {
      setSubmitting(true);

      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", user?.id)
        .single();

      if (!dbUser) throw new Error("Authenticated session user not resolved");

      const reviewPayload = {
        engagement_id: contract.engagement.id,
        reviewer_id: dbUser.id,
        rating,
        comment,
        anonymous,
        updated_at: new Date().toISOString()
      };

      if (existingReview) {
        // Update review
        const { error } = await supabase
          .from("reviews")
          .update(reviewPayload)
          .eq("id", existingReview.id);

        if (error) throw error;
      } else {
        // Insert new review
        const { error } = await supabase
          .from("reviews")
          .insert({
            ...reviewPayload,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push("/seeker/contracts");
      }, 2500);

    } catch (err: any) {
      console.error("Failed submitting review:", err);
      setSubmitError(err.message || "Failed to commit review record");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "იტვირთება შეფასების ფორმა..." : "Compiling gated review form..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["seeker"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Back Navigation */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition"
          >
            <ArrowLeft className="h-4 w-4" />
            {isKa ? "უკან დაბრუნება" : "Back to Contracts"}
          </button>

          {/* Header */}
          <div>
            <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest font-mono">
              {isKa ? "კომპანიის შეფასება" : "Provider Quality Review"}
            </span>
            <h1 className="text-2xl font-black text-text-primary tracking-tight">
              {isKa ? "დატოვეთ შეფასება" : "Submit Verification Review"}
            </h1>
          </div>

          {/* Verification Banner */}
          {contract && (
            <div className="bg-gradient-to-r from-cyan-950/20 to-slate-900/40 border border-cyan-800/30 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-9 w-9 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest font-mono">Verified Engagement</h4>
                  <p className="text-sm font-bold text-text-primary mt-1">
                    {Array.isArray(contract.engagement.company)
                      ? contract.engagement.company[0]?.name
                      : (contract.engagement.company as any)?.name || "Provider Company"}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {Array.isArray(contract.engagement.procurement)
                      ? contract.engagement.procurement[0]?.title
                      : (contract.engagement.procurement as any)?.title || (isKa ? "პროექტი" : "Procurement Project")}
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono text-text-secondary space-y-0.5 border-t md:border-t-0 md:border-l border-slate-800 md:pl-5 pt-3 md:pt-0">
                <div>Contract: {contract.id.slice(0, 8)}...</div>
                <div>Started: {new Date(contract.start_date).toLocaleDateString()}</div>
                <div>Value: ${Number(contract.monthly_value).toLocaleString()} / month</div>
              </div>
            </div>
          )}

          {/* Layout Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Review Form Column */}
            <div className="md:col-span-2 space-y-6">
              
              <form onSubmit={handleFormSubmit} className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-6">
                
                {submitSuccess ? (
                  <div className="bg-emerald-950/20 border border-emerald-800/30 p-6 rounded-2xl text-center space-y-3">
                    <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-extrabold text-emerald-400">Review Submitted!</h3>
                    <p className="text-xs text-text-muted">
                      Your testimonial has been verified and recorded successfully. Redirecting...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Error Box */}
                    {submitError && (
                      <div className="bg-rose-950/20 border border-rose-800/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-rose-400">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>{submitError}</p>
                      </div>
                    )}

                    {/* Star Rating Selector */}
                    <div className="space-y-2">
                      <label className="block text-xs uppercase font-extrabold text-text-secondary tracking-wider">
                        {isKa ? "ვარსკვლავები" : "Star Rating"}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 transition duration-150 hover:scale-110"
                          >
                            <Star
                              className={`h-7 w-7 ${
                                star <= (hoverRating || rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-700 hover:text-slate-500"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Comment Testimonial Textarea */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <label className="block text-xs uppercase font-extrabold text-text-secondary tracking-wider">
                          {isKa ? "შეფასების ტექსტი" : "Review Testimonial"}
                        </label>
                        <span className="text-[10px] text-text-muted font-mono">
                          {comment.length} / 500 (Min 100)
                        </span>
                      </div>
                      
                      <textarea
                        required
                        rows={6}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-4 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition"
                        placeholder={
                          isKa
                            ? "დაწერეთ თქვენი გამოცდილება ამ პარტნიორთან (მინიმუმ 100 სიმბოლო)..."
                            : "Share your onboarding experience, quality of service, communication, and overall outcome (Min 100 characters)..."
                        }
                      />
                    </div>

                    {/* Anonymous Checkbox */}
                    <label className="flex items-start gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-900 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={anonymous}
                        onChange={(e) => setAnonymous(e.target.checked)}
                        className="mt-0.5 accent-cyan-500 rounded border-slate-800"
                      />
                      <div>
                        <span className="block text-xs font-bold text-text-primary">
                          {isKa ? "ანონიმურად გამოქვეყნება" : "Post Anonymously"}
                        </span>
                        <span className="block text-[10px] text-text-muted leading-tight mt-0.5">
                          Hide my user details and company name from public company review registers.
                        </span>
                      </div>
                    </label>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => router.back()}
                        className="bg-slate-950 hover:bg-slate-900 text-text-secondary border border-slate-900 px-4 py-2.5 rounded-xl transition text-xs font-bold"
                      >
                        {isKa ? "გაუქმება" : "Cancel"}
                      </button>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black px-6 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5"
                      >
                        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {existingReview
                          ? isKa
                            ? "რედაქტირება"
                            : "Update Review"
                          : isKa
                          ? "გამოქვეყნება"
                          : "Submit Review"}
                      </button>
                    </div>
                  </>
                )}

              </form>

            </div>

            {/* Guidance Column */}
            <div className="space-y-6">
              
              <div className="bg-slate-900/20 border border-slate-850 p-5 rounded-2xl shadow-md space-y-4 text-xs">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                  <HelpCircle className="h-4 w-4 text-cyan-400" />
                  <h4 className="font-extrabold text-text-primary uppercase tracking-wider text-[10px]">
                    Guidance & Policy
                  </h4>
                </div>

                <div className="space-y-3 text-text-secondary leading-relaxed">
                  <p>
                    <strong>Keep it constructive:</strong> Share honest assessments regarding communication, deliverables, and value.
                  </p>
                  <p>
                    <strong>Length requirement:</strong> Testimonials must be at least 100 characters to ensure depth and value to future buyers.
                  </p>
                  <p>
                    <strong>Verified status:</strong> Review submissions are bound directly to active contracts, making them certified credentials on KavShare.
                  </p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}

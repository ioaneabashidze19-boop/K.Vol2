import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    // 1. Auth Validation
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized: Clerk session token is missing" }, { status: 401 });
    }

    // Resolve database user
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized: Platform user profile not found" }, { status: 401 });
    }

    // Resolve seeker profile ID
    const { data: seeker } = await supabaseAdmin
      .from("seekers")
      .select("id")
      .eq("user_id", dbUser.id)
      .single();

    if (!seeker && dbUser.role !== "admin") {
      return NextResponse.json({ error: "Access Denied: Only seekers or admins can submit reviews" }, { status: 403 });
    }

    // 2. Request Parameters
    const body = await req.json();
    const { engagementId, rating, comment, isAnonymous = false } = body;

    // 3. Form Input Validation
    if (!engagementId) {
      return NextResponse.json({ error: "Missing engagementId parameter" }, { status: 400 });
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating. Must be an integer between 1 and 5" }, { status: 400 });
    }

    if (typeof comment !== "string" || comment.length < 100 || comment.length > 500) {
      return NextResponse.json({ error: "Comment testimonial must be between 100 and 500 characters long" }, { status: 400 });
    }

    // 4. Resolve and Validate Engagement
    const { data: engagement, error: engagementErr } = await supabaseAdmin
      .from("engagements")
      .select("id, seeker_id, company_id, status")
      .eq("id", engagementId)
      .single();

    if (engagementErr || !engagement) {
      return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
    }

    // Verify ownership (Must be user's seeker profile OR admin)
    if (dbUser.role !== "admin" && engagement.seeker_id !== seeker?.id) {
      return NextResponse.json({ error: "Unauthorized access: You do not own this engagement" }, { status: 403 });
    }

    // Verify status = 'completed' (or active for testing flexibility, but check for completed first)
    if (engagement.status !== "completed") {
      return NextResponse.json({ error: "Engagement is not completed. Gated reviews require completed engagement status" }, { status: 400 });
    }

    // 5. Prevent Duplicate Reviews
    const { data: existingReview } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("engagement_id", engagementId)
      .single();

    if (existingReview) {
      return NextResponse.json({ error: "Duplicate review. You have already posted a review for this engagement" }, { status: 409 });
    }

    // 6. Create Review Record
    const { data: newReview, error: reviewErr } = await supabaseAdmin
      .from("reviews")
      .insert({
        engagement_id: engagementId,
        reviewer_id: isAnonymous ? null : dbUser.id,
        rating,
        comment,
        anonymous: isAnonymous,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id")
      .single();

    if (reviewErr || !newReview) {
      console.error(`[${timestamp}] [Review Submission API] Error writing review:`, reviewErr);
      return NextResponse.json({ error: "Failed to record review testimonial" }, { status: 500 });
    }

    // 7. Recalculate company overall satisfaction score and rating
    // Get all reviews for engagements belonging to this company
    const { data: siblingEngagements } = await supabaseAdmin
      .from("engagements")
      .select("id")
      .eq("company_id", engagement.company_id);

    const engagementIds = (siblingEngagements || []).map((e) => e.id);

    let averageRating = rating; // default fallback

    if (engagementIds.length > 0) {
      const { data: companyReviews } = await supabaseAdmin
        .from("reviews")
        .select("rating")
        .in("engagement_id", engagementIds);

      if (companyReviews && companyReviews.length > 0) {
        const sum = companyReviews.reduce((acc, cur) => acc + cur.rating, 0);
        averageRating = Number((sum / companyReviews.length).toFixed(2));
      }
    }

    // Update company satisfaction score
    await supabaseAdmin
      .from("companies")
      .update({
        rating: averageRating,
        satisfaction_score: averageRating
      })
      .eq("id", engagement.company_id);

    // 8. Create Notification for the provider company
    const { data: companyProfile } = await supabaseAdmin
      .from("companies")
      .select("owner_id, name")
      .eq("id", engagement.company_id)
      .single();

    if (companyProfile && companyProfile.owner_id) {
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: companyProfile.owner_id,
          title: "New Verified Review",
          content: `Your company received a new verified rating of ${rating} stars on KavShare.`,
          is_read: false,
          link_url: "/provider/settings",
        });
    }

    // 9. Success Response
    return NextResponse.json({
      success: true,
      reviewId: newReview.id,
      message: "Your review has been posted"
    });

  } catch (err: any) {
    console.error(`[${timestamp}] [Review Submission API] Internal server error:`, err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

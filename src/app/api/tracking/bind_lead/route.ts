import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

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
    // 1. Read kav_session_id cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("kav_session_id")?.value;

    if (!sessionId) {
      return NextResponse.json({ message: "No active affiliate session token found in cookies." }, { status: 200 });
    }

    // 2. Fetch session attribution details
    const { data: attribution, error: attrErr } = await supabaseAdmin
      .from("session_attribution")
      .select("id, company_id, expires_at")
      .eq("token", sessionId)
      .single();

    if (attrErr || !attribution) {
      return NextResponse.json({ error: "Session attribution not found" }, { status: 404 });
    }

    // Check expiry
    if (new Date(attribution.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Affiliate session token has expired" }, { status: 400 });
    }

    // 3. Resolve seeker ID (either from current authenticated user, or passed in body)
    let seekerId: string | null = null;
    const body = await req.json().catch(() => ({}));
    
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) {
      // Find database seeker ID
      const { data: seeker } = await supabaseAdmin
        .from("seekers")
        .select("id")
        .eq("user_id", (
          await supabaseAdmin
            .from("users")
            .select("id")
            .eq("clerk_id", clerkUserId)
            .single()
        ).data?.id)
        .single();
      
      if (seeker) {
        seekerId = seeker.id;
      }
    }

    // Fallback to body param if clerk auth wasn't resolved
    if (!seekerId && body.seekerId) {
      seekerId = body.seekerId;
    }

    if (!seekerId) {
      return NextResponse.json({ error: "Could not resolve valid seeker profile identifier" }, { status: 400 });
    }

    // 4. Check if lead conversion already recorded to prevent duplication
    const { data: existingLead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("seeker_id", seekerId)
      .eq("company_id", attribution.company_id)
      .single();

    if (existingLead) {
      return NextResponse.json({ message: "Conversion already tracked and bound for this lead." }, { status: 200 });
    }

    // 5. Create leads record
    const { data: newLead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .insert({
        session_id: attribution.id,
        seeker_id: seekerId,
        company_id: attribution.company_id,
        status: "registered",
      })
      .select("id")
      .single();

    if (leadErr || !newLead) {
      console.error(`[${timestamp}] [Lead Attribution Binder] Failed to insert lead:`, leadErr);
      return NextResponse.json({ error: "Failed to record conversion lead record" }, { status: 500 });
    }

    // 6. Update session_attribution last_click timestamp
    await supabaseAdmin
      .from("session_attribution")
      .update({ last_click: new Date().toISOString() })
      .eq("id", attribution.id);

    // 7. Log conversion event to click_events
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabaseAdmin
      .from("click_events")
      .insert({
        session_id: attribution.id,
        click_type: "conversion",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    return NextResponse.json({
      success: true,
      message: "Lead conversion successfully bound to affiliate attribution session.",
      leadId: newLead.id,
      companyId: attribution.company_id,
    });

  } catch (err: any) {
    console.error(`[${timestamp}] [Lead Attribution Binder] Error binding lead:`, err);
    return NextResponse.json({ error: err.message || "Failed binding conversion tracking" }, { status: 500 });
  }
}

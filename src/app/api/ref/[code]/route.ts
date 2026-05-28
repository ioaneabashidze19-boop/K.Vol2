import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const uppercaseCode = code.toUpperCase();
  const timestamp = new Date().toISOString();

  try {
    // 1. Look up special_offer with matching code name
    const { data: offer, error: offerErr } = await supabaseAdmin
      .from("special_offers")
      .select("id, company_id, active")
      .eq("name", uppercaseCode)
      .single();

    if (offerErr || !offer || !offer.active) {
      console.warn(`[${timestamp}] [Affiliate Tracker] Invalid or inactive code: ${uppercaseCode}`);
      // Redirect to homepage if code is invalid
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 2. Generate cryptographic session token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    // 3. Create session_attribution record
    const { data: attribution, error: attrErr } = await supabaseAdmin
      .from("session_attribution")
      .insert({
        token,
        company_id: offer.company_id,
        code_used: uppercaseCode,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (attrErr || !attribution) {
      console.error(`[${timestamp}] [Affiliate Tracker] Failed to save session attribution:`, attrErr);
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 4. Log click event
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabaseAdmin
      .from("click_events")
      .insert({
        session_id: attribution.id,
        click_type: "initial",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    // 5. Set HTTP-Only Cookie with Secure settings
    const cookieStore = await cookies();
    cookieStore.set("kav_session_id", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: "/",
      sameSite: "lax",
    });

    // Redirect to registration/home page preserving referral code as query param
    return NextResponse.redirect(new URL(`/register?ref=${uppercaseCode}`, req.url));

  } catch (err) {
    console.error(`[${timestamp}] [Affiliate Tracker] Error processing referral redirect:`, err);
    return NextResponse.redirect(new URL("/", req.url));
  }
}

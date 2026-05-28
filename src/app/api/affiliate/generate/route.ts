import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { generatePromoCode } from "@/lib/affiliate/code-generator";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(req: Request) {
  try {
    // 1. Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized Clerk session" }, { status: 401 });
    }

    // Resolve database user and company
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("clerk_id", userId)
      .single();

    if (!dbUser || (dbUser.role !== "provider" && dbUser.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only providers and admins can generate promo codes" }, { status: 403 });
    }

    // Fetch provider company
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("owner_id", dbUser.id)
      .single();

    if (!company && dbUser.role !== "admin") {
      return NextResponse.json({ error: "Provider company profile not found" }, { status: 404 });
    }

    // Body parsing
    const body = await req.json();
    const {
      discountType = "percentage",
      discountValue,
      expiryDate,
      prefix = "KAVSH"
    } = body;

    // 2. Validations
    if (!discountValue || typeof discountValue !== "number" || discountValue <= 0) {
      return NextResponse.json({ error: "Discount value must be a positive number" }, { status: 400 });
    }

    if (discountType === "percentage" && discountValue > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100%" }, { status: 400 });
    }

    if (!["percentage", "fixed-amount", "free-trial"].includes(discountType)) {
      return NextResponse.json({ error: "Unsupported discount calculation mode" }, { status: 400 });
    }

    let parsedExpiry: Date | null = null;
    if (expiryDate) {
      parsedExpiry = new Date(expiryDate);
      if (isNaN(parsedExpiry.getTime())) {
        return NextResponse.json({ error: "Invalid expiry date format" }, { status: 400 });
      }
      if (parsedExpiry.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Expiry date must be in the future" }, { status: 400 });
      }
    }

    const companyId = company?.id || body.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Target company ID is required" }, { status: 400 });
    }

    // 3. Generate unique promo code
    const generatedCode = await generatePromoCode(
      companyId,
      prefix,
      discountType as any,
      discountValue
    );

    // 4. Update expiry date if provided
    if (parsedExpiry) {
      await supabaseAdmin
        .from("special_offers")
        .update({ expires_at: parsedExpiry.toISOString() })
        .eq("name", generatedCode);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kavshare.com";
    const referralLink = `${appUrl}/register?ref=${generatedCode}`;

    return NextResponse.json({
      success: true,
      code: generatedCode,
      discountType,
      discountValue,
      expiresAt: parsedExpiry ? parsedExpiry.toISOString() : null,
      referralLink
    });

  } catch (err: any) {
    console.error("Error creating custom affiliate code:", err);
    return NextResponse.json({ error: err.message || "Failed generating promo code" }, { status: 500 });
  }
}

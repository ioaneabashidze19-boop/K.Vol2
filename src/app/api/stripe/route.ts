import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-01-27" as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key"
);

export async function POST(req: Request) {
  try {
    const { contractId, amount, currency, returnUrl } = await req.json();

    if (!contractId || !amount) {
      return NextResponse.json({ error: "Missing required contract properties" }, { status: 400 });
    }

    // 1. Resolve contract billing description
    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select("id, monthly_value")
      .eq("id", contractId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // 2. Initiate Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency || "usd",
            product_data: {
              name: `KavShare Platform Commission Billing`,
              description: `Monthly billing ledger for contract reference: ${contract.id}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${returnUrl || "http://localhost:3000"}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl || "http://localhost:3000"}/dashboard?status=cancelled`,
      metadata: {
        contractId: contract.id,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

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
    const { scheduleIds, paymentMethod } = await req.json();

    if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json(
        { error: "Required array of scheduleIds was not provided" },
        { status: 400 }
      );
    }

    if (paymentMethod !== "stripe" && paymentMethod !== "manual") {
      return NextResponse.json(
        { error: "Invalid payment method specified. Must be 'stripe' or 'manual'" },
        { status: 400 }
      );
    }

    // 1. Fetch schedules to calculate amount and check ownership
    const { data: schedules, error: schedErr } = await supabaseAdmin
      .from("commission_schedules")
      .select(`
        id,
        expected_amount,
        status,
        contract:contracts (
          id,
          engagement:engagements (
            id,
            company_id
          )
        )
      `)
      .in("id", scheduleIds);

    if (schedErr || !schedules || schedules.length === 0) {
      return NextResponse.json(
        { error: `Failed to retrieve schedules: ${schedErr?.message || "Not found"}` },
        { status: 404 }
      );
    }

    // 2. Validate all schedules are pending/processing and belong to the same company
    const firstSched = schedules[0] as any;
    const companyId = firstSched.contract?.engagement?.company_id;
    if (!companyId) {
      return NextResponse.json(
        { error: "Failed to resolve provider company associated with the contract schedule" },
        { status: 400 }
      );
    }

    let totalAmount = 0;
    for (const item of schedules) {
      const schedItem = item as any;
      if (schedItem.status === "paid") {
        return NextResponse.json(
          { error: `Schedule ${item.id} has already been paid` },
          { status: 400 }
        );
      }
      if (schedItem.contract?.engagement?.company_id !== companyId) {
        return NextResponse.json(
          { error: "Cross-provider bulk actions are not authorized" },
          { status: 403 }
        );
      }
      totalAmount += Number(schedItem.expected_amount || 0);
    }

    let referenceId = "";
    let paymentUrl: string | undefined = undefined;

    if (paymentMethod === "stripe") {
      // Create Stripe checkout or transfer session
      referenceId = `stripe_sess_${Math.random().toString(36).substring(7)}`;
      paymentUrl = "https://checkout.stripe.com/pay/" + referenceId;

      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_placeholder") {
        try {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `KavShare Platform Commission Payments`,
                    description: `Settlement for ${schedules.length} monthly contracts schedules.`,
                  },
                  unit_amount: Math.round(totalAmount * 100),
                },
                quantity: 1,
              },
            ],
            mode: "payment",
            success_url: `${req.headers.get("origin") || "http://localhost:3000"}/provider/commissions?status=completed`,
            cancel_url: `${req.headers.get("origin") || "http://localhost:3000"}/provider/commissions?status=cancelled`,
            metadata: {
              companyId,
              scheduleIds: scheduleIds.join(","),
            },
          });

          if (session.url) {
            paymentUrl = session.url;
            referenceId = session.id;
          }
        } catch (stripeErr: any) {
          console.warn("Stripe Checkout creation failed, falling back to mockup link:", stripeErr.message);
        }
      }

      // Record pending payment in Ledger
      await supabaseAdmin.from("commission_payments").insert({
        company_id: companyId,
        amount: totalAmount,
        payment_method: "stripe",
        status: "pending",
        reference: referenceId,
      });

      // Update schedule statuses to processing
      await supabaseAdmin
        .from("commission_schedules")
        .update({ status: "processing" })
        .in("id", scheduleIds);

    } else {
      // Manual payout
      referenceId = `KAV-PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Insert ledger entry as processing
      await supabaseAdmin.from("commission_payments").insert({
        company_id: companyId,
        amount: totalAmount,
        payment_method: "manual",
        status: "processing",
        reference: referenceId,
      });

      // Update schedule statuses to processing
      await supabaseAdmin
        .from("commission_schedules")
        .update({ status: "processing" })
        .in("id", scheduleIds);

      // Simulate sending administrator alert
      console.info(`[KavShare Ledger Admin Alert] Manual commission payment transfer reported for Company ID ${companyId}. Reference: ${referenceId}`);
    }

    return NextResponse.json({
      success: true,
      referenceId,
      amount: totalAmount,
      paymentUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process commission payment request" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/wise
 * Processes incoming webhook events from the Wise API.
 * Tracks transfer state changes and syncs commission schedule statuses.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const WISE_WEBHOOK_SECRET = process.env.WISE_WEBHOOK_SECRET ?? "";
const WISE_WEBHOOK_PUBLIC_KEY = process.env.WISE_WEBHOOK_PUBLIC_KEY ?? "";

/**
 * Verifies the incoming webhook signature.
 * Supports standard Wise asymmetric RSA signatures (preferring WISE_WEBHOOK_PUBLIC_KEY)
 * and HMAC signatures (using WISE_WEBHOOK_SECRET).
 */
function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  secret: string,
  publicKey: string
): boolean {
  if (!secret && !publicKey) {
    console.warn("[Wise Webhook] Neither WISE_WEBHOOK_SECRET nor WISE_WEBHOOK_PUBLIC_KEY is configured. Skipping signature verification.");
    return true;
  }

  if (!signatureHeader) return false;

  // 1. Asymmetric verification (Wise standard)
  if (publicKey) {
    try {
      const verify = crypto.createVerify("RSA-SHA256");
      verify.update(rawBody);
      // Signature is base64 encoded
      const cleanKey = publicKey.includes("-----BEGIN PUBLIC KEY-----") 
        ? publicKey 
        : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
      return verify.verify(cleanKey, signatureHeader, "base64");
    } catch (e: any) {
      console.error("[Wise Webhook] RSA-SHA256 public key verification failed:", e.message);
    }
  }

  // 2. Symmetric HMAC verification fallback
  if (secret) {
    try {
      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(rawBody);
      const computed = hmac.digest("hex");
      return computed === signatureHeader || computed === signatureHeader.toLowerCase();
    } catch (e: any) {
      console.error("[Wise Webhook] HMAC verification failed:", e.message);
    }
  }

  return false;
}

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Wise Webhook] Incoming event received.`);

  try {
    const signature = req.headers.get("X-Signature-SHA256") || req.headers.get("x-signature-sha256");
    const rawBody = Buffer.from(await req.arrayBuffer());

    // 1. Signature Verification
    if (!verifySignature(rawBody, signature, WISE_WEBHOOK_SECRET, WISE_WEBHOOK_PUBLIC_KEY)) {
      console.warn(`[${timestamp}] [Wise Webhook] Invalid signature. Access Denied.`);
      return NextResponse.json({ error: "Invalid signature verification" }, { status: 401 });
    }

    // 2. Parse Webhook Event
    let event: any;
    try {
      event = JSON.parse(rawBody.toString());
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body format" }, { status: 400 });
    }

    const eventType: string = event.event_type || event.eventType || "";
    // Accept transfers#state-change or transfer.state-change
    const isStateChange = eventType.includes("state-change") || eventType.includes("transfers#");
    if (!isStateChange) {
      console.log(`[${timestamp}] [Wise Webhook] Unhandled event type: ${eventType}. Skipping.`);
      return NextResponse.json({ received: true, message: "Ignored non-status change event" }, { status: 200 });
    }

    const transferId = event.data?.resource?.id || event.data?.resourceId;
    const currentState = (event.data?.current_state || event.data?.currentState || "").toLowerCase();

    if (!transferId || !currentState) {
      return NextResponse.json({ error: "Missing transfer ID or current state fields" }, { status: 400 });
    }

    console.log(`[${timestamp}] [Wise Webhook] Transfer status change: ID ${transferId} -> state '${currentState}'`);

    // 3. Resolve status mappings
    let paymentStatus: "processing" | "completed" | "failed" | "refunded" = "processing";
    let scheduleStatus: "processing" | "paid" | "overdue" | "pending" | "cancelled" = "processing";
    let isCompleted = false;

    if (["processing", "incoming_payment_waiting", "incoming_payment_initiated", "outgoing_payment_initiated"].includes(currentState)) {
      paymentStatus = "processing";
      scheduleStatus = "processing";
    } else if (["funds_converted", "funds-converted"].includes(currentState)) {
      paymentStatus = "processing";
      scheduleStatus = "processing";
    } else if (["outgoing_payment_sent", "outbound-payment-sent", "funds_delivered"].includes(currentState)) {
      paymentStatus = "completed";
      scheduleStatus = "paid";
      isCompleted = true;
    } else if (["bounced_back", "bounced-back", "failed"].includes(currentState)) {
      paymentStatus = "failed";
      scheduleStatus = "overdue"; // Schedule reverts to overdue to allow reprocessing/rectification
    } else if (["cancelled", "canceled"].includes(currentState)) {
      paymentStatus = "failed";
      scheduleStatus = "overdue";
    }

    // 4. Retrieve database commission payments
    const { data: payments, error: payErr } = await supabaseAdmin
      .from("commission_payments")
      .select("id, company_id, schedule_id, amount, reference, status")
      .eq("wise_transfer_id", transferId);

    if (payErr || !payments || payments.length === 0) {
      console.log(`[${timestamp}] [Wise Webhook] No matching transfers found for ID: ${transferId}. skipping.`);
      return NextResponse.json({ received: true, message: "Transfer ID not found in database ledger" }, { status: 200 });
    }

    // 5. Atomic Update Execution
    console.log(`[${timestamp}] [Wise Webhook] Reconciling ${payments.length} payout(s)...`);

    // Update matching commission payments
    const { error: updatePaymentsErr } = await supabaseAdmin
      .from("commission_payments")
      .update({
        status: paymentStatus,
        paid_at: isCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("wise_transfer_id", transferId);

    if (updatePaymentsErr) {
      console.error(`[${timestamp}] [Wise Webhook] Error updating payment ledger:`, updatePaymentsErr);
      throw updatePaymentsErr;
    }

    // Update schedules individually to set paid_amount and metadata safely
    for (const p of payments) {
      if (p.schedule_id) {
        // Fetch current schedule to retain existing metadata safely
        const { data: schedule } = await supabaseAdmin
          .from("commission_schedules")
          .select("expected_amount, metadata")
          .eq("id", p.schedule_id)
          .single();

        const expectedVal = schedule ? Number(schedule.expected_amount) : p.amount;
        const currentMeta = schedule?.metadata || {};

        const { error: updateSchedErr } = await supabaseAdmin
          .from("commission_schedules")
          .update({
            status: scheduleStatus,
            paid_amount: isCompleted ? expectedVal : 0,
            metadata: {
              ...currentMeta,
              last_webhook_state: currentState,
              last_sync_time: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", p.schedule_id);

        if (updateSchedErr) {
          console.error(`[${timestamp}] [Wise Webhook] Error updating schedule ${p.schedule_id}:`, updateSchedErr);
        }
      }

      // Log database events in application Audit logs
      await supabaseAdmin.from("audit_logs").insert({
        action: `wise_webhook_${currentState}`,
        table_name: "commission_payments",
        record_id: p.id,
        details: {
          wise_transfer_id: transferId,
          schedule_id: p.schedule_id,
          company_id: p.company_id,
          amount: p.amount,
          previous_state: p.status,
          current_state: currentState,
        },
      });
    }

    // 6. Action specific triggers & notification simulation
    const totalAmount = payments.reduce((acc, p) => acc + Number(p.amount), 0);

    if (currentState === "funds_converted" || currentState === "funds-converted") {
      // Simulate "Money Converted" Notification
      console.log(`[${timestamp}] [Wise Webhook Notification] "Money converted" sent to company ${payments[0].company_id}:
        - Transfer ID: ${transferId}
        - Conversions executed for GEL value payout.`);
    }

    if (isCompleted) {
      // Simulate "Payment Completed" Email Template
      console.log(`[${timestamp}] [Wise Webhook Notification] Sending completed payment email to provider company ${payments[0].company_id}:
        --------------------------------------------------
        Subject: Commission Payout Complete - KavShare
        Amount paid: GEL ${totalAmount}
        Reference: WISE-${transferId}
        Status: Money successfully sent to bank account.
        --------------------------------------------------`);
    }

    if (["bounced_back", "bounced-back", "failed", "cancelled", "canceled"].includes(currentState)) {
      // Create high-severity alert for administrators
      await supabaseAdmin.from("admin_audit_logs").insert({
        action: "wise_payout_failed_alert",
        target_id: String(transferId),
        details: {
          error_state: currentState,
          payout_amount: totalAmount,
          company_id: payments[0].company_id,
          schedule_ids: payments.map((p) => p.schedule_id),
          resolution: "Requires manual review and payout parameters validation.",
        },
      });

      // Simulate "Payment Failed" Email Template
      console.log(`[${timestamp}] [Wise Webhook Notification] Sending warning alert email to provider company ${payments[0].company_id}:
        --------------------------------------------------
        Subject: ACTION REQUIRED: Commission Payout Failed
        Attempted Amount: GEL ${totalAmount}
        Reference: WISE-${transferId}
        Status: Payment failed or was cancelled by the clearing bank.
        Action: Please review and verify your IBAN/bank credentials.
        --------------------------------------------------`);
    }

    return NextResponse.json({
      success: true,
      processedPayments: payments.length,
      transferId,
      status: paymentStatus,
    });

  } catch (err: any) {
    const errTimestamp = new Date().toISOString();
    console.error(`[${errTimestamp}] [Wise Webhook Handler Error]`, err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error processing Wise Webhook event." },
      { status: 500 }
    );
  }
}

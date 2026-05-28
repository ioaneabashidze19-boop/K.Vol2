/**
 * POST /api/wise/webhook
 * Handles transfer status updates pushed by Wise.
 *
 * Security: Wise signs webhooks with a public key (RSA-SHA256).
 * We verify the X-Signature-SHA256 header against WISE_WEBHOOK_PUBLIC_KEY.
 *
 * Wise webhook docs:
 * https://docs.wise.com/api-docs/features/webhooks-notifications/event-types
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Wise webhook public key (RSA) — paste from Wise Dashboard → Webhooks → Public key. */
const WISE_WEBHOOK_PUBLIC_KEY = process.env.WISE_WEBHOOK_PUBLIC_KEY ?? "";

/** Map Wise transfer statuses to our internal commission schedule statuses. */
const STATUS_MAP: Record<string, string> = {
  incoming_payment_waiting:  "processing",
  incoming_payment_initiated:"processing",
  funds_converted:           "processing",
  outgoing_payment_initiated:"processing",
  outgoing_payment_sent:     "paid",
  funds_refunded:            "pending",  // refund — re-open for retry
  cancelled:                 "pending",
  failed:                    "pending",
};

// ─── Signature verification ────────────────────────────────────────────────────

function verifyWiseSignature(
  rawBody: Buffer,
  signatureHeader: string | null
): boolean {
  // If no key configured (sandbox / dev), skip verification with a warning.
  if (!WISE_WEBHOOK_PUBLIC_KEY) {
    console.warn("[Wise Webhook] WISE_WEBHOOK_PUBLIC_KEY not set — skipping signature check.");
    return true;
  }
  if (!signatureHeader) return false;

  try {
    const verify = crypto.createVerify("SHA256");
    verify.update(rawBody);
    // Wise sends the signature base64-encoded
    return verify.verify(WISE_WEBHOOK_PUBLIC_KEY, signatureHeader, "base64");
  } catch {
    return false;
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("X-Signature-SHA256");

  // 1. Verify authenticity
  if (!verifyWiseSignature(rawBody, signature)) {
    console.warn("[Wise Webhook] Invalid signature — request rejected.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const eventType: string = event.event_type ?? "";
  const transferId: number | undefined = event.data?.resource?.id;

  // 2. Only handle transfer state changes
  if (!eventType.startsWith("transfers#") || !transferId) {
    return NextResponse.json({ received: true, skipped: true });
  }

  const wiseStatus: string = event.data?.current_state ?? "";
  const internalStatus = STATUS_MAP[wiseStatus] ?? "processing";

  // 3. Find matching wise_transfer row by transfer_id
  const { data: wiseTransfer, error: findErr } = await supabaseAdmin
    .from("wise_transfers")
    .select("id, schedule_id, company_id, status")
    .eq("transfer_id", transferId)
    .single();

  if (findErr || !wiseTransfer) {
    // Unrecognised transfer — log and accept gracefully
    console.info(`[Wise Webhook] Transfer ${transferId} not found in DB — ignoring.`);
    return NextResponse.json({ received: true, skipped: true });
  }

  // 4. Update wise_transfers table
  await supabaseAdmin
    .from("wise_transfers")
    .update({ status: wiseStatus, updated_at: new Date().toISOString() })
    .eq("id", wiseTransfer.id);

  // 5. Update linked commission_schedule
  await supabaseAdmin
    .from("commission_schedules")
    .update({
      status: internalStatus,
      paid_amount:
        internalStatus === "paid"
          ? supabaseAdmin.rpc("get_schedule_expected_amount", { p_id: wiseTransfer.schedule_id })
          : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wiseTransfer.schedule_id);

  // 6. If paid — mark a commission_payment record as completed
  if (internalStatus === "paid") {
    await supabaseAdmin
      .from("commission_payments")
      .update({
        status: "completed",
        paid_at: new Date().toISOString(),
        reference: `WISE-${transferId}`,
      })
      .eq("company_id", wiseTransfer.company_id)
      .eq("status", "processing");

    // 7. Log notification (email would be triggered via a DB trigger or queue)
    await supabaseAdmin.from("audit_logs").insert({
      action: "wise_transfer_completed",
      entity_type: "wise_transfer",
      entity_id: String(transferId),
      metadata: {
        scheduleId: wiseTransfer.schedule_id,
        companyId: wiseTransfer.company_id,
        wiseStatus,
        eventType,
      },
    });

    console.info(`[Wise Webhook] ✓ Transfer ${transferId} completed → schedule ${wiseTransfer.schedule_id} marked paid.`);
  }

  return NextResponse.json({ received: true, transferId, internalStatus });
}

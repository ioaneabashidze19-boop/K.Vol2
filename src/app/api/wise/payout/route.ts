/**
 * POST /api/wise/payout
 * Initiates a Wise transfer from the platform balance to a provider's Georgian bank account.
 *
 * Request body:
 *   scheduleId  — commission_schedule UUID (used as idempotency key)
 *   companyId   — provider company UUID
 *   amountGEL   — amount to transfer in GEL (or sourceCurrency)
 *   sourceCurrency — defaults to "USD"
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createQuote,
  createGeorgianRecipient,
  createTransfer,
  fundTransfer,
} from "@/lib/wise/config";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { scheduleId, companyId, amountGEL, sourceCurrency = "USD" } =
      await req.json();

    // ── 1. Input validation ──────────────────────────────────────────────────
    if (!scheduleId || !companyId || !amountGEL) {
      return NextResponse.json(
        { error: "Missing required fields: scheduleId, companyId, amountGEL" },
        { status: 400 }
      );
    }

    if (typeof amountGEL !== "number" || amountGEL <= 0) {
      return NextResponse.json(
        { error: "amountGEL must be a positive number" },
        { status: 400 }
      );
    }

    // ── 2. Guard duplicate (idempotency) ─────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from("wise_transfers")
      .select("id, transfer_id, status")
      .eq("schedule_id", scheduleId)
      .single();

    if (existing?.status === "outgoing_payment_sent" || existing?.status === "funds_converted") {
      return NextResponse.json(
        { success: true, transferId: existing.transfer_id, duplicate: true },
        { status: 200 }
      );
    }

    // ── 3. Fetch provider's bank account ─────────────────────────────────────
    const { data: bankAccount, error: bankErr } = await supabaseAdmin
      .from("company_bank_accounts")
      .select("iban, account_holder_name, wise_recipient_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .single();

    if (bankErr || !bankAccount) {
      return NextResponse.json(
        { error: "No active payout account found for this provider. Please add a Georgian IBAN first." },
        { status: 404 }
      );
    }

    // ── 4. Ensure Wise recipient exists (create once, cache ID) ──────────────
    let wiseRecipientId: number = bankAccount.wise_recipient_id;

    if (!wiseRecipientId) {
      const recipient = await createGeorgianRecipient({
        accountHolderName: bankAccount.account_holder_name,
        iban: bankAccount.iban,
        currency: "GEL",
      });
      wiseRecipientId = recipient.id;

      // Cache recipient ID so we don't recreate on every payout
      await supabaseAdmin
        .from("company_bank_accounts")
        .update({ wise_recipient_id: wiseRecipientId })
        .eq("company_id", companyId);
    }

    // ── 5. Create a quote ────────────────────────────────────────────────────
    const quote = await createQuote(sourceCurrency, "GEL", amountGEL);

    // ── 6. Create the transfer ───────────────────────────────────────────────
    const transfer = await createTransfer(
      quote.id,
      wiseRecipientId,
      scheduleId,
      `KavShare commission — schedule ${scheduleId.substring(0, 8)}`
    );

    // ── 7. Fund (execute) the transfer ───────────────────────────────────────
    const fundResult = await fundTransfer(transfer.id);

    if (fundResult.errorCode) {
      throw new Error(`Wise funding failed: ${fundResult.errorCode}`);
    }

    // ── 8. Persist transfer record ───────────────────────────────────────────
    await supabaseAdmin.from("wise_transfers").upsert({
      schedule_id: scheduleId,
      company_id: companyId,
      transfer_id: transfer.id,
      quote_id: quote.id,
      source_currency: sourceCurrency,
      target_currency: "GEL",
      source_amount: quote.sourceAmount,
      target_amount: quote.targetAmount,
      rate: quote.rate,
      status: transfer.status,
      reference: `KavShare-${scheduleId.substring(0, 8)}`,
    }, { onConflict: "schedule_id" });

    // ── 9. Update commission schedule to processing ──────────────────────────
    await supabaseAdmin
      .from("commission_schedules")
      .update({ status: "processing" })
      .eq("id", scheduleId);

    return NextResponse.json({
      success: true,
      transferId: transfer.id,
      status: transfer.status,
      sourceAmount: quote.sourceAmount,
      targetAmount: quote.targetAmount,
      rate: quote.rate,
    });
  } catch (err: any) {
    console.error("[Wise Payout Error]", err.message);
    return NextResponse.json(
      { error: err.message ?? "Wise payout failed unexpectedly" },
      { status: 500 }
    );
  }
}

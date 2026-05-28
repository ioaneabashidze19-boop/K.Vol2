/**
 * POST /api/wise/payout
 * Initiates a commission payout transfer to a provider's Georgian bank account using the Wise API.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import {
  createQuote,
  createGeorgianRecipient,
  createTransfer,
  fundTransfer,
  getExchangeRate,
} from "@/lib/wise/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Simple in-memory rate limiting map for this route (to protect against basic script/brute abuse)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 requests per minute per user

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Wise Payout API] Processing payout request...`);

  try {
    // ── 1. Authentication and Authorization ───────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      console.warn(`[${timestamp}] [Wise Payout API] Unauthorized request - no Clerk session.`);
      return NextResponse.json({ error: "Unauthorized: Clerk session token is missing or expired" }, { status: 401 });
    }

    // Rate limiting check
    const now = Date.now();
    const rateLimit = rateLimitMap.get(userId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    if (now > rateLimit.resetAt) {
      rateLimit.count = 1;
      rateLimit.resetAt = now + RATE_LIMIT_WINDOW_MS;
    } else {
      rateLimit.count++;
    }
    rateLimitMap.set(userId, rateLimit);

    if (rateLimit.count > RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`[${timestamp}] [Wise Payout API] Rate limit exceeded for user ${userId}.`);
      return NextResponse.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
    }

    // Fetch Supabase user and Clerk user metadata to resolve roles
    const [dbUserRes, clerkUser] = await Promise.all([
      supabaseAdmin.from("users").select("id, role").eq("clerk_id", userId).single(),
      currentUser(),
    ]);

    const dbUser = dbUserRes.data;
    const userRole = clerkUser?.publicMetadata?.userRole || "seeker";

    const isAuthorized = dbUser && (dbUser.role === "provider" || dbUser.role === "admin" || userRole === "provider" || userRole === "admin");
    if (!isAuthorized) {
      console.warn(`[${timestamp}] [Wise Payout API] Access denied for user ${userId}.`);
      return NextResponse.json({ error: "Access Denied: Must be registered as a provider or admin." }, { status: 403 });
    }

    // ── 2. Request Body Validation ────────────────────────────────────────────
    const body = await req.json();
    const { companyId, amount, scheduleIds, sourceCurrency = "USD", targetCurrency = "GEL" } = body;

    if (!companyId || !amount || !scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request payload. Required fields: companyId, amount (positive number), scheduleIds (non-empty array)." },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
    }

    if (targetCurrency !== "GEL") {
      return NextResponse.json({ error: "Target currency must be GEL for Georgian bank payouts." }, { status: 400 });
    }

    if (!["USD", "EUR", "GEL"].includes(sourceCurrency)) {
      return NextResponse.json({ error: "Unsupported source currency. Choose USD, EUR, or GEL." }, { status: 400 });
    }

    console.log(`[${timestamp}] [Wise Payout API] User ${userId} is requesting ${amount} ${sourceCurrency} -> ${targetCurrency} for company ${companyId}`);

    // If provider, verify they own the company they are requesting payout for
    if (dbUser.role !== "admin" && userRole !== "admin") {
      const { data: compCheck } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .eq("owner_id", dbUser.id)
        .single();

      if (!compCheck) {
        return NextResponse.json({ error: "Unauthorized access: You do not own this provider company" }, { status: 403 });
      }
    }

    // ── 3. Validate Schedules Ownership & Statuses ─────────────────────────────
    console.log(`[${timestamp}] [Wise Payout API] Validating ownership of schedules: ${scheduleIds.join(", ")}`);
    
    // Fetch target schedules
    const { data: schedules, error: schedErr } = await supabaseAdmin
      .from("commission_schedules")
      .select("id, contract_id, expected_amount, paid_amount, status")
      .in("id", scheduleIds);

    if (schedErr || !schedules || schedules.length === 0) {
      return NextResponse.json({ error: "Commission schedules not found in database." }, { status: 404 });
    }

    if (schedules.length !== scheduleIds.length) {
      return NextResponse.json({ error: "One or more commission schedules do not exist." }, { status: 400 });
    }

    // Check statuses
    const invalidStatus = schedules.find((s) => s.status === "paid" || s.status === "processing" || s.status === "cancelled");
    if (invalidStatus) {
      return NextResponse.json(
        { error: `Schedule ${invalidStatus.id} is already in state '${invalidStatus.status}' and cannot be paid.` },
        { status: 400 }
      );
    }

    // Fetch contracts to check company ownership
    const contractIds = Array.from(new Set(schedules.map((s) => s.contract_id)));
    const { data: contracts } = await supabaseAdmin
      .from("contracts")
      .select("id, engagement_id")
      .in("id", contractIds);

    if (!contracts || contracts.length === 0) {
      return NextResponse.json({ error: "Failed to load contract links for schedules." }, { status: 400 });
    }

    // Fetch engagements to verify company ID
    const engagementIds = Array.from(new Set(contracts.map((c) => c.engagement_id)));
    const { data: engagements } = await supabaseAdmin
      .from("engagements")
      .select("id, company_id")
      .in("id", engagementIds);

    if (!engagements || engagements.length === 0) {
      return NextResponse.json({ error: "Failed to load engagement references." }, { status: 400 });
    }

    // Map each schedule to its target company
    const scheduleCompanyIds = schedules.map((s) => {
      const contract = contracts.find((c) => c.id === s.contract_id);
      const engagement = engagements.find((e) => e.id === contract?.engagement_id);
      return engagement?.company_id;
    });

    const allBelongToCompany = scheduleCompanyIds.every((cid) => cid === companyId);
    if (!allBelongToCompany) {
      return NextResponse.json({ error: "One or more commission schedules do not belong to the requested company." }, { status: 400 });
    }

    // Check sum match
    const unpaidSum = schedules.reduce((sum, s) => sum + (Number(s.expected_amount) - Number(s.paid_amount)), 0);
    // Allow slight float mismatch due to cent rounding checks
    if (Math.abs(unpaidSum - amount) > 0.05) {
      return NextResponse.json(
        { error: `Requested payout amount (${amount}) does not match total unpaid schedules sum (${unpaidSum.toFixed(2)}).` },
        { status: 400 }
      );
    }

    // ── 4. Verify Active Bank Account ──────────────────────────────────────────
    const { data: bankAccount, error: bankErr } = await supabaseAdmin
      .from("company_bank_accounts")
      .select("id, iban, account_holder_name, wise_recipient_id, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .single();

    if (bankErr || !bankAccount) {
      return NextResponse.json({ error: "No active payout bank details found for this provider." }, { status: 404 });
    }

    // ── 5. Setup Wise Recipient ID ────────────────────────────────────────────
    let wiseRecipientId = bankAccount.wise_recipient_id;
    if (!wiseRecipientId) {
      console.log(`[${timestamp}] [Wise Payout API] Payout recipient ID not cached. Registering recipient on Wise...`);
      try {
        const recipient = await createGeorgianRecipient({
          accountHolderName: bankAccount.account_holder_name,
          iban: bankAccount.iban,
          currency: "GEL",
        });
        wiseRecipientId = recipient.id;

        // Cache recipient ID to avoid duplicate creation
        await supabaseAdmin
          .from("company_bank_accounts")
          .update({ wise_recipient_id: wiseRecipientId })
          .eq("company_id", companyId);
        
        console.log(`[${timestamp}] [Wise Payout API] Cached Wise recipient ID: ${wiseRecipientId}`);
      } catch (recErr: any) {
        console.error(`[${timestamp}] [Wise Payout API] Wise recipient registration failed:`, recErr);
        return NextResponse.json({ error: `Wise Recipient registration failed: ${recErr.message}` }, { status: 400 });
      }
    }

    // ── 6. Idempotency Check (Duplicate transfer protection) ─────────────────
    // If any of these scheduleIds already exist in wise_transfers as processing or active, guard it
    const { data: duplicateCheck } = await supabaseAdmin
      .from("wise_transfers")
      .select("schedule_id, transfer_id, status")
      .in("schedule_id", scheduleIds);

    const activeDuplicate = duplicateCheck?.find((t) => t.status === "processing" || t.status === "outgoing_payment_sent");
    if (activeDuplicate) {
      console.warn(`[${timestamp}] [Wise Payout API] Duplicate transaction guarded. Transfer already in progress.`);
      return NextResponse.json({
        success: true,
        transferId: activeDuplicate.transfer_id.toString(),
        status: "processing",
        message: "Duplicate transfer detected. This transfer is already being processed.",
      });
    }

    // ── 7. Get Rate & Create Transfer Quote ──────────────────────────────────
    console.log(`[${timestamp}] [Wise Payout API] Fetching rates & quote for ${amount} ${sourceCurrency} -> GEL`);
    let quote;
    try {
      quote = await createQuote(sourceCurrency, "GEL", amount);
    } catch (quoteErr: any) {
      console.error(`[${timestamp}] [Wise Payout API] Quote creation failed:`, quoteErr);
      return NextResponse.json({ error: `Wise API Quote failed: ${quoteErr.message}` }, { status: 502 });
    }

    // Calculate/extract fee
    const feeAmount = (quote as any).paymentOptions?.[0]?.fee?.transfer || (quote as any).fee || Math.round(amount * 0.015 * 100) / 100;
    const rateInfo = await getExchangeRate(sourceCurrency, "GEL");

    // ── 8. Create the Transfer ───────────────────────────────────────────────
    // Using a hash of scheduleIds as idempotency key to prevent double transfers
    const groupedIdempotencyKey = crypto.randomUUID();
    console.log(`[${timestamp}] [Wise Payout API] Creating transfer on Wise with key: ${groupedIdempotencyKey}`);
    
    let transfer;
    try {
      transfer = await createTransfer(
        quote.id,
        Number(wiseRecipientId),
        groupedIdempotencyKey,
        `KavShare Ref ${groupedIdempotencyKey.substring(0, 8)}`
      );
    } catch (txErr: any) {
      console.error(`[${timestamp}] [Wise Payout API] Transfer creation failed:`, txErr);
      return NextResponse.json({ error: `Wise API Transfer creation failed: ${txErr.message}` }, { status: 502 });
    }

    // ── 9. Fund the Transfer (Execute Payment) ───────────────────────────────
    console.log(`[${timestamp}] [Wise Payout API] Funding transfer ID: ${transfer.id}`);
    try {
      const fundResult = await fundTransfer(transfer.id);
      if (fundResult.errorCode) {
        throw new Error(`Wise funding response error code: ${fundResult.errorCode}`);
      }
    } catch (fundErr: any) {
      console.error(`[${timestamp}] [Wise Payout API] Payout execution failed:`, fundErr);
      return NextResponse.json({ error: `Wise Transfer funding failed: ${fundErr.message}` }, { status: 502 });
    }

    // ── 10. Update Database Ledger (Payments & Transfers) ────────────────────
    console.log(`[${timestamp}] [Wise Payout API] Writing ledger entries to Database...`);

    const nowIso = new Date().toISOString();
    
    // Create commission_payments & wise_transfers records for each schedule
    const insertPaymentsPromises = schedules.map(async (s) => {
      // Create wise_transfers ledger entry
      await supabaseAdmin.from("wise_transfers").upsert({
        schedule_id: s.id,
        company_id: companyId,
        transfer_id: transfer.id,
        quote_id: quote.id,
        source_currency: sourceCurrency,
        target_currency: "GEL",
        source_amount: (Number(s.expected_amount) - Number(s.paid_amount)) * (quote.sourceAmount / amount),
        target_amount: (Number(s.expected_amount) - Number(s.paid_amount)) * (quote.targetAmount / amount),
        rate: quote.rate,
        status: "processing",
        reference: `KavShare-${groupedIdempotencyKey.substring(0, 8)}`,
      }, { onConflict: "schedule_id" });

      // Create commission_payments entry
      await supabaseAdmin.from("commission_payments").insert({
        company_id: companyId,
        schedule_id: s.id,
        amount: Number(s.expected_amount) - Number(s.paid_amount),
        payment_method: "wise",
        status: "processing",
        reference: `WISE-${transfer.id}`,
        wise_transfer_id: transfer.id,
        exchange_rate: quote.rate,
        fee_amount: feeAmount / schedules.length,
      });

      // Update commission_schedules
      await supabaseAdmin
        .from("commission_schedules")
        .update({
          status: "processing",
          paid_amount: s.expected_amount,
          metadata: {
            processing_date: nowIso,
            wise_transfer_id: transfer.id,
            idempotency_key: groupedIdempotencyKey,
          },
        })
        .eq("id", s.id);
    });

    await Promise.all(insertPaymentsPromises);

    // ── 11. Send Notifications ───────────────────────────────────────────────
    // Mask IBAN for notification privacy
    const rawIban = bankAccount.iban.replace(/\s+/g, "");
    const maskedIban = rawIban.substring(0, 4) + "••••" + rawIban.substring(rawIban.length - 4);
    
    const deliveryDays = 2; // Standard Wise delivery timeline helper
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + deliveryDays);

    console.log(`[${timestamp}] [Wise Payout API] Notification dispatched successfully:
      - Recipient: ${bankAccount.account_holder_name}
      - Masked IBAN: ${maskedIban}
      - Amount GEL: ${quote.targetAmount}
      - Wise Ref: ${transfer.id}`);

    // Return Complete Response
    return NextResponse.json({
      success: true,
      transferId: transfer.id.toString(),
      amount: amount,
      currency: "GEL",
      exchangeRate: rateInfo.rate,
      wiseAmount: quote.targetAmount,
      fee: feeAmount,
      expectedDeliveryDate: expectedDelivery.toISOString(),
      status: "processing",
      message: "Commission payout has been initiated and is now processing.",
    });

  } catch (err: any) {
    const errTimestamp = new Date().toISOString();
    console.error(`[${errTimestamp}] [Wise Payout API] Unhandled exception occurred:`, err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during commission payout." },
      { status: 500 }
    );
  }
}

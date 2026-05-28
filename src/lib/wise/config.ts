/**
 * src/lib/wise/config.ts
 * Wise API client, exchange-rate helpers, and transfer utilities.
 * Uses Wise's REST API v3 directly (no third-party SDK required).
 *
 * Docs: https://docs.wise.com/api-docs/guides/get-started
 */

import { z } from "zod";

// ─── Environment ───────────────────────────────────────────────────────────────

const WISE_API_TOKEN = process.env.WISE_API_TOKEN ?? "";
const WISE_ENV = (process.env.WISE_ENV ?? "sandbox") as "sandbox" | "live";
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID ?? ""; // Business profile numeric ID

/** Base URL differs between sandbox and production. */
export const WISE_BASE_URL =
  WISE_ENV === "live"
    ? "https://api.wise.com"
    : "https://api.sandbox.transferwise.tech";

if (!WISE_API_TOKEN && typeof window === "undefined") {
  console.warn("[Wise] WISE_API_TOKEN is not set. Requests will fail.");
}

// ─── Core HTTP helper ──────────────────────────────────────────────────────────

export interface WiseRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Extra headers (e.g. idempotency key). */
  headers?: Record<string, string>;
}

export async function wiseRequest<T = unknown>(
  path: string,
  options: WiseRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers: extraHeaders = {} } = options;

  const res = await fetch(`${WISE_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${WISE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.errors?.[0]?.message ?? JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    throw new Error(`Wise API ${method} ${path} → ${res.status}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

// ─── Profile ───────────────────────────────────────────────────────────────────

/** Returns the numeric profile ID to use for transfers. Prefers env var, then fetches. */
export async function getWiseProfileId(): Promise<number> {
  if (WISE_PROFILE_ID) return Number(WISE_PROFILE_ID);

  const profiles = await wiseRequest<{ id: number; type: string }[]>("/v2/profiles");
  const business = profiles.find((p) => p.type === "BUSINESS");
  if (!business) throw new Error("No Wise BUSINESS profile found for this API token.");
  return business.id;
}

// ─── Exchange rates ────────────────────────────────────────────────────────────

export interface ExchangeRate {
  rate: number;
  source: string;
  target: string;
  time: string;
}

/**
 * Fetches the current mid-market exchange rate between two currencies.
 * Commonly used: USD → GEL, EUR → GEL.
 */
export async function getExchangeRate(
  sourceCurrency: string,
  targetCurrency: string
): Promise<ExchangeRate> {
  const rates = await wiseRequest<ExchangeRate[]>(
    `/v1/rates?source=${sourceCurrency}&target=${targetCurrency}`
  );
  if (!rates.length) {
    throw new Error(`No exchange rate found for ${sourceCurrency} → ${targetCurrency}`);
  }
  return rates[0];
}

// ─── Quote ─────────────────────────────────────────────────────────────────────

export interface WiseQuote {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  expirationTime: string;
}

/**
 * Creates a fixed-source-amount quote.
 * Required before creating a transfer.
 */
export async function createQuote(
  sourceCurrency: string,
  targetCurrency: string,
  sourceAmount: number
): Promise<WiseQuote> {
  const profileId = await getWiseProfileId();
  return wiseRequest<WiseQuote>(`/v3/profiles/${profileId}/quotes`, {
    method: "POST",
    body: {
      sourceCurrency,
      targetCurrency,
      sourceAmount,
      targetAmountProvidedAtQuoteTime: false,
    },
  });
}

// ─── Recipient account ─────────────────────────────────────────────────────────

export interface WiseRecipient {
  id: number;
  accountHolderName: string;
  currency: string;
  country: string;
  iban?: string;
}

/**
 * Creates a Georgian IBAN recipient account in Wise.
 * GEL IBANs start with GE and are 22 characters long.
 */
export async function createGeorgianRecipient(params: {
  accountHolderName: string;
  iban: string;
  /** Must be "GEL" */
  currency?: string;
}): Promise<WiseRecipient> {
  const profileId = await getWiseProfileId();
  return wiseRequest<WiseRecipient>(`/v1/accounts`, {
    method: "POST",
    body: {
      profile: profileId,
      accountHolderName: params.accountHolderName,
      currency: params.currency ?? "GEL",
      type: "iban",
      details: {
        legalType: "BUSINESS",
        iban: params.iban.replace(/\s+/g, "").toUpperCase(),
      },
    },
  });
}

// ─── Transfer ──────────────────────────────────────────────────────────────────

export interface WiseTransfer {
  id: number;
  targetAccount: number;
  quote: string;
  status: string;
  reference?: string;
  rate: number;
  created: string;
  hasActiveIssues: boolean;
}

/**
 * Creates a transfer from an approved quote to a recipient account.
 * Pass a unique `idempotencyKey` (e.g. schedule row ID) to prevent duplicates.
 */
export async function createTransfer(params: {
  quoteId: string;
  targetAccountId: number;
  reference?: string;
  idempotencyKey: string;
}): Promise<WiseTransfer> {
  return wiseRequest<WiseTransfer>("/v1/transfers", {
    method: "POST",
    headers: { "X-idempotence-uuid": params.idempotencyKey },
    body: {
      targetAccount: params.targetAccountId,
      quoteUuid: params.quoteId,
      customerTransactionId: params.idempotencyKey,
      details: {
        reference: params.reference ?? "KavShare platform commission",
        transferPurpose: "verification.transfers.purpose.pay.bills",
        sourceOfFunds: "verification.source.of.funds.business",
      },
    },
  });
}

// ─── Fund transfer ─────────────────────────────────────────────────────────────

export interface WiseFundResult {
  type: string;
  status: string;
  errorCode: string | null;
}

/**
 * Funds (executes) a previously created transfer.
 * Must be called separately after createTransfer().
 */
export async function fundTransfer(
  transferId: number
): Promise<WiseFundResult> {
  const profileId = await getWiseProfileId();
  return wiseRequest<WiseFundResult>(
    `/v3/profiles/${profileId}/transfers/${transferId}/payments`,
    {
      method: "POST",
      body: { type: "BALANCE" },
    }
  );
}

// ─── Transfer status ───────────────────────────────────────────────────────────

export async function getTransferStatus(
  transferId: number
): Promise<{ id: number; status: string; hasActiveIssues: boolean }> {
  return wiseRequest(`/v1/transfers/${transferId}`);
}

// ─── Zod validation schemas ────────────────────────────────────────────────────

/** Georgian IBAN: GE + 2 check digits + 16 digits = 20 chars total. */
const GEORGIAN_IBAN_REGEX = /^GE\d{2}[A-Z0-9]{16}$/i;

export const georgianBankAccountSchema = z.object({
  accountHolderName: z
    .string()
    .min(2, "Account holder name must be at least 2 characters")
    .max(100),
  iban: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => GEORGIAN_IBAN_REGEX.test(v), {
      message: "Invalid Georgian IBAN — must start with GE followed by 18 alphanumeric characters",
    }),
  bankName: z.string().min(2).max(100).optional(),
});

export type GeorgianBankAccount = z.infer<typeof georgianBankAccountSchema>;

"use client";

import { AlertTriangle, Building2, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { georgianBankAccountSchema, type GeorgianBankAccount } from "@/lib/wise/config";

interface GeorgianBankAccountFormProps {
  /** Provider's company UUID — used to link the account in the DB. */
  companyId: string;
  /** Called after a successful save. */
  onSaved?: (account: GeorgianBankAccount & { id: string }) => void;
}

const GEORGIAN_BANKS = [
  "TBC Bank",
  "Bank of Georgia",
  "Liberty Bank",
  "Credo Bank",
  "ProCredit Bank",
  "VTB Bank Georgia",
  "Cartu Bank",
  "Silk Road Bank",
  "Other",
];

export function GeorgianBankAccountForm({ companyId, onSaved }: GeorgianBankAccountFormProps) {
  const [accountHolderName, setAccountHolderName] = useState("");
  const [iban, setIban]                           = useState("");
  const [bankName, setBankName]                   = useState("");
  const [errors, setErrors]                       = useState<Record<string, string>>({});
  const [submitting, setSubmitting]               = useState(false);
  const [success, setSuccess]                     = useState(false);
  const [apiError, setApiError]                   = useState<string | null>(null);

  /** Format IBAN with a space every 4 chars for readability. */
  function formatIBAN(raw: string): string {
    const clean = raw.replace(/\s+/g, "").toUpperCase();
    return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
  }

  function handleIBANChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatIBAN(e.target.value);
    setIban(formatted);
    // Clear field error on change
    if (errors.iban) setErrors((prev) => ({ ...prev, iban: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setErrors({});

    // Client-side Zod validation
    const parsed = georgianBankAccountSchema.safeParse({
      accountHolderName,
      iban,
      bankName: bankName || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      // Upsert bank account linked to company
      const { data, error } = await supabase
        .from("company_bank_accounts")
        .upsert(
          {
            company_id: companyId,
            account_holder_name: parsed.data.accountHolderName,
            iban: parsed.data.iban, // stored normalised (no spaces)
            bank_name: parsed.data.bankName ?? null,
            currency: "GEL",
            country: "GE",
            is_active: true,
          },
          { onConflict: "company_id" }          // one primary account per company
        )
        .select()
        .single();

      if (error) throw error;

      setSuccess(true);
      onSaved?.({ ...parsed.data, id: data.id });
    } catch (err: any) {
      setApiError(err.message ?? "Failed to save bank account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-2xl p-6 flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary">Bank Account Saved</p>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Your Georgian IBAN has been securely stored. KavShare will use this account for
            all commission payouts via Wise.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Building2 className="h-4.5 w-4.5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-text-primary tracking-tight">
            Georgian Payout Account
          </h3>
          <p className="text-[10px] text-text-muted">
            Enter your IBAN to receive commission payouts via Wise
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">

        {/* Security Notice */}
        <div className="flex gap-3 items-start bg-slate-950/50 border border-slate-800/60 rounded-xl p-4">
          <ShieldCheck className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-muted leading-relaxed">
            Your bank details are encrypted at rest and only used for KavShare commission transfers via
            the Wise API. We never store card numbers or full payment credentials.
          </p>
        </div>

        {/* Account Holder Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="wise-account-holder"
            className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest"
          >
            Account Holder Name <span className="text-rose-400">*</span>
          </label>
          <input
            id="wise-account-holder"
            type="text"
            placeholder="e.g. Kavshare Solutions Ltd"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none transition ${
              errors.accountHolderName ? "border-rose-700" : "border-slate-800 focus:border-slate-600"
            }`}
          />
          {errors.accountHolderName && (
            <p className="text-[10px] text-rose-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {errors.accountHolderName}
            </p>
          )}
        </div>

        {/* IBAN */}
        <div className="space-y-1.5">
          <label
            htmlFor="wise-iban"
            className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest"
          >
            Georgian IBAN <span className="text-rose-400">*</span>
          </label>
          <input
            id="wise-iban"
            type="text"
            placeholder="GE00 TB00 0000 0000 0000 00"
            value={iban}
            onChange={handleIBANChange}
            maxLength={27}               // GE + 18 chars + 4 spaces
            spellCheck={false}
            autoComplete="off"
            className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs font-mono text-text-primary focus:outline-none tracking-widest transition ${
              errors.iban ? "border-rose-700" : "border-slate-800 focus:border-slate-600"
            }`}
          />
          <p className="text-[10px] text-text-muted">
            Georgian IBANs start with <strong className="text-text-secondary">GE</strong> and are 22 characters (e.g. GE29NB0000000101904917).
          </p>
          {errors.iban && (
            <p className="text-[10px] text-rose-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {errors.iban}
            </p>
          )}
        </div>

        {/* Bank Name (optional) */}
        <div className="space-y-1.5">
          <label
            htmlFor="wise-bank-name"
            className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest"
          >
            Bank Name <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <select
            id="wise-bank-name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-600"
          >
            <option value="">Select your bank…</option>
            {GEORGIAN_BANKS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="flex gap-2 items-start bg-rose-950/30 border border-rose-900/50 rounded-xl p-3">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-300">{apiError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving Account…</>
          ) : (
            <><ShieldCheck className="h-4 w-4" /> Save Payout Account</>
          )}
        </button>
      </form>
    </div>
  );
}

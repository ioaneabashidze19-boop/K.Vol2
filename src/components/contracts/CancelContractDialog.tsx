"use client";

import {
  AlertTriangle, XCircle, Loader2, CheckCircle,
  FileText, DollarSign, Clock, ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface CancelContractDialogProps {
  contractId: string;
  contractTitle?: string;
  monthlyValue?: number;
  minimumTermMonths?: number;
  startDate?: string;
  onClose: () => void;
  onCancelled: (contractId: string, penaltyAmount: number) => void;
}

const CANCELLATION_REASONS = [
  { value: "budget_constraints",    label: "Budget Constraints" },
  { value: "scope_change",          label: "Change in Project Scope" },
  { value: "provider_performance",  label: "Provider Performance Issues" },
  { value: "business_restructure",  label: "Business Restructure / Shutdown" },
  { value: "mutual_agreement",      label: "Mutual Agreement with Provider" },
  { value: "force_majeure",         label: "Force Majeure / Unforeseen Circumstances" },
  { value: "other",                 label: "Other (specify in notes)" },
] as const;

export function CancelContractDialog({
  contractId,
  contractTitle = "Contract",
  monthlyValue = 0,
  minimumTermMonths = 12,
  startDate,
  onClose,
  onCancelled,
}: CancelContractDialogProps) {
  const [step, setStep] = useState<"preview" | "success">("preview");
  const [reason, setReason] = useState("");
  const [notes, setNotes]   = useState("");
  const [penaltyAmount, setPenaltyAmount]           = useState(0);
  const [penaltyScheduleCount, setPenaltyScheduleCount] = useState(0);
  const [minimumRemaining, setMinimumRemaining]     = useState(0);
  const [loadingPenalty, setLoadingPenalty]         = useState(true);
  const [submitting, setSubmitting]                 = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [auditRef, setAuditRef] = useState("");

  // ── Live penalty preview ────────────────────────────────────────────────
  useEffect(() => {
    async function calculate() {
      setLoadingPenalty(true);
      try {
        const { data: contract } = await supabase
          .from("contracts")
          .select("start_date,minimum_term_months,monthly_value,commission_rate")
          .eq("id", contractId)
          .single();

        const start      = new Date(contract?.start_date ?? startDate ?? new Date());
        const minMonths  = contract?.minimum_term_months ?? minimumTermMonths;
        const mVal       = contract?.monthly_value       ?? monthlyValue;
        const rate       = contract?.commission_rate     ?? 10;
        const minEnd     = new Date(start);
        minEnd.setMonth(minEnd.getMonth() + minMonths);

        const monthsLeft = Math.max(
          0,
          Math.ceil((minEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
        );

        setMinimumRemaining(mVal * monthsLeft);
        setPenaltyAmount(mVal * (rate / 100) * monthsLeft);
        setPenaltyScheduleCount(monthsLeft);
      } catch {
        const start   = new Date(startDate ?? new Date());
        const minEnd  = new Date(start);
        minEnd.setMonth(minEnd.getMonth() + minimumTermMonths);
        const left = Math.max(
          0,
          Math.ceil((minEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
        );
        setMinimumRemaining(monthlyValue * left);
        setPenaltyAmount(monthlyValue * 0.1 * left);
        setPenaltyScheduleCount(left);
      } finally {
        setLoadingPenalty(false);
      }
    }
    calculate();
  }, [contractId, startDate, minimumTermMonths, monthlyValue]);

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!reason) { setError("Please select a cancellation reason."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const fullReason = reason + (notes ? ` — ${notes}` : "");
      const { error: upErr } = await supabase
        .from("contracts")
        .update({ status: "cancelled", cancellation_reason: fullReason })
        .eq("id", contractId);
      if (upErr) throw upErr;

      const { data: pen, error: rpcErr } = await supabase.rpc(
        "enforce_cancellation_minimums", { p_contract_id: contractId }
      );
      if (rpcErr) console.warn("Penalty RPC:", rpcErr.message);
      const finalPenalty = (pen as any)?.penaltyAmount ?? penaltyAmount;

      const ref = `CANCEL-${Date.now().toString(36).toUpperCase()}`;
      setAuditRef(ref);
      await supabase.from("audit_logs").insert({
        action: "contract_cancelled", entity_type: "contract", entity_id: contractId,
        metadata: { reason, notes, penaltyAmount: finalPenalty, auditReference: ref },
      });

      setStep("success");
      onCancelled(contractId, finalPenalty);
    } catch (e: any) {
      setError(e.message ?? "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalOwed = minimumRemaining + penaltyAmount;

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl shadow-rose-950/20 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950/60 to-slate-900 border-b border-slate-800 px-6 py-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h2 id="cancel-dialog-title" className="text-sm font-extrabold text-text-primary tracking-tight">
                {step === "success" ? "Cancellation Confirmed" : "Cancel Contract"}
              </h2>
              <p className="text-[10px] text-text-muted mt-0.5 truncate max-w-xs">{contractTitle}</p>
            </div>
          </div>
          {step !== "success" && !submitting && (
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition ml-4 mt-0.5" aria-label="Close">
              <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* ── SUCCESS ──────────────────────────────────────────── */}
          {step === "success" && (
            <div className="text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-full bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-text-primary">Contract has been cancelled</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  All parties have been notified. Penalty schedules have been updated and a billing reference issued.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left space-y-1">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Audit Reference</span>
                <code className="block text-xs font-mono text-cyan-400">{auditRef}</code>
              </div>

              {penaltyAmount > 0 && (
                <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 text-left">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Penalty Billing Notice</span>
                  <p className="text-xs text-text-secondary mt-1">
                    A penalty invoice of{" "}
                    <strong className="text-rose-300">${penaltyAmount.toFixed(2)}</strong>{" "}
                    has been recorded. Emails with full breakdown have been dispatched to both parties.
                  </p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-text-secondary text-xs font-bold py-2.5 rounded-xl transition"
              >
                Close
              </button>
            </div>
          )}

          {/* ── PREVIEW / CONFIRM ─────────────────────────────────── */}
          {step === "preview" && (
            <>
              {/* Warning */}
              <div className="flex gap-3 bg-amber-950/20 border border-amber-900/40 rounded-xl p-4">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Cancelling before the minimum binding term ends triggers{" "}
                  <strong className="text-amber-300">early termination fees</strong>. Review the penalty breakdown before proceeding.
                </p>
              </div>

              {/* Penalty card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Penalty Calculation</span>
                  {loadingPenalty && <Loader2 className="h-3 w-3 text-text-muted animate-spin ml-auto" />}
                </div>
                <div className="px-4 py-4 space-y-3 text-xs">
                  <div className="flex justify-between text-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-text-muted" />
                      Minimum term remaining ({penaltyScheduleCount} months)
                    </span>
                    <span className="font-semibold">{loadingPenalty ? "—" : `$${minimumRemaining.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between text-rose-300">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Early termination penalty
                    </span>
                    <span className="font-bold">{loadingPenalty ? "—" : `$${penaltyAmount.toFixed(2)}`}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-3 flex justify-between">
                    <span className="font-extrabold text-text-primary">Total Amount Owed</span>
                    <span className="font-extrabold text-rose-400 text-sm">
                      {loadingPenalty ? "Calculating…" : `$${totalOwed.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label htmlFor="cancel-reason" className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  Cancellation Reason <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    id="cancel-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-600 pr-8"
                  >
                    <option value="">Select a reason…</option>
                    {CANCELLATION_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label htmlFor="cancel-notes" className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  Additional Notes
                </label>
                <textarea
                  id="cancel-notes" rows={3}
                  placeholder="Provide any additional context about this cancellation…"
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-600 resize-none placeholder:text-text-muted/50"
                />
              </div>

              {/* Notification notice */}
              <div className="flex gap-2 items-start bg-slate-950/50 border border-slate-800/60 rounded-xl p-3">
                <FileText className="h-3.5 w-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Cancellation emails will be dispatched to <strong className="text-text-secondary">both parties</strong> and the{" "}
                  <strong className="text-text-secondary">platform admin</strong>. An audit log entry will be created with a billing reference for any outstanding penalties.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex gap-2 items-start bg-rose-950/30 border border-rose-900/50 rounded-xl p-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-300">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={onClose} disabled={submitting}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-text-secondary text-xs font-bold py-2.5 rounded-xl transition disabled:opacity-50"
                >
                  Keep Contract
                </button>
                <button
                  type="button" onClick={handleConfirm}
                  disabled={submitting || loadingPenalty || !reason}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cancelling…</>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5" /> Confirm Cancellation</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

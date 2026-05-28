"use client";

import { use, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import { 
  ShieldCheck, 
  Plus, 
  Check, 
  AlertCircle, 
  FileDown, 
  Loader2, 
  UserCheck, 
  RefreshCw, 
  ClipboardList
} from "lucide-react";

interface AdminPayoutsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function AdminPayoutsPage({ params }: AdminPayoutsPageProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { isLoaded } = useUser();

  // Database lists
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [manualPayments, setManualPayments] = useState<any[]>([]);

  // Form states
  const [amountOverride, setAmountOverride] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);



  // 1. Initial Load: Fetch all companies & recorded manual payouts
  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        // Fetch all provider companies
        const { data: comp } = await supabase
          .from("companies")
          .select("id, name")
          .order("name", { ascending: true });
        
        setCompanies(comp || []);

        // Fetch recorded manual payments
        await fetchManualPayments();
      } catch (err) {
        console.error("Initial load failed:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // Fetch recorded manual payments list
  async function fetchManualPayments() {
    const { data: pmts } = await supabase
      .from("commission_payments")
      .select(`
        id,
        amount,
        payment_method,
        status,
        reference,
        admin_notes,
        created_at,
        paid_at,
        schedule_id,
        companies (
          name
        )
      `)
      .eq("payment_method", "manual")
      .order("created_at", { ascending: false });

    setManualPayments(pmts || []);
  }

  // 2. Fetch schedules when selected company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setSchedules([]);
      setSelectedScheduleIds([]);
      setAmountOverride("");
      return;
    }

    async function loadSchedules() {
      setLoadingSchedules(true);
      try {
        // Fetch engagements for the selected company
        const { data: engagements } = await supabase
          .from("engagements")
          .select("id")
          .eq("company_id", selectedCompanyId);
        
        const engagementIds = engagements?.map((e) => e.id) || [];
        if (engagementIds.length === 0) {
          setSchedules([]);
          setLoadingSchedules(false);
          return;
        }

        // Fetch contracts linked to those engagements
        const { data: contracts } = await supabase
          .from("contracts")
          .select("id")
          .in("engagement_id", engagementIds);
        
        const contractIds = contracts?.map((c) => c.id) || [];
        if (contractIds.length === 0) {
          setSchedules([]);
          setLoadingSchedules(false);
          return;
        }

        // Fetch commission schedules that are unpaid (pending/overdue/processing)
        const { data: scheds } = await supabase
          .from("commission_schedules")
          .select("id, month, expected_amount, paid_amount, status")
          .in("contract_id", contractIds)
          .in("status", ["pending", "overdue", "processing"])
          .order("month", { ascending: true });

        setSchedules(scheds || []);
      } catch (err) {
        console.error("Failed to load schedules:", err);
      } finally {
        setLoadingSchedules(false);
      }
    }

    loadSchedules();
  }, [selectedCompanyId]);

  // Handle schedule checkbox toggle
  const toggleSchedule = (id: string) => {
    setSelectedScheduleIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      
      // Calculate total amount auto-fill
      const sum = schedules
        .filter((s) => next.includes(s.id))
        .reduce((acc, s) => acc + (Number(s.expected_amount) - Number(s.paid_amount)), 0);
      setAmountOverride(sum > 0 ? sum.toFixed(2) : "");
      
      return next;
    });
  };

  // Action 1: Record Manual Payment (Status: 'pending' in database, details in metadata)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || selectedScheduleIds.length === 0 || !amountOverride) {
      alert(isKa ? "გთხოვთ შეავსოთ ყველა ველი" : "Please select a provider, schedules, and enter an amount.");
      return;
    }

    setSubmitting(true);
    try {
      const finalAmount = parseFloat(amountOverride);
      
      // We insert one payment entry per schedule to align with DB triggers and constraints
      const selectedSchedules = schedules.filter((s) => selectedScheduleIds.includes(s.id));
      const proportionFactor = finalAmount / selectedSchedules.reduce((acc, s) => acc + (Number(s.expected_amount) - Number(s.paid_amount)), 0);

      const insertPromises = selectedSchedules.map(async (s) => {
        const schedUnpaid = Number(s.expected_amount) - Number(s.paid_amount);
        const allocatedAmount = Number((schedUnpaid * proportionFactor).toFixed(2));

        const { error } = await supabase.from("commission_payments").insert({
          company_id: selectedCompanyId,
          schedule_id: s.id,
          amount: allocatedAmount,
          payment_method: "manual",
          status: "pending", // maps to 'pending_verification' functionality
          reference: reference.trim() || "MANUAL_WIRE_REF",
          admin_notes: notes.trim() || "Manual payout requested",
          metadata: {
            verification_required: true,
            is_manual_payout: true,
            original_override_amount: finalAmount,
          },
        });

        if (error) throw error;

        // Temporarily put schedules to processing
        await supabase
          .from("commission_schedules")
          .update({ status: "processing" })
          .eq("id", s.id);
      });

      await Promise.all(insertPromises);

      // Audit log entry
      await supabase.from("audit_logs").insert({
        action: "manual_payment_recorded",
        table_name: "commission_payments",
        details: {
          company_id: selectedCompanyId,
          amount: finalAmount,
          schedule_ids: selectedScheduleIds,
          reference,
        },
      });

      // Clear form
      setSelectedCompanyId("");
      setSelectedScheduleIds([]);
      setAmountOverride("");
      setReference("");
      setNotes("");

      await fetchManualPayments();
      alert(isKa ? "გადახდა წარმატებით დარეგისტრირდა" : "Manual payment successfully recorded, pending verification.");
    } catch (err: any) {
      console.error("Recording failed:", err);
      alert(isKa ? "რეგისტრაცია ვერ მოხერხდა" : "Failed to record manual payment: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Action 2: Verify Payment received/sent (Admin signs off)
  const handleVerifyPayment = async (paymentId: string) => {
    setVerifyingId(paymentId);
    try {
      // 1. Fetch target payment
      const { data: payment, error: fetchErr } = await supabase
        .from("commission_payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (fetchErr || !payment) throw new Error("Payment record not found");

      // 2. Update payment status to completed (paid)
      const { error: payErr } = await supabase
        .from("commission_payments")
        .update({
          status: "completed",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (payErr) throw payErr;

      // 3. Update the associated commission schedule to paid
      if (payment.schedule_id) {
        const { data: schedule } = await supabase
          .from("commission_schedules")
          .select("expected_amount")
          .eq("id", payment.schedule_id)
          .single();

        const expectedAmt = schedule ? Number(schedule.expected_amount) : payment.amount;

        const { error: schedErr } = await supabase
          .from("commission_schedules")
          .update({
            status: "paid",
            paid_amount: expectedAmt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.schedule_id);

        if (schedErr) throw schedErr;
      }

      // Log to audit logs
      await supabase.from("audit_logs").insert({
        action: "manual_payment_verified",
        table_name: "commission_payments",
        record_id: paymentId,
        details: {
          verified_by_admin: true,
          amount: payment.amount,
          schedule_id: payment.schedule_id,
        },
      });

      // Simulate sending email to provider
      console.log(`[Manual Payment Notification] Payment confirmed email sent to provider:
        - Payment Reference: ${payment.reference}
        - Total Settled: GEL ${payment.amount}
        - Status: COMPLETED`);

      await fetchManualPayments();
    } catch (err: any) {
      console.error("Verification failed:", err);
      alert(isKa ? "დადასტურება ვერ მოხერხდა" : "Failed to verify manual payment: " + err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  // Generate dynamic client-side HTML Print window for Invoice
  const triggerInvoicePrint = (payment: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedDate = new Date(payment.created_at).toLocaleDateString();
    const paidDate = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "PENDING";

    const htmlContent = `
      <html>
        <head>
          <title>KavShare Invoice - ${payment.reference}</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #333; padding: 40px; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; border-b: 2px solid #eee; padding-bottom: 20px; margin-bottom: 40px; }
            .logo { font-size: 24px; font-weight: 800; color: #06b6d4; }
            .title { font-size: 18px; font-weight: bold; text-align: right; }
            .details-box { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .section-title { font-size: 12px; text-transform: uppercase; color: #999; font-weight: bold; margin-bottom: 8px; }
            .table { w-full border-collapse: collapse; margin-bottom: 40px; }
            table { width: 100%; border-collapse: collapse; }
            th { border-bottom: 2px solid #ddd; text-align: left; padding: 10px 0; }
            td { border-bottom: 1px solid #eee; padding: 12px 0; }
            .total-row { font-size: 18px; font-weight: bold; }
            .notes { font-size: 12px; color: #666; background: #f9f9f9; padding: 15px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">KavShare</div>
              <p style="font-size: 11px; margin: 2px 0 0 0; color: #666;">Commission Settlement Invoice</p>
            </div>
            <div class="title">
              MANUAL PAYMENT RECEIPT
              <p style="font-size: 11px; font-weight: normal; margin: 2px 0 0 0;">Ref: ${payment.reference}</p>
            </div>
          </div>

          <div class="details-box">
            <div>
              <div class="section-title">Settled From</div>
              <strong>${payment.companies?.name || "Provider Company"}</strong>
              <p style="margin: 4px 0 0 0; font-size: 12px;">Tbilisi, Georgia</p>
            </div>
            <div class="details-right" style="text-align: right;">
              <div class="section-title">Invoice Information</div>
              <p style="margin: 4px 0 0 0; font-size: 12px;">Created: ${formattedDate}</p>
              <p style="margin: 2px 0 0 0; font-size: 12px;">Verified Paid: ${paidDate}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Method</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Manual commission settlement (Schedule reference: ${payment.schedule_id?.substring(0, 8) || "N/A"})</td>
                <td>Wire/Bank Transfer</td>
                <td style="text-align: right; font-weight: bold;">GEL ${payment.amount}</td>
              </tr>
              <tr class="total-row">
                <td colspan="2" style="border: none; padding-top: 20px;">Total Settled</td>
                <td style="text-align: right; border: none; padding-top: 20px; color: #06b6d4;">GEL ${payment.amount}</td>
              </tr>
            </tbody>
          </table>

          <div class="notes">
            <strong>Notes / Audit Reference:</strong>
            <p style="margin: 4px 0 0 0;">${payment.admin_notes || "No notes provided."}</p>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "ადმინ პანელი იტვირთება..." : "Loading admin dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-6">
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> 
                {isKa ? "ადმინისტრატორის მართვის პანელი" : "KavShare Admin Dashboard"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "მექანიკური გადახდების რეგისტრაცია" : "Manual Commission Payouts"}
              </h1>
              <p className="text-xs text-text-muted mt-1">
                {isKa 
                  ? "დაარეგისტრირეთ და დაადასტურეთ ხელით შესრულებული საბანკო გადარიცხვები პროვაიდერებისთვის." 
                  : "Record and sign off bank wire transfers and manual payouts for non-Stripe providers."}
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Record Form Column */}
            <div className="lg:col-span-1 bg-slate-900/40 border border-slate-850 p-6 rounded-3xl space-y-6 shadow-xl h-fit">
              <div>
                <h3 className="text-xs uppercase font-extrabold text-cyan-400 tracking-wider flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />
                  {isKa ? "გადახდის რეგისტრაცია" : "Record New Payment"}
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {isKa ? "შეავსეთ დეტალები ტრანსფერის დასარეგისტრირებლად." : "Enter transaction particulars below."}
                </p>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
                
                {/* Select Provider */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                    {isKa ? "პროვაიდერი" : "Select Provider"}
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-slate-700 transition"
                  >
                    <option value="">{isKa ? "აირჩიეთ პროვაიდერი..." : "Select provider..."}</option>
                    {companies.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Schedules to Pay */}
                {selectedCompanyId && (
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      {isKa ? "გადასახდელი თვეები" : "Select Schedules"}
                    </label>
                    
                    {loadingSchedules ? (
                      <div className="py-4 flex justify-center">
                        <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
                      </div>
                    ) : schedules.length === 0 ? (
                      <div className="p-3 bg-slate-950/60 border border-slate-850/60 rounded-xl text-center text-text-muted">
                        {isKa ? "აქტიური გადასახდელები არ მოიძებნა" : "No pending schedules found."}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {schedules.map((s) => {
                          const unpaid = Number(s.expected_amount) - Number(s.paid_amount);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                                selectedScheduleIds.includes(s.id)
                                  ? "bg-slate-950 border-cyan-500/40 text-text-primary"
                                  : "bg-slate-950/60 border-slate-850 text-text-muted hover:border-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedScheduleIds.includes(s.id)}
                                  onChange={() => toggleSchedule(s.id)}
                                  className="bg-slate-900 border-slate-800 text-cyan-500 focus:ring-0 h-4 w-4 rounded"
                                />
                                <div className="text-[11px]">
                                  <span className="block font-bold text-text-secondary">
                                    {new Date(s.month).toLocaleDateString(isKa ? "ka-GE" : "en-US", { month: "short", year: "numeric" })}
                                  </span>
                                  <span className="text-[9px] text-text-muted font-mono uppercase">
                                    Status: {s.status}
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono text-cyan-400 font-bold">
                                GEL {unpaid.toFixed(2)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Amount override */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                    {isKa ? "თანხის ოდენობა (GEL)" : "Override Amount (GEL)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountOverride}
                    onChange={(e) => setAmountOverride(e.target.value)}
                    placeholder="e.g. 150.00"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 font-mono text-text-primary focus:outline-none focus:border-slate-700 transition"
                  />
                </div>

                {/* Reference */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                    {isKa ? "გადარიცხვის რეფერენსი" : "Payment Reference"}
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. Wire Transfer #901248"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-slate-700 transition"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                    {isKa ? "ადმინისტრატორის შენიშვნა" : "Notes"}
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide audit details, branch code, bank name etc..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedCompanyId || selectedScheduleIds.length === 0}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isKa ? "გადახდის დამატება" : "Record Manual Payment"}
                </button>

              </form>
            </div>

            {/* Payouts Ledger / Verification Column */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Ledger Panel */}
              <div className="bg-slate-900/30 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4 text-cyan-400" />
                      {isKa ? "მექანიკური გადახდების რეესტრი" : "Manual Payments Ledger"}
                    </h3>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {isKa ? "დაადასტურეთ ან დაბეჭდეთ ხელით რეგისტრირებული გადახდები." : "Verify status or download invoice documentation."}
                    </p>
                  </div>
                  <button
                    onClick={fetchManualPayments}
                    className="p-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-xl text-text-muted hover:text-text-primary transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {manualPayments.length === 0 ? (
                  <div className="text-center py-16 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    {isKa ? "რეესტრი ცარიელია" : "No manual payments recorded."}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                    {manualPayments.map((p) => {
                      const isPending = p.status === "pending";
                      return (
                        <div
                          key={p.id}
                          className="bg-slate-950/60 border border-slate-850/80 p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 text-xs transition hover:border-slate-800"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-text-primary text-[13px]">
                                {p.companies?.name}
                              </span>
                              {isPending ? (
                                <span className="bg-amber-500/10 text-amber-400 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  {isKa ? "დადასტურების მოლოდინში" : "Pending Verification"}
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                  <Check className="h-2.5 w-2.5" />
                                  {isKa ? "დადასტურებული" : "Completed / Paid"}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-text-secondary">
                              <span>
                                {isKa ? "თარიღი:" : "Created:"} <strong className="text-text-muted">{new Date(p.created_at).toLocaleDateString()}</strong>
                              </span>
                              <span>
                                {isKa ? "რეფერენსი:" : "Ref:"} <code className="text-cyan-400">{p.reference}</code>
                              </span>
                              <span className="col-span-2">
                                {isKa ? "შენიშვნა:" : "Note:"} <span className="text-text-muted italic">"{p.admin_notes || 'N/A'}"</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex sm:flex-col justify-between items-end gap-2 border-t sm:border-t-0 border-slate-900 pt-3 sm:pt-0">
                            <span className="font-mono text-cyan-400 font-black text-sm">
                              GEL {Number(p.amount).toFixed(2)}
                            </span>
                            
                            <div className="flex gap-2">
                              {/* Print/Download Invoice */}
                              <button
                                onClick={() => triggerInvoicePrint(p)}
                                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-text-secondary hover:text-text-primary transition flex items-center gap-1"
                              >
                                <FileDown className="h-3.5 w-3.5" />
                                {isKa ? "ინვოისი" : "Invoice"}
                              </button>

                              {/* Verify Payout */}
                              {isPending && (
                                <button
                                  onClick={() => handleVerifyPayment(p.id)}
                                  disabled={verifyingId === p.id}
                                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-[10px] font-extrabold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                                >
                                  {verifyingId === p.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5" />
                                  )}
                                  {isKa ? "დადასტურება" : "Verify Payment"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

            </div>

          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}

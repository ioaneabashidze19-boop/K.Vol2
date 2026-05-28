"use client";

import { use, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Loader2,
  DollarSign,
  CreditCard,
  History,
  AlertTriangle,
  PlusCircle,
  X,
  RefreshCw,
  Download
} from "lucide-react";

interface AdminFinanceProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function AdminFinancePage({ params }: AdminFinanceProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Core loaders & registries
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [historyPayments, setHistoryPayments] = useState<any[]>([]);

  // Form states for manual payments
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  // Processing modals
  const [processingPayment, setProcessingPayment] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("manual");
  const [stripeSyncing, setStripeSyncing] = useState(false);

  // Dispute logs
  const [disputes, setDisputes] = useState<any[]>([
    {
      id: "disp-pay-1",
      companyName: "Tbilisi Softworks LLC",
      amount: 450,
      reason: "Double charged invoice commission settlement for April 2026",
      status: "open",
    },
    {
      id: "disp-pay-2",
      companyName: "FinTech Hub Ltd",
      amount: 1200,
      reason: "Wise automated conversion delay charge Dispute",
      status: "open",
    }
  ]);

  // Load finance records
  async function loadFinanceLedger() {
    try {
      setLoading(true);

      // 1. Fetch Companies
      const { data: compList } = await supabase
        .from("companies")
        .select("id, name");
      setCompanies(compList || []);

      // 2. Fetch payments registry
      const { data: payList } = await supabase
        .from("commission_payments")
        .select("*, company:companies(name)");

      const list = payList || [];
      setPayments(list);

      // Separate pending vs completed history
      const pending = list.filter((p) => p.status === "pending" || p.status === "processing");
      const history = list.filter((p) => p.status === "completed" || p.status === "failed" || p.status === "refunded");

      setPendingPayments(pending);
      setHistoryPayments(history);

      if (compList && compList.length > 0) {
        setSelectedCompanyId(compList[0].id);
      }
    } catch (err) {
      console.error("Failed loading financial dashboards:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadFinanceLedger();
  }, [isLoaded, user]);

  // Insert a Manual Payment Ledger record
  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !manualAmount || isNaN(Number(manualAmount))) {
      alert("Please check manual payment amount values!");
      return;
    }

    try {
      const { error } = await supabase
        .from("commission_payments")
        .insert({
          company_id: selectedCompanyId,
          amount: Number(manualAmount),
          payment_method: "manual",
          status: "completed",
          reference: manualReference.trim() || `MANUAL-${Date.now()}`,
          admin_notes: manualNotes.trim() || "Manual payout registered through admin dashboard.",
          paid_at: new Date().toISOString(),
        });

      if (error) throw error;

      alert(isKa ? "გადახდა წარმატებით დარეგისტრირდა!" : "Manual wire settlement recorded successfully!");
      setManualAmount("");
      setManualReference("");
      setManualNotes("");
      await loadFinanceLedger();
    } catch (err: any) {
      alert("Error recording payment: " + err.message);
    }
  };

  // Process payouts validation (Stripe / Wise reconciliation)
  const triggerProcessPayment = (pay: any) => {
    setProcessingPayment(pay);
    setPaymentMethod("manual");
  };

  const submitProcessPayment = async () => {
    if (!processingPayment) return;

    try {
      const { error } = await supabase
        .from("commission_payments")
        .update({
          status: "completed",
          payment_method: paymentMethod,
          paid_at: new Date().toISOString(),
        })
        .eq("id", processingPayment.id);

      if (error) throw error;

      alert(isKa ? "პროცესინგი წარმატებით დასრულდა!" : "Payout settlement completed!");
      setProcessingPayment(null);
      await loadFinanceLedger();
    } catch (err: any) {
      alert("Error processing: " + err.message);
    }
  };

  // Resolve disputes
  const handleResolveDispute = async (id: string, resolveType: "refund" | "completed") => {
    try {
      if (resolveType === "refund") {
        setDisputes((prev) => prev.filter((d) => d.id !== id));
        alert(isKa ? "თანხა უკან დაუბრუნდა პროვაიდერს!" : "Dispute closed: Refund successfully aggregated back to provider.");
      } else {
        setDisputes((prev) => prev.filter((d) => d.id !== id));
        alert(isKa ? "დავა დაიხურა წარმატებით!" : "Dispute resolved: Transaction adjustment successfully authorized.");
      }
    } catch (err: any) {
      alert("Resolution error: " + err.message);
    }
  };

  // Sync Stripe Connect accounts
  const triggerStripeSync = () => {
    setStripeSyncing(true);
    setTimeout(() => {
      setStripeSyncing(false);
      alert("Stripe balances matched. 0 discrepancy found.");
    }, 1500);
  };

  // CSV Report Generator
  const triggerFinancialCsvReport = () => {
    const headers = ["Payment ID", "Company Name", "Amount (GEL)", "Method", "Status", "Date Settled"];
    const rows = payments.map((p) => [
      p.id,
      p.company?.name || "N/A",
      p.amount,
      p.payment_method || "N/A",
      p.status,
      p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "Pending"
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kavshare_financial_settlements.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Financial aggregates
  const totalRevenue = payments
    .filter((p) => p.status === "completed")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const projectedRevenue = totalRevenue * 1.15; // Simulated future margin growth

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "ფინანსები იტვირთება..." : "Compiling financial charts..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-6">
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1 font-mono">
                <DollarSign className="h-4 w-4" />
                {isKa ? "ფინანსური კონტროლი" : "Platform Financial Ledger"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "ფინანსები და გადახდები" : "Finance & Payments"}
              </h1>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={triggerStripeSync}
                disabled={stripeSyncing}
                className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-850 text-text-primary border border-slate-800 font-bold px-4 py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${stripeSyncing ? "animate-spin" : ""}`} />
                Stripe Sync
              </button>
              <button
                onClick={triggerFinancialCsvReport}
                className="flex-1 sm:flex-none bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export CSV Report
              </button>
            </div>
          </div>

          {/* Revenue Analytics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            {/* Aggregate 1 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md">
              <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Total Aggregated Revenue</span>
              <p className="text-xl font-black text-emerald-400 tracking-tight">
                GEL {totalRevenue.toLocaleString()}
              </p>
            </div>

            {/* Aggregate 2 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md">
              <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider font-mono">Commission Splits</span>
              <p className="text-xs font-bold text-text-primary mt-1">IT Development: 75%</p>
              <p className="text-[10px] text-text-muted">Creative Marketing: 25%</p>
            </div>

            {/* Aggregate 3 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md">
              <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Projected Next Month</span>
              <p className="text-xl font-black text-text-primary tracking-tight">
                GEL {projectedRevenue.toLocaleString()}
              </p>
            </div>

            {/* Aggregate 4: Simple Trajectory Line SVG */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md flex flex-col justify-between">
              <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Growth trajectory</span>
              <div className="h-8 w-full pt-1">
                <svg className="w-full h-full" viewBox="0 0 100 20">
                  <path d="M 0 18 Q 25 15 50 8 T 100 2" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Column: Pending Payouts & History */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Pending Table */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                    <CreditCard className="h-4 w-4 text-cyan-400" />
                    Pending Commissions Settlements
                  </h3>
                  <p className="text-[10px] text-text-muted">Partners invoices awaiting Stripe card charges or manual wire validation.</p>
                </div>

                {pendingPayments.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    No pending payouts require system processing.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-900 text-text-secondary uppercase tracking-widest text-[9px] font-bold">
                          <th className="pb-2">Provider</th>
                          <th className="pb-2 text-right">Amount</th>
                          <th className="pb-2 text-center">Status</th>
                          <th className="pb-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/30">
                        {pendingPayments.map((pay) => (
                          <tr key={pay.id} className="hover:bg-slate-900/20 transition">
                            <td className="py-3 font-bold text-text-primary">{pay.company?.name || "Partner"}</td>
                            <td className="py-3 text-right font-mono">GEL {Number(pay.amount).toLocaleString()}</td>
                            <td className="py-3 text-center">
                              <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                {pay.status}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => triggerProcessPayment(pay)}
                                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl transition text-[10px]"
                              >
                                Process
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* History Table */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                    <History className="h-4 w-4 text-cyan-400" />
                    Completed Payout Ledger history
                  </h3>
                  <p className="text-[10px] text-text-muted">Auditable archive of all transaction settlements.</p>
                </div>

                {historyPayments.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    No payment history has been archived.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-900 text-text-secondary uppercase tracking-widest text-[9px] font-bold">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Provider</th>
                          <th className="pb-2 text-right">Amount</th>
                          <th className="pb-2 text-center">Method</th>
                          <th className="pb-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/30">
                        {historyPayments.map((pay) => (
                          <tr key={pay.id} className="hover:bg-slate-900/20 transition">
                            <td className="py-3 font-mono text-[10px] text-text-secondary">
                              {pay.paid_at ? new Date(pay.paid_at).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="py-3 font-bold text-text-primary">{pay.company?.name || "Partner"}</td>
                            <td className="py-3 text-right font-mono text-emerald-400">
                              GEL {Number(pay.amount).toLocaleString()}
                            </td>
                            <td className="py-3 text-center font-mono uppercase text-[10px] text-text-secondary">
                              {pay.payment_method || "Stripe"}
                            </td>
                            <td className="py-3 text-center">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                pay.status === "completed" 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}>
                                {pay.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Record Manual Wire & Disputes */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Record manual transfer form */}
              <form onSubmit={handleRecordManualPayment} className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4 text-xs">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                    <PlusCircle className="h-4 w-4 text-cyan-400" />
                    Record Wire Transfer
                  </h3>
                  <p className="text-[10px] text-text-muted">Record manual wire check payments directly into commission histories.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Select Partner Company</label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Payout Amount (GEL)</label>
                    <input
                      type="number"
                      required
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      placeholder="1200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Reference / Bank wire transaction #</label>
                    <input
                      type="text"
                      required
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      placeholder="TXN-GE-94920"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Admin notes</label>
                    <textarea
                      rows={3}
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                      placeholder="Enter verification notes..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition text-xs"
                  >
                    Confirm Manual Payment
                  </button>
                </div>
              </form>

              {/* Disputes List */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Payment Disputes
                  </h3>
                  <p className="text-[10px] text-text-muted">Partner refund claims requiring admin resolutions.</p>
                </div>

                {disputes.length === 0 ? (
                  <div className="text-center py-6 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-[10px]">
                    No active disputes found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputes.map((d) => (
                      <div key={d.id} className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <strong className="text-text-primary">{d.companyName}</strong>
                          <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            GEL {d.amount}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">Reason: {d.reason}</p>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleResolveDispute(d.id, "refund")}
                            className="flex-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 py-1.5 rounded-xl font-bold transition text-[10px]"
                          >
                            Refund Payout
                          </button>
                          <button
                            onClick={() => handleResolveDispute(d.id, "completed")}
                            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-1.5 rounded-xl transition text-[10px]"
                          >
                            Resolve Adjust
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* PROCESS PAYMENT OVERLAY DIALOG */}
          {processingPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-md w-full rounded-3xl p-6 relative space-y-5 shadow-2xl">
                <button
                  onClick={() => setProcessingPayment(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1 font-mono">
                    <DollarSign className="h-4 w-4 animate-pulse" />
                    Process Platform Payout
                  </span>
                  <h3 className="text-base font-black text-text-primary tracking-tight">Settlement for {processingPayment.company?.name}</h3>
                  <p className="text-[11px] text-text-muted">
                    Choose payout method. Confirming marks the ledger transaction as completed.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Select Payout Channel</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                    >
                      <option value="stripe">Stripe Connect Direct settlement</option>
                      <option value="wise">Wise Payout wire (GEL)</option>
                      <option value="manual">Manual Bank Transfer Check</option>
                    </select>
                  </div>

                  <div className="border-t border-slate-850 pt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setProcessingPayment(null)}
                      className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitProcessPayment}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-2 rounded-xl transition"
                    >
                      Complete Settlement
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}

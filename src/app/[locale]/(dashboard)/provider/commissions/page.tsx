"use client";

import {
  DollarSign,
  Calendar,
  CreditCard,
  TrendingUp,
  Filter,
  Download,
  AlertTriangle,
  Mail,
  CheckCircle,
  Clock,
  ArrowUpDown,
  Search,
  ChevronRight,
  PlusCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ProviderCommissionsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

// Mock Fallback Data if DB is empty or during demo testing
const MOCK_CONTRACTS = [
  { id: "c1", title: "Apex CRM Integration", client: "Google Cloud", value: 8500, start: "2026-01-10", end: "2026-12-10" },
  { id: "c2", title: "UI Redesign Retainer", client: "Stripe", value: 4200, start: "2026-03-01", end: null },
  { id: "c3", title: "Scale MVP Deployment", client: "Vercel", value: 12000, start: "2026-02-15", end: "2026-08-15" },
];

const MOCK_SCHEDULES = [
  { id: "s1", month: "2026-05-01", amount: 850, status: "paid", contractId: "c1", txId: "ch_3MvY82LkdCo4I7", paidAt: "2026-05-05" },
  { id: "s2", month: "2026-05-01", amount: 420, status: "paid", contractId: "c2", txId: "ch_3MvY91LkdCo9V1", paidAt: "2026-05-05" },
  { id: "s3", month: "2026-06-01", amount: 850, status: "pending", contractId: "c1" },
  { id: "s4", month: "2026-06-01", amount: 420, status: "processing", contractId: "c2" },
  { id: "s5", month: "2026-06-01", amount: 1200, status: "pending", contractId: "c3" },
  { id: "s6", month: "2026-07-01", amount: 850, status: "pending", contractId: "c1" },
  { id: "s7", month: "2026-07-01", amount: 420, status: "pending", contractId: "c2" },
];

function CommissionsDashboardBody({ locale }: { locale: string }) {
  const router = useRouter();

  // State Variables
  const [schedules, setSchedules] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selected schedule detail modal
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [disputedSchedule, setDisputedSchedule] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  // Stripe & Manual setup State
  const [stripeStatus, setStripeStatus] = useState<"not_setup" | "connected">("not_setup");
  const [showStripeModal, setShowStripeModal] = useState(false);

  // Email notifications feedback
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadCommissionData() {
      setLoading(true);
      try {
        // Query schedules and contracts
        const { data: schedData, error: schedErr } = await supabase
          .from("commission_schedules")
          .select(`
            *,
            contract:contracts (
              id,
              monthly_value,
              start_date,
              end_date,
              engagement:engagements (
                id,
                company_id,
                seeker:seekers (company_name),
                company:companies (name)
              )
            )
          `);

        if (schedErr || !schedData || schedData.length === 0) {
          // Fallback to mocks for preview/testing
          setSchedules(MOCK_SCHEDULES);
          setContracts(MOCK_CONTRACTS);
        } else {
          // Format DB data
          const formattedSchedules = schedData.map((s: any) => ({
            id: s.id,
            month: s.month,
            amount: s.expected_amount,
            status: s.status,
            contractId: s.contract_id,
            txId: s.id.substring(0, 18), // Stub Reference ID
            paidAt: s.updated_at,
          }));

          const uniqueContracts = Array.from(
            new Map(
              schedData.map((s: any) => [
                s.contract?.id,
                {
                  id: s.contract?.id,
                  title: `Contract Ref #${s.contract?.id.substring(0, 8)}`,
                  client: s.contract?.engagement?.seeker?.company_name || "Seeker Client",
                  value: s.contract?.monthly_value,
                  start: s.contract?.start_date,
                  end: s.contract?.end_date,
                },
              ])
            ).values()
          );

          setSchedules(formattedSchedules);
          setContracts(uniqueContracts);
        }
      } catch (err) {
        console.error("Failed loading schedules:", err);
        setSchedules(MOCK_SCHEDULES);
        setContracts(MOCK_CONTRACTS);
      } finally {
        setLoading(false);
      }
    }

    loadCommissionData();
  }, []);

  // Helpers to fetch related details
  const getContract = (id: string) => contracts.find((c) => c.id === id) || MOCK_CONTRACTS[0];

  // Aggregated Summary values
  const totalPending = schedules
    .filter((s) => s.status === "pending" || s.status === "processing")
    .reduce((sum, s) => sum + s.amount, 0);

  const totalPaidThisMonth = schedules
    .filter((s) => s.status === "paid" && s.month.startsWith("2026-05"))
    .reduce((sum, s) => sum + s.amount, 0);

  const totalEarnedAllTime = schedules
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.amount, 0);

  const nextPayoutDate = "June 10, 2026";

  // Filter & Sort Schedules
  const processedSchedules = schedules
    .filter((s) => {
      const contract = getContract(s.contractId);
      const matchesSearch = contract.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            contract.client.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || s.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.month).getTime();
      const dateB = new Date(b.month).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  // Export to CSV Function
  const exportToCSV = () => {
    const headers = ["Month", "Contract Title", "Client", "Amount Due ($)", "Status", "Transaction Reference"];
    const rows = processedSchedules.map((s) => {
      const contract = getContract(s.contractId);
      return [s.month, contract.title, contract.client, s.amount, s.status, s.txId || "N/A"];
    });

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KavShare_Platform_Commissions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Simulate Triggering Email Reminder
  const triggerEmailReminder = (sched: any) => {
    setEmailStatus(`Reminder email successfully queued for ${getContract(sched.contractId).client}.`);
    setTimeout(() => setEmailStatus(null), 5000);
  };

  // Simulate Dispute Action
  const submitDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason.trim()) return;

    setDisputeSuccess(true);
    setTimeout(() => {
      setDisputedSchedule(null);
      setDisputeReason("");
      setDisputeSuccess(false);
    }, 3000);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" /> Platform Financial Ledger
          </span>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">Commissions & Payout Center</h1>
          <p className="text-xs text-text-muted">Track expected platform percentages, current payouts, and dispute terms.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="bg-slate-900 border border-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-850 transition text-text-secondary flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => router.push(`/${locale}/contracts/new`)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          >
            <PlusCircle className="h-4 w-4" /> New Contract
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Forecast</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-text-primary">${totalPending.toFixed(2)}</p>
          <span className="text-[10px] text-text-muted block">Expected platform allocation</span>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Paid This Month</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-text-primary">${totalPaidThisMonth.toFixed(2)}</p>
          <span className="text-[10px] text-text-muted block">Settled since May 1, 2026</span>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Next Payout Cycle</span>
            <Calendar className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="text-base font-black text-text-primary mt-1.5">{nextPayoutDate}</p>
          <span className="text-[10px] text-text-muted block mt-0.5">Automated Stripe transfer</span>
        </div>

        {/* Card 4 */}
        <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">All-Time Settled</span>
            <TrendingUp className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-black text-text-primary">${totalEarnedAllTime.toFixed(2)}</p>
          <span className="text-[10px] text-text-muted block">Aggregated commissions</span>
        </div>
      </div>

      {/* Main Panel Content: Chart & Stripe CTA */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* SVG Chart Panel */}
        <div className="lg:col-span-2 bg-slate-900/30 border border-slate-850 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-extrabold text-text-muted tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-cyan-400" /> 6-Month Commission Settled Forecast
            </h3>
            <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-900/50 px-2 py-0.5 rounded-full">
              Growth Trend
            </span>
          </div>

          <div className="h-48 w-full relative pt-4">
            {/* SVG Sparkline Sparking Trend */}
            <svg viewBox="0 0 500 100" className="w-full h-full text-cyan-500 stroke-current fill-none">
              <path
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M 10 90 L 90 75 L 170 85 L 250 50 L 330 65 L 410 25 L 490 10"
                className="drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]"
              />
              <path
                d="M 10 90 L 90 75 L 170 85 L 250 50 L 330 65 L 410 25 L 490 10 L 490 100 L 10 100 Z"
                fill="url(#sparkline-grad)"
                stroke="none"
              />
              <defs>
                <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(6,182,212,0.22)" />
                  <stop offset="100%" stopColor="rgba(6,182,212,0.0)" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Months Axis */}
            <div className="flex justify-between text-[9px] text-text-muted px-2 mt-1">
              <span>Dec</span>
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun (Proj)</span>
            </div>
          </div>
        </div>

        {/* Payout Settings / Stripe CTA Panel */}
        <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs uppercase font-extrabold text-text-muted tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-cyan-400" /> Settled Transfer Methods
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Configure automatic routing directly into your business account. We process payouts every month.
            </p>
          </div>

          {stripeStatus === "not_setup" ? (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-3">
              <span className="text-[10px] text-amber-500 font-bold bg-amber-950/20 border border-amber-900/40 px-2 py-0.5 rounded-full inline-block">
                Action Required
              </span>
              <h4 className="text-xs font-bold text-text-primary">Stripe Payouts Incomplete</h4>
              <p className="text-[10px] text-text-muted">Link your account to initiate zero-delay monthly ledger withdrawals.</p>
              <button
                onClick={() => setShowStripeModal(true)}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold py-2 rounded-xl transition"
              >
                Connect Stripe Account
              </button>
            </div>
          ) : (
            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-950 space-y-2 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] text-emerald-400 font-bold block">Connected to Stripe</span>
                <span className="text-xs font-mono text-text-secondary">** Bank Ending in 4242</span>
              </div>
              <button
                onClick={() => setStripeStatus("not_setup")}
                className="text-[10px] text-text-muted hover:text-rose-400 transition"
              >
                Disconnect
              </button>
            </div>
          )}

          <div className="text-[10px] text-text-muted flex items-center gap-2 justify-center">
            <span>Or:</span>
            <button className="underline hover:text-cyan-400">Request Manual Wire Transfer</button>
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {emailStatus && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> {emailStatus}
        </div>
      )}

      {/* Filters & Search Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/20 border border-slate-850 p-4 rounded-2xl">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search by client or contract..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Filter className="h-3.5 w-3.5 text-text-muted" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-850 text-xs text-text-secondary rounded-xl p-2 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="penalty">Penalty</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="bg-slate-950 border border-slate-850 p-2 rounded-xl text-text-secondary hover:text-cyan-400"
            title="Toggle Date Sort"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-slate-900/20 border border-slate-850 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-850 text-text-muted text-[10px] uppercase font-bold">
                <th className="p-4">Target Month</th>
                <th className="p-4">Contract Title</th>
                <th className="p-4">Client Company</th>
                <th className="p-4 text-right">Commission Amount</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted animate-pulse">
                    Querying platform ledger databases...
                  </td>
                </tr>
              ) : processedSchedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    No matching schedules found.
                  </td>
                </tr>
              ) : (
                processedSchedules.map((row) => {
                  const contract = getContract(row.contractId);
                  return (
                    <tr key={row.id} className="border-b border-slate-850/40 hover:bg-slate-900/10 text-text-secondary">
                      <td className="p-4 font-semibold text-text-primary">
                        {new Date(row.month).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </td>
                      <td className="p-4 font-medium">{contract.title}</td>
                      <td className="p-4">{contract.client}</td>
                      <td className="p-4 text-right font-bold text-text-primary">${row.amount.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            row.status === "paid"
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50"
                              : row.status === "processing"
                              ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/50"
                              : row.status === "penalty"
                              ? "bg-rose-950/40 text-rose-400 border border-rose-900/50"
                              : "bg-amber-950/40 text-amber-400 border border-amber-900/50"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedSchedule(row)}
                          className="text-[10px] text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          Details <ChevronRight className="h-3 w-3" />
                        </button>
                        {row.status === "pending" && (
                          <button
                            onClick={() => triggerEmailReminder(row)}
                            className="text-text-muted hover:text-cyan-400"
                            title="Send Payment Reminder"
                          >
                            <Mail className="h-3.5 w-3.5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout History Segment */}
      <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl space-y-4">
        <h3 className="text-xs uppercase font-extrabold text-text-muted tracking-wider flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-cyan-400" /> Settled Payouts Ledger History
        </h3>
        <div className="space-y-3">
          {schedules.filter((s) => s.status === "paid").slice(0, 3).map((hist) => {
            const contract = getContract(hist.contractId);
            return (
              <div key={hist.id} className="flex justify-between items-center bg-slate-950/50 border border-slate-850/60 p-4 rounded-xl text-xs">
                <div className="space-y-0.5">
                  <span className="font-semibold text-text-primary">{contract.title}</span>
                  <div className="flex gap-2 text-[10px] text-text-muted">
                    <span>Paid: {hist.paidAt.split("T")[0]}</span>
                    <span>•</span>
                    <span>Ref: {hist.txId}</span>
                  </div>
                </div>
                <span className="font-extrabold text-emerald-400">+${hist.amount.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payout Details Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 max-w-md w-full space-y-5">
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-extrabold text-text-primary">Ledger Statement Details</h4>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="border-b border-slate-850 pb-2">
                <span className="text-[10px] text-text-muted">Associated Agreement</span>
                <p className="font-bold text-text-primary text-sm mt-0.5">{getContract(selectedSchedule.contractId).title}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-text-secondary">
                <div>
                  <span className="text-[10px] text-text-muted">Client Company:</span>
                  <p className="font-semibold mt-0.5">{getContract(selectedSchedule.contractId).client}</p>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted">Schedule Term Month:</span>
                  <p className="font-semibold mt-0.5">{selectedSchedule.month}</p>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted">Expected Yield:</span>
                  <p className="font-semibold mt-0.5">${selectedSchedule.amount.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted">Settlement Status:</span>
                  <p className="font-semibold mt-0.5 capitalize">{selectedSchedule.status}</p>
                </div>
              </div>

              {selectedSchedule.txId && (
                <div>
                  <span className="text-[10px] text-text-muted">Transaction ID Reference:</span>
                  <code className="block mt-0.5 text-cyan-400 font-mono text-[10px]">{selectedSchedule.txId}</code>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setDisputedSchedule(selectedSchedule);
                  setSelectedSchedule(null);
                }}
                className="flex-1 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-text-secondary font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Dispute Payment
              </button>
              
              <button
                onClick={() => alert("Mock Invoice generated and downloading...")}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Download Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Reporting Dialog */}
      {disputedSchedule && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-extrabold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Open Payment Dispute
              </h4>
              <button
                onClick={() => setDisputedSchedule(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            {disputeSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-text-primary">Dispute Case Registered</p>
                <p className="text-[10px] text-text-muted">A platform auditor will evaluate the contract ledger records shortly.</p>
              </div>
            ) : (
              <form onSubmit={submitDispute} className="space-y-4">
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Provide detailed explanations of missing payouts, calculated discrepancies, or milestones mismatch for Contract:{" "}
                  <strong>{getContract(disputedSchedule.contractId).title}</strong>.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary">Explanation</label>
                  <textarea
                    rows={3}
                    placeholder="Milestone was certified on May 4, but payouts have not processed..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-xs text-text-primary focus:outline-none resize-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisputedSchedule(null)}
                    className="bg-slate-950 border border-slate-850 px-4 py-2 rounded-xl text-xs text-text-secondary hover:bg-slate-850"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-rose-500 hover:bg-rose-400 px-4 py-2 rounded-xl text-xs text-slate-950 font-black"
                  >
                    Submit Dispute Case
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Stripe Connect Simulation Dialog */}
      {showStripeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center">
            <div className="h-12 w-12 bg-cyan-950/50 border border-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mx-auto">
              <CreditCard className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-text-primary">Connect with Stripe Payouts</h4>
              <p className="text-[10px] text-text-muted">
                Accept payouts directly. Redirecting to Stripe onboarding session to secure bank links.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowStripeModal(false)}
                className="flex-1 bg-slate-950 border border-slate-850 py-2 rounded-xl text-xs text-text-secondary hover:bg-slate-850"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setStripeStatus("connected");
                  setShowStripeModal(false);
                }}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 py-2 rounded-xl text-xs text-slate-950 font-black"
              >
                Verify Connection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ProviderCommissionsPage({ params }: ProviderCommissionsPageProps) {
  const resolvedParams = use(params);
  const currentLocale = resolvedParams.locale;

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <Suspense fallback={<div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100"><div className="h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" /></div>}>
          <CommissionsDashboardBody locale={currentLocale} />
        </Suspense>
      </div>
    </div>
  );
}

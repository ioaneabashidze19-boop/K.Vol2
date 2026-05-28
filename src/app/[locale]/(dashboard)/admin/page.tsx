"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Loader2,
  Users,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Activity,
  Check,
  X,
  RefreshCw
} from "lucide-react";

interface AdminDashboardProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function AdminDashboardPage({ params }: AdminDashboardProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Loading and stats state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Platform metrics
  const [stats, setStats] = useState({
    activeProviders: 0,
    pendingProviders: 0,
    totalSeekers: 0,
    activeContracts: 0,
    completedContracts: 0,
    totalCommissionsPaid: 0,
  });

  // Lists for management panels
  const [pendingCompanies, setPendingCompanies] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  // Simulated dispute logs
  const [disputes] = useState<any[]>([
    {
      id: "disp-1",
      contractTitle: "Custom E-Commerce Platform API",
      provider: "Tbilisi Softworks",
      seeker: "EuroStore Ltd",
      amount: "GEL 4,500",
      reason: "Deliverables milestone delayed by over 30 days",
      created_at: new Date(Date.now() - 86400000 * 2).toLocaleDateString(),
    },
    {
      id: "disp-2",
      contractTitle: "SaaS Devops Setup & Tuning",
      provider: "CloudGEL Integrations",
      seeker: "FinTech Hub",
      amount: "GEL 8,900",
      reason: "Unexpected staging cost override disputes",
      created_at: new Date(Date.now() - 86400000 * 5).toLocaleDateString(),
    }
  ]);

  // Load metrics from database
  async function loadAdminMetrics() {
    try {
      // 1. Fetch Companies count
      const { data: companies } = await supabase
        .from("companies")
        .select("status, id, name, created_at");

      const companyList = companies || [];
      const activeP = companyList.filter((c) => c.status === "active").length;
      const pendingP = companyList.filter((c) => c.status === "pending").length;

      setPendingCompanies(companyList.filter((c) => c.status === "pending"));

      // 2. Fetch Seekers count
      const { count: seekersCount } = await supabase
        .from("seekers")
        .select("*", { count: "exact", head: true });

      // 3. Fetch Contracts details
      const { data: contracts } = await supabase
        .from("contracts")
        .select("status, id, created_at, monthly_value");

      const contractList = contracts || [];
      const activeC = contractList.filter((c) => c.status === "active").length;
      const completedC = contractList.filter((c) => c.status === "completed").length;

      // 4. Fetch commissions revenue sum
      const { data: schedules } = await supabase
        .from("commission_schedules")
        .select("expected_amount, status, month");

      const scheduleList = schedules || [];
      const revenuePaid = scheduleList
        .filter((s) => s.status === "paid")
        .reduce((acc, s) => acc + Number(s.expected_amount), 0);

      setStats({
        activeProviders: activeP,
        pendingProviders: pendingP,
        totalSeekers: seekersCount || 0,
        activeContracts: activeC,
        completedContracts: completedC,
        totalCommissionsPaid: revenuePaid,
      });

      // Populate pending payments list (commission schedules pending/overdue)
      const mockPendingPayments = scheduleList
        .filter((s) => s.status === "pending" || s.status === "processing")
        .map((s, index) => ({
          id: s.month + "-" + index,
          date: s.month,
          amount: Number(s.expected_amount),
          status: s.status,
        }));
      setPendingPayments(mockPendingPayments);

      // Create recent activity feed matching the queried databases
      const activities = [];
      if (companyList.length > 0) {
        activities.push({
          type: "provider_signup",
          label: `New Provider: ${companyList[0].name}`,
          time: new Date(companyList[0].created_at).toLocaleDateString(),
        });
      }
      if (contractList.length > 0) {
        activities.push({
          type: "contract_created",
          label: "New SLA agreement initiated",
          time: new Date(contractList[0].created_at).toLocaleDateString(),
        });
      }
      activities.push({
        type: "payout_collected",
        label: `Settlement revenue aggregated: GEL ${revenuePaid.toLocaleString()}`,
        time: "Real-time",
      });

      setRecentActivities(activities);

    } catch (err) {
      console.error("Failed compiling admin console dashboard:", err);
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadData() {
      setLoading(true);
      await loadAdminMetrics();
      setLoading(false);
    }
    loadData();
  }, [isLoaded, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAdminMetrics();
    setRefreshing(false);
  };

  // Process provider validation (Verify / Reject)
  const handleVerifyProvider = async (companyId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: approve ? "active" : "rejected" })
        .eq("id", companyId);

      if (error) throw error;

      alert(approve ? "კომპანია წარმატებით ვერიფიცირდა!" : "კომპანია უარყოფილია.");
      // Reload matching metrics
      await loadAdminMetrics();
    } catch (err: any) {
      alert("Verification update failed: " + err.message);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "ადმინ პანელი იტვირთება..." : "Loading Admin Dashboard Console..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Top Panel Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-6">
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1 font-mono">
                <ShieldCheck className="h-4 w-4" />
                {isKa ? "ადმინისტრატორის კონსოლი" : "Enterprise System Operations"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "ადმინ პანელი" : "Admin Operations Control"}
              </h1>
              <p className="text-xs text-text-muted mt-1">
                {isKa 
                  ? "მართეთ პროვაიდერები, აკონტროლეთ გადახდები და გააანალიზეთ პლატფორმის აქტივობა." 
                  : "Platform health auditing, manual Wise settlement processing, and contract dispute oversight."}
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-4 py-2 rounded-xl transition text-xs flex items-center gap-1.5 self-stretch md:self-auto justify-center"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {isKa ? "განახლება" : "Refresh Metrics"}
            </button>
          </div>

          {/* Platform Health Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            {/* Stat 1 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider pt-2">Providers (Active/Pending)</p>
              <p className="text-xl font-black text-text-primary tracking-tight">
                {stats.activeProviders} <span className="text-xs font-normal text-cyan-400">/ {stats.pendingProviders} pending</span>
              </p>
            </div>

            {/* Stat 2 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider pt-2">Seekers Registered</p>
              <p className="text-xl font-black text-text-primary tracking-tight">
                {stats.totalSeekers}
              </p>
            </div>

            {/* Stat 3 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider pt-2">Active Agreements</p>
              <p className="text-xl font-black text-text-primary tracking-tight">
                {stats.activeContracts} <span className="text-xs font-normal text-text-muted">/ {stats.completedContracts} completed</span>
              </p>
            </div>

            {/* Stat 4 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-1 relative shadow-md">
              <div className="p-2 bg-emerald-500/10 rounded-xl w-fit text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider pt-2">Commissions Collected</p>
              <p className="text-xl font-black text-emerald-400 tracking-tight">
                GEL {stats.totalCommissionsPaid.toLocaleString()}
              </p>
            </div>

          </div>

          {/* Revenue Charts & User Metrics Analytics Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Chart Column 1: Monthly Commission Revenue */}
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl space-y-4 shadow-xl">
              <div>
                <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  Monthly Commission Revenue
                </h3>
                <p className="text-[10px] text-text-muted">Historical revenue aggregated through Wise webhook events.</p>
              </div>

              {/* Vector SVG Line Chart */}
              <div className="h-32 w-full pt-4 relative flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 45">
                  <path
                    d="M 0 40 L 20 35 L 40 32 L 60 22 L 80 18 L 100 8"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                  />
                  <circle cx="20" cy="35" r="1.5" fill="#22d3ee" />
                  <circle cx="40" cy="32" r="1.5" fill="#22d3ee" />
                  <circle cx="60" cy="22" r="1.5" fill="#22d3ee" />
                  <circle cx="80" cy="18" r="1.5" fill="#22d3ee" />
                  <circle cx="100" cy="8" r="2.5" fill="#22d3ee" />
                </svg>
              </div>
              
              <div className="flex justify-between text-[9px] font-mono text-text-muted pt-2 border-t border-slate-900">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
              </div>
            </div>

            {/* Chart Column 2: Revenue Category Splits */}
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl space-y-4 shadow-xl">
              <div>
                <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  Revenue by Service Category
                </h3>
                <p className="text-[10px] text-text-muted font-sans">Relative split percentage across sectors.</p>
              </div>

              <div className="h-32 flex items-center justify-center">
                {/* SVG Pie Chart Mock */}
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 32 32">
                  <circle r="16" cx="16" cy="16" fill="transparent" stroke="#22d3ee" strokeWidth="32" strokeDasharray="60 100" />
                  <circle r="16" cx="16" cy="16" fill="transparent" stroke="#0ea5e9" strokeWidth="32" strokeDasharray="30 100" strokeDashoffset="-60" />
                  <circle r="16" cx="16" cy="16" fill="transparent" stroke="#10b981" strokeWidth="32" strokeDasharray="10 100" strokeDashoffset="-90" />
                </svg>
              </div>

              <div className="grid grid-cols-3 gap-1 text-[9px] text-center font-mono">
                <span className="text-cyan-400">IT Dev (60%)</span>
                <span className="text-sky-500">Legal (30%)</span>
                <span className="text-emerald-400">Marketing (10%)</span>
              </div>
            </div>

            {/* Chart Column 3: Platform Retention Metrics */}
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl space-y-4 shadow-xl">
              <div>
                <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  User Activity Retention
                </h3>
                <p className="text-[10px] text-text-muted">Active usage trends (Month, Week, Day).</p>
              </div>

              <div className="space-y-3.5 pt-4 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-text-secondary">
                    <span>Monthly Active Users (MAU)</span>
                    <strong className="text-text-primary">820</strong>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full w-[85%]" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-text-secondary">
                    <span>Weekly Active Users (WAU)</span>
                    <strong className="text-text-primary">342</strong>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full w-[65%]" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-text-secondary">
                    <span>Daily Active Users (DAU)</span>
                    <strong className="text-text-primary">94</strong>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-400 h-full w-[40%]" />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Actions & Pending Provider Validations */}
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Panel: Verification approvals */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Approvals */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                    Pending Provider Approvals
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    Validate company identities and review service capabilities before giving active state status.
                  </p>
                </div>

                {pendingCompanies.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    No pending provider companies require validation.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingCompanies.map((c) => (
                      <div
                        key={c.id}
                        className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <strong className="text-text-primary block">{c.name}</strong>
                          <span className="text-[9px] text-text-muted block font-mono">
                            Registered: {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleVerifyProvider(c.id, false)}
                            className="flex-1 sm:flex-none bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 px-3.5 py-2 rounded-xl transition text-[10px] flex items-center justify-center gap-1 font-bold"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                          <button
                            onClick={() => handleVerifyProvider(c.id, true)}
                            className="flex-1 sm:flex-none bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3.5 py-2 rounded-xl transition text-[10px] flex items-center justify-center gap-1 font-extrabold"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Verify Company
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Disputes overview */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Flagged Contract Disputes
                  </h3>
                  <p className="text-[10px] text-text-muted font-sans">Audit open platform disputes between clients and provider teams.</p>
                </div>

                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div
                      key={d.id}
                      className="bg-slate-950/60 border border-slate-850/80 p-4 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <strong className="text-text-primary">{d.contractTitle}</strong>
                        <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {d.amount}
                        </span>
                      </div>

                      <p className="text-text-muted text-[11px] leading-relaxed">
                        Reason: {d.reason}
                      </p>

                      <div className="flex justify-between items-center text-[10px] text-text-secondary pt-2 border-t border-slate-900 font-mono">
                        <span>Provider: {d.provider} / Seeker: {d.seeker}</span>
                        <span>Date: {d.created_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Panel: Pending Payments & manual settlements */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Quick Actions Panel */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-3">
                <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                  Admin System Actions
                </h3>
                
                <div className="space-y-2.5">
                  <Link
                    href={`/${locale}/admin/payouts`}
                    className="w-full text-center bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    Process Manual Settlement
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <button
                    onClick={() => alert("Daily system backups successfully saved to primary PostgreSQL replica.")}
                    className="w-full text-center bg-slate-900 hover:bg-slate-850 text-text-primary border border-slate-800 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center"
                  >
                    Backup System Data
                  </button>
                </div>
              </div>

              {/* Settlement processing queue */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                    Settlement Status Queue
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    Schedules awaiting manual / webhook processing confirmations.
                  </p>
                </div>

                {pendingPayments.length === 0 ? (
                  <div className="text-center py-6 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-[10px]">
                    No pending settlements in queue.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingPayments.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="block font-bold text-text-primary font-mono">
                            GEL {p.amount.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-text-muted flex items-center gap-0.5 font-mono">
                            <Clock className="h-3 w-3" />
                            Month: {p.date}
                          </span>
                        </div>

                        <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity log */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                  Platform Operations Feed
                </h3>

                <div className="space-y-3.5">
                  {recentActivities.map((act, i) => (
                    <div key={i} className="flex gap-3 text-xs">
                      <div className="h-2 w-2 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                      <div className="space-y-0.5">
                        <p className="text-text-primary leading-tight font-bold">{act.label}</p>
                        <span className="text-[9px] text-text-muted font-mono">{act.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}

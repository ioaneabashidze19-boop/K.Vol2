"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Loader2,
  TrendingUp,
  FileText,
  Users,
  Clock,
  ArrowRight,
  AlertCircle,
  Percent,
  Eye,
  X,
  CreditCard,
  Building,
  UserCheck
} from "lucide-react";

interface ProviderDashboardProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function ProviderDashboardPage({ params }: ProviderDashboardProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Company and dashboard states
  const [company, setCompany] = useState<any | null>(null);
  const [metrics, setMetrics] = useState({
    profileViews: 342,
    activeLeads: 0,
    activeContracts: 0,
    pendingCommissions: 0,
  });

  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [earningsSummary, setEarningsSummary] = useState({
    earnedThisMonth: 0,
    pendingEarnings: 0,
    payoutHistory: [] as any[],
  });

  const [profileHealth, setProfileHealth] = useState({
    percentage: 100,
    missingFields: [] as string[],
  });

  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadProviderDashboard() {
      if (!user) return;
      try {
        setLoading(true);

        // 1. Fetch User Mapping
        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!dbUser) {
          setLoading(false);
          return;
        }

        // 2. Fetch Company details owned by user
        const { data: comp } = await supabase
          .from("companies")
          .select("*")
          .eq("owner_id", dbUser.id)
          .single();

        if (!comp) {
          setLoading(false);
          return;
        }

        setCompany(comp);

        // 3. Profile Health Check
        const fields = [
          { name: "description", label: "Description" },
          { name: "logo_url", label: "Logo Image" },
          { name: "website", label: "Website URL" },
          { name: "location", label: "Location details" },
          { name: "founded_year", label: "Founded Year" },
          { name: "employee_count", label: "Employee Count" }
        ];
        const missing = [];
        let filledCount = 0;
        for (const f of fields) {
          if (comp[f.name]) {
            filledCount++;
          } else {
            missing.push(f.label);
          }
        }
        const healthPercent = Math.round(((filledCount + 4) / (fields.length + 4)) * 100); // 4 base fields are always filled
        setProfileHealth({
          percentage: healthPercent,
          missingFields: missing,
        });

        // 4. Fetch engagements & contracts for key stats
        const { data: engagements } = await supabase
          .from("engagements")
          .select("id, status, seeker_id, seekers(company_name, users(name))")
          .eq("company_id", comp.id);

        const engs = engagements || [];
        const activeEngIds = engs.filter((e) => e.status === "active").map((e) => e.id);

        // Query active contracts
        let activeContractsList: any[] = [];
        let totalMonthlyIncome = 0;
        if (activeEngIds.length > 0) {
          const { data: contractsList } = await supabase
            .from("contracts")
            .select("*")
            .in("engagement_id", activeEngIds);

          if (contractsList) {
            activeContractsList = contractsList.map((c) => {
              const eng = engs.find((e) => e.id === c.engagement_id);
              const seekerName = (eng as any)?.seekers?.company_name || (eng as any)?.seekers?.users?.name || "Client Seeker";
              return {
                ...c,
                clientName: seekerName,
              };
            });
            totalMonthlyIncome = contractsList
              .filter((c) => c.status === "active")
              .reduce((acc, c) => acc + Number(c.monthly_value), 0);
          }
        }

        setActiveContracts(activeContractsList);

        // 5. Fetch commission schedules for billing status
        let pendingCommissionsAmount = 0;
        let payoutList: any[] = [];
        if (activeContractsList.length > 0) {
          const contractIds = activeContractsList.map((c) => c.id);
          const { data: schedules } = await supabase
            .from("commission_schedules")
            .select("*")
            .in("contract_id", contractIds);

          if (schedules) {
            pendingCommissionsAmount = schedules
              .filter((s) => s.status === "pending" || s.status === "processing" || s.status === "overdue")
              .reduce((acc, s) => acc + Number(s.expected_amount), 0);

            // Populate payout list mock with completed payouts matching database Paid/Schedules status
            payoutList = schedules
              .filter((s) => s.status === "paid")
              .map((s) => ({
                id: s.id,
                date: s.month,
                amount: Number(s.expected_amount),
                status: "paid",
              }));
          }
        }

        // 6. Fetch recent leads matching general active requests
        const { data: activePosts } = await supabase
          .from("procurement_posts")
          .select("id, title, description, budget, urgency, created_at, seekers(company_name)")
          .eq("status", "active")
          .limit(5);

        // Mock additional lead interaction statuses
        const processedLeads = (activePosts || []).map((p, index) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          budget: p.budget,
          urgency: p.urgency,
          date: p.created_at,
          client: (p.seekers as any)?.company_name || "Client",
          status: index === 0 ? "New" : index === 1 ? "Viewed" : "Replied",
        }));

        setRecentLeads(processedLeads);

        setMetrics({
          profileViews: 342,
          activeLeads: processedLeads.length,
          activeContracts: activeContractsList.filter((c) => c.status === "active").length,
          pendingCommissions: pendingCommissionsAmount,
        });

        setEarningsSummary({
          earnedThisMonth: totalMonthlyIncome - pendingCommissionsAmount,
          pendingEarnings: totalMonthlyIncome,
          payoutHistory: payoutList.slice(0, 3),
        });

      } catch (err) {
        console.error("Failed loading provider portal data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProviderDashboard();
  }, [isLoaded, user]);

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "პორტალი იტვირთება..." : "Loading provider console..."}
          </p>
        </div>
      </div>
    );
  }

  // Handle fallback if user is logged in but hasn't created a company profile yet
  if (!company) {
    return (
      <ProtectedRoute allowedRoles={["provider"]}>
        <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-850 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="mx-auto w-12 h-12 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-cyan-400">
              <Building className="h-6 w-6 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-black text-text-primary">
                {isKa ? "პროვაიდერის პროფილი არ არის" : "Register Company Profile"}
              </h1>
              <p className="text-xs text-text-muted leading-relaxed">
                {isKa 
                  ? "კომპანიის პროფილი ჯერ არ არის დარეგისტრირებული. გთხოვთ დაამატოთ თქვენი კომპანია მუშაობის დასაწყებად." 
                  : "Welcome to KavShare. To access metrics, payout integrations, and view seeker leads, configure your company details first."}
              </p>
            </div>
            <Link
              href={`/${locale}/provider/settings/profile`}
              className="block w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition text-xs"
            >
              Configure Profile
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["provider"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Welcome Card & Profile Health Info */}
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Welcome panel */}
            <div className="lg:col-span-2 relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950 border border-slate-850 p-8 rounded-3xl shadow-2xl flex flex-col justify-between gap-6">
              <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="z-10 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                    company.status === "active" 
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                      : "bg-slate-850 text-text-secondary"
                  }`}>
                    {company.status === "active" ? (isKa ? "ვერიფიცირებული" : "Verified Partner") : company.status}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-text-muted tracking-widest flex items-center gap-1 font-mono">
                    <Building className="h-3 w-3" />
                    ID: {company.id.substring(0, 8)}
                  </span>
                </div>
                
                <h1 className="text-3xl font-black tracking-tight mt-1 text-text-primary">
                  {company.name}
                </h1>
                <p className="text-xs text-text-secondary max-w-lg leading-relaxed">
                  {isKa 
                    ? "მართეთ თქვენი შეთავაზებები, აკონტროლეთ საკომისიოები და იხილეთ შემოსული განაცხადები რეალურ დროში." 
                    : "Track ongoing contracts, submit Wise payout commission schedules, and verify verification status."}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2.5 z-10">
                <Link
                  href={`/${locale}/provider/settings/profile`}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition text-[10px]"
                >
                  Update Profile
                </Link>
                <Link
                  href={`/${locale}/provider/leads`}
                  className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-4 py-2 rounded-xl transition text-[10px]"
                >
                  View Leads
                </Link>
                <Link
                  href={`/${locale}/provider/commissions`}
                  className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-4 py-2 rounded-xl transition text-[10px]"
                >
                  Check Earnings
                </Link>
              </div>
            </div>

            {/* Profile Health Panel */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl shadow-xl flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-text-muted uppercase font-bold tracking-widest font-mono">
                  <span>Profile Strength</span>
                  <span className="text-cyan-400 font-extrabold">{profileHealth.percentage}%</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900 mt-2">
                  <div 
                    className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${profileHealth.percentage}%` }}
                  />
                </div>
              </div>

              {profileHealth.percentage < 100 ? (
                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-bold text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Missing Profile Details
                  </span>
                  <ul className="text-[10px] text-text-muted list-disc list-inside space-y-1">
                    {profileHealth.missingFields.slice(0, 3).map((field, i) => (
                      <li key={i}>{field}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-emerald-400 font-bold">
                    All metrics optimized! Seeker view potential is active.
                  </span>
                </div>
              )}

              <Link
                href={`/${locale}/provider/settings/profile`}
                className="w-full text-center bg-slate-950 hover:bg-slate-850 text-text-secondary hover:text-text-primary border border-slate-850/80 py-2 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1"
              >
                Add Testimonials / Case studies
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            {/* Stat 1 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Eye className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "პროფილის ნახვები" : "Profile Views"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {metrics.profileViews}
              </p>
            </div>

            {/* Stat 2 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "აქტიური მოთხოვნები" : "Active Leads"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {metrics.activeLeads}
              </p>
            </div>

            {/* Stat 3 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "აქტიური ხელშეკრულებები" : "Active Contracts"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {metrics.activeContracts}
              </p>
            </div>

            {/* Stat 4 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-amber-500/10 rounded-xl w-fit text-amber-400">
                <Percent className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "პლატფორმის საკომისიო" : "Pending Commission"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                GEL {metrics.pendingCommissions.toLocaleString()}
              </p>
            </div>

          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Column: Recent Leads / Active Contracts */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Recent Leads / Matches */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                      {isKa ? "შესაბამისი მოთხოვნები" : "Recent Compatible Leads"}
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      {isKa ? "აქტიური მოთხოვნები პლატფორმაზე" : "Solicitations matching your service capabilities."}
                    </p>
                  </div>
                  <Link 
                    href={`/${locale}/provider/leads`}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-0.5"
                  >
                    {isKa ? "ყველას ნახვა" : "View All Leads"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {recentLeads.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    {isKa ? "მოთხოვნები არ არის" : "No active leads available currently."}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-slate-950/40 border border-slate-850/80 hover:border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4 transition text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-text-primary">
                              {lead.title}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                              lead.status === "New"
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                : "bg-slate-850 text-text-secondary"
                            }`}>
                              {lead.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono uppercase">
                            <span>Client: {lead.client}</span>
                            {lead.budget && (
                              <span className="text-emerald-400">Budget: GEL {Number(lead.budget).toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="bg-slate-900 hover:bg-slate-800 text-text-primary p-2 border border-slate-800 rounded-xl transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Contracts */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                    {isKa ? "მიმდინარე ხელშეკრულებები" : "Ongoing Service Contracts"}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {isKa ? "აქტიური საკონტრაქტო შეთანხმებები" : "Bound service agreements and billing limits."}
                  </p>
                </div>

                {activeContracts.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    {isKa ? "კონტრაქტები არ მოიძებნა" : "No active agreements registered."}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeContracts.map((contract) => {
                      const isRenewalSoon = (() => {
                        if (!contract.end_date) return false;
                        const diffTime = new Date(contract.end_date).getTime() - new Date().getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays > 0 && diffDays <= 30;
                      })();

                      return (
                        <div
                          key={contract.id}
                          className="bg-slate-950/60 border border-slate-850/80 p-4.5 rounded-2xl space-y-3.5 flex flex-col justify-between hover:border-slate-800 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400">
                                {contract.contract_type || "SLA AGREEMENT"}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[7px] font-extrabold uppercase ${
                                isRenewalSoon 
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              }`}>
                                {isRenewalSoon ? "Renewal Soon" : "Active"}
                              </span>
                            </div>

                            <h4 className="font-extrabold text-text-primary text-xs mt-1">
                              {contract.clientName}
                            </h4>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-900 pt-2.5 text-[11px]">
                            <span className="text-text-secondary">Monthly Rate:</span>
                            <span className="font-mono text-text-primary font-bold">
                              GEL {Number(contract.monthly_value).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Earnings Summary */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Earnings summary visual and Payout action */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                    {isKa ? "ფინანსური მიმოხილვა" : "Earnings & Payouts"}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {isKa ? "თქვენი შემოსავლები და საკომისიო" : "Net revenue distributions and settlement schedules."}
                  </p>
                </div>

                {/* Earnings SVG Chart */}
                <div className="h-28 w-full relative flex items-end justify-center pt-4">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="earnGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 35 L 25 32 L 50 20 L 75 14 L 100 8 L 100 40 L 0 40 Z"
                      fill="url(#earnGradient)"
                    />
                    <path
                      d="M 0 35 L 25 32 L 50 20 L 75 14 L 100 8"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="1.5"
                    />
                    <circle cx="50" cy="20" r="1.5" fill="#22c55e" />
                    <circle cx="75" cy="14" r="1.5" fill="#22c55e" />
                    <circle cx="100" cy="8" r="2" fill="#22c55e" />
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-4 text-xs font-mono">
                  <div>
                    <span className="text-[9px] uppercase text-text-secondary block">Earned Net</span>
                    <strong className="text-emerald-400 text-sm">GEL {earningsSummary.earnedThisMonth.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-text-secondary block">Gross Value</span>
                    <strong className="text-text-primary text-sm">GEL {earningsSummary.pendingEarnings.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Wise payout redirect */}
                <Link
                  href={`/${locale}/provider/settings/bank-details`}
                  className="w-full text-center bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="h-4 w-4" />
                  {isKa ? "ბანკის დეტალები" : "Process Wise Settlement"}
                </Link>
              </div>

              {/* Payout History Preview */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                    {isKa ? "გადახდების ისტორია" : "Settlement Audits"}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {isKa ? "ბოლო გადარიცხვები" : "Archived payments matching commission logs."}
                  </p>
                </div>

                {earningsSummary.payoutHistory.length === 0 ? (
                  <div className="text-center py-6 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-[10px]">
                    {isKa ? "გადახდები არ ფიქსირდება" : "No settlement history log."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {earningsSummary.payoutHistory.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-[11px]"
                      >
                        <div className="space-y-0.5">
                          <span className="block font-bold text-text-primary font-mono">
                            GEL {p.amount.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-text-muted flex items-center gap-0.5 font-mono">
                            <Clock className="h-3 w-3" />
                            {new Date(p.date).toLocaleDateString()}
                          </span>
                        </div>

                        <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* LEAD DETAILS POPUP MODAL */}
          {selectedLead && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-lg w-full rounded-3xl p-6 relative space-y-5 shadow-2xl">
                <button
                  onClick={() => setSelectedLead(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div>
                  <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    Lead Posted: {new Date(selectedLead.date).toLocaleDateString()}
                  </span>
                  <h3 className="text-lg font-black text-text-primary mt-1 tracking-tight">
                    {selectedLead.title}
                  </h3>
                  <div className="flex items-center gap-2.5 mt-2 flex-wrap text-[10px]">
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-text-secondary">
                      Urgency: <strong className="text-cyan-400 uppercase">{selectedLead.urgency}</strong>
                    </span>
                    {selectedLead.budget && (
                      <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-emerald-400">
                        Value: GEL {Number(selectedLead.budget).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <h4 className="font-bold text-text-primary uppercase tracking-widest text-[9px]">Solicitation Scope</h4>
                  <p className="text-text-secondary leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60 whitespace-pre-wrap">
                    {selectedLead.description}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 text-xs">
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="bg-slate-950 hover:bg-slate-850 text-text-muted hover:text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                  >
                    Decline Lead
                  </button>
                  <Link
                    href={`/${locale}/provider/leads`}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition text-center"
                  >
                    Reply to Lead
                  </Link>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}

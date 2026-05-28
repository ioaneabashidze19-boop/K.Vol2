"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import { 
  Plus, 
  Search, 
  FileText, 
  TrendingUp, 
  Briefcase, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  ChevronRight, 
  Star, 
  Bell, 
  Loader2, 
  ArrowRight,
  Sparkles
} from "lucide-react";

interface SeekerDashboardProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function SeekerDashboard({ params }: SeekerDashboardProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  const [displayName, setDisplayName] = useState("");

  // Statistics
  const [metrics, setMetrics] = useState({
    activeRequests: 0,
    matchedProviders: 0,
    activeContracts: 0,
    monthlySpend: 0,
  });

  // Data lists
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [activeEngagements, setActiveEngagements] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadDashboardData() {
      if (!user) return;
      try {
        setLoading(true);
        setDisplayName(user.firstName || user.username || "Client");

        // 1. Fetch user mapping
        const { data: dbUser, error: uErr } = await supabase
          .from("users")
          .select("id, name")
          .eq("clerk_id", user.id)
          .single();

        if (uErr || !dbUser) {
          console.warn("DB user not found. Creating fallback name.");
          setLoading(false);
          return;
        }

        if (dbUser.name) setDisplayName(dbUser.name);

        // 2. Fetch seeker profile details
        const { data: seeker, error: sErr } = await supabase
          .from("seekers")
          .select("id, company_name")
          .eq("user_id", dbUser.id)
          .single();

        if (sErr || !seeker) {
          console.error("Seeker profile not found:", sErr);
          setLoading(false);
          return;
        }



        // 3. Fetch Seeker Dashboard statistics
        // Metrics 1: Active Requests count
        const { count: activeReqCount } = await supabase
          .from("procurement_posts")
          .select("*", { count: "exact", head: true })
          .eq("seeker_id", seeker.id)
          .eq("status", "active");

        // Metrics 2: Total Active Providers
        const { count: activeProvCount } = await supabase
          .from("companies")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");

        // Metrics 3: Active Engagements
        const { data: engs, count: activeEngCount } = await supabase
          .from("engagements")
          .select("id, company_id, status, engagement_type, companies(name, logo_url)")
          .eq("seeker_id", seeker.id)
          .eq("status", "active");

        const activeEngs = engs || [];

        // Metrics 4: Total Spend This Month
        const engIds = activeEngs.map((e) => e.id);
        let monthlySpendSum = 0;
        let activeContractsList: any[] = [];

        if (engIds.length > 0) {
          const { data: contracts } = await supabase
            .from("contracts")
            .select("id, engagement_id, monthly_value, end_date, status")
            .in("engagement_id", engIds)
            .eq("status", "active");

          if (contracts) {
            monthlySpendSum = contracts.reduce((acc, c) => acc + Number(c.monthly_value), 0);
            
            // Map contract details with engagement information
            activeContractsList = contracts.map((c) => {
              const eng = activeEngs.find((e) => e.id === c.engagement_id);
              return {
                contractId: c.id,
                companyName: (eng as any)?.companies?.name || "Provider Company",
                status: c.status,
                monthlyCost: Number(c.monthly_value),
                endDate: c.end_date,
              };
            });
          }
        }

        setMetrics({
          activeRequests: activeReqCount || 0,
          matchedProviders: activeProvCount || 0,
          activeContracts: activeEngCount || 0,
          monthlySpend: monthlySpendSum,
        });

        setActiveEngagements(activeContractsList);

        // 4. Fetch top 5 recent requests
        const { data: reqs } = await supabase
          .from("procurement_posts")
          .select("id, title, status, budget, created_at")
          .eq("seeker_id", seeker.id)
          .order("created_at", { ascending: false })
          .limit(5);

        // Simulate match counts for visual balance
        const processedRequests = (reqs || []).map((r, index) => ({
          ...r,
          matchesCount: Math.max(3, 8 - index),
        }));

        setRecentRequests(processedRequests);

        // 5. Gather Alerts / Next Steps
        const alertList = [];
        
        // Match updates alerts
        if (activeReqCount && activeReqCount > 0) {
          alertList.push({
            id: "new_matches",
            type: "matches",
            title: isKa ? "ახალი შესატყვისები" : "New Matches Found",
            desc: isKa 
              ? `თქვენს აქტიურ მოთხოვნებზე ნაპოვნია ${activeProvCount} პოტენციური პარტნიორი.` 
              : `Found new compatible service providers matching your active requests.`,
            actionLink: `/${locale}/seeker/requests`,
          });
        }

        // Check if there are any completed engagements awaiting review
        const { data: completedEngs } = await supabase
          .from("engagements")
          .select("id, company_id, companies(name)")
          .eq("seeker_id", seeker.id)
          .eq("status", "completed");

        if (completedEngs && completedEngs.length > 0) {
          completedEngs.forEach((e) => {
            alertList.push({
              id: `review_${e.id}`,
              type: "review",
              title: isKa ? "დატოვეთ შეფასება" : "Pending Client Review",
              desc: isKa 
                ? `დატოვეთ შეფასება ${(e as any).companies?.name}-სთვის შესრულებულ პროექტზე.` 
                : `Submit a review for ${(e as any).companies?.name} to close out transaction history.`,
              actionLink: `/${locale}/seeker/reviews/new?companyId=${e.company_id}`,
            });
          });
        }

        // Renewals alerts simulation
        if (activeContractsList.length > 0) {
          const soonRenewal = activeContractsList.find((c) => c.endDate);
          if (soonRenewal) {
            alertList.push({
              id: `renewal_${soonRenewal.contractId}`,
              type: "renewal",
              title: isKa ? "კონტრაქტის განახლება" : "Contract Renewal Coming Up",
              desc: isKa 
                ? `კონტრაქტი ${soonRenewal.companyName}-თან სრულდება ${new Date(soonRenewal.endDate).toLocaleDateString()}.` 
                : `Your agreement with ${soonRenewal.companyName} concludes on ${new Date(soonRenewal.endDate).toLocaleDateString()}.`,
              actionLink: `/${locale}/seeker/contracts`,
            });
          }
        }

        setAlerts(alertList);

      } catch (err) {
        console.error("Dashboard processing failed:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [isLoaded, user, locale, isKa]);

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "პორტალი იტვირთება..." : "Loading dashboard portals..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["seeker"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Welcome Card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950 border border-slate-850 p-8 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
            <div className="z-10 space-y-2">
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {isKa ? "საკონსულტაციო პორტალი" : "Client Workspace"}
              </span>
              <h1 className="text-3xl font-black tracking-tight">
                {isKa ? `გამარჯობა, ${displayName}` : `Welcome back, ${displayName}`}
              </h1>
              <p className="text-xs text-text-secondary max-w-lg leading-relaxed">
                {isKa 
                  ? "მართეთ თქვენი მოთხოვნები, თვალი ადევნეთ აქტიურ კონტრაქტებს და იპოვეთ საუკეთესო პროვაიდერები." 
                  : "Manage your active solicitations, track service levels, and evaluate candidate responses in real-time."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 z-10 w-full md:w-auto">
              <Link
                href={`/${locale}/seeker/new-request`}
                className="flex-1 md:flex-none bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {isKa ? "ახალი მოთხოვნა" : "Create Request"}
              </Link>
              <Link
                href={`/${locale}/marketplace`}
                className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-text-primary font-bold px-5 py-2.5 rounded-xl border border-slate-800 transition text-xs flex items-center justify-center gap-1.5"
              >
                <Search className="h-4 w-4" />
                {isKa ? "პროვაიდერები" : "Browse Providers"}
              </Link>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            {/* Stat 1 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "აქტიური მოთხოვნები" : "Active Requests"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {metrics.activeRequests}
              </p>
            </div>

            {/* Stat 2 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "შესატყვისი კომპანიები" : "Available Providers"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {metrics.matchedProviders}
              </p>
            </div>

            {/* Stat 3 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Briefcase className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "აქტიური კონტრაქტები" : "Active Contracts"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {metrics.activeContracts}
              </p>
            </div>

            {/* Stat 4 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 relative group hover:border-slate-800 transition shadow-lg">
              <div className="p-2 bg-emerald-500/10 rounded-xl w-fit text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "მიმდინარე ხარჯი" : "Monthly Spend"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                GEL {metrics.monthlySpend.toLocaleString()}
              </p>
            </div>

          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Column: Recent Requests & Engagements */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Recent Requests Section */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                      {isKa ? "ბოლო მოთხოვნები" : "Recent Service Requests"}
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      {isKa ? "ბოლოს გამოქვეყნებული მოთხოვნების სია" : "Latest procurement postings and activity status."}
                    </p>
                  </div>
                  <Link 
                    href={`/${locale}/seeker/requests`}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-0.5"
                  >
                    {isKa ? "ყველას ნახვა" : "View All"}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                {recentRequests.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    {isKa ? "მოთხოვნები არ არის" : "You have not published any service requests yet."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-900 text-text-secondary uppercase text-[9px] tracking-wider">
                          <th className="pb-3">{isKa ? "დასახელება" : "Title"}</th>
                          <th className="pb-3">{isKa ? "სტატუსი" : "Status"}</th>
                          <th className="pb-3 text-right">{isKa ? "პარტნიორები" : "Matches"}</th>
                          <th className="pb-3 text-right">{isKa ? "თარიღი" : "Posted Date"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRequests.map((req) => (
                          <tr key={req.id} className="border-b border-slate-900/60 hover:bg-slate-900/10 transition">
                            <td className="py-3 font-semibold text-text-primary">{req.title}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                req.status === "active" 
                                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                                  : "bg-slate-800/50 text-text-muted"
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono text-cyan-400 font-bold">{req.matchesCount}</td>
                            <td className="py-3 text-right text-text-muted">{new Date(req.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Active Engagements Card List */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">
                    {isKa ? "აქტიური შეთანხმებები" : "Active Service Engagements"}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {isKa ? "მიმდინარე კონტრაქტების დეტალური სია" : "Ongoing support contracts and SLAs."}
                  </p>
                </div>

                {activeEngagements.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    {isKa ? "აქტიური კონტრაქტები არ არის" : "No active business engagements."}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeEngagements.map((eng) => (
                      <div 
                        key={eng.contractId} 
                        className="bg-slate-950/60 border border-slate-850/80 p-5 rounded-2xl space-y-4 flex flex-col justify-between hover:border-slate-800 transition"
                      >
                        <div className="space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400">
                            {isKa ? "აქტიური ხელშეკრულება" : "Agreement Active"}
                          </span>
                          <h4 className="font-extrabold text-text-primary text-sm">
                            {eng.companyName}
                          </h4>
                          <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2">
                            <span>{isKa ? "ყოველთვიური:" : "Monthly rate:"}</span>
                            <span className="font-mono text-text-primary font-bold">GEL {eng.monthlyCost.toLocaleString()}</span>
                          </div>
                          {eng.endDate && (
                            <div className="flex items-center justify-between text-[11px] text-text-secondary">
                              <span>{isKa ? "დასრულება:" : "Expiration Date:"}</span>
                              <span className="text-text-muted font-bold">{new Date(eng.endDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/${locale}/seeker/contracts`}
                          className="w-full text-center bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold py-2 rounded-xl text-[10px] transition flex items-center justify-center gap-1"
                        >
                          {isKa ? "დეტალები" : "View Details"}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Next Steps / Alerts */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Performance visualization card / SVG Chart */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                    {isKa ? "ბიუჯეტის განაწილება" : "SLA & Cost Trends"}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {isKa ? "ხარჯები ბოლო თვეების მიხედვით" : "Spend evaluation chart per calendar cycle."}
                  </p>
                </div>

                {/* Styled SVG Trend Line Chart */}
                <div className="h-36 w-full relative flex items-end justify-center pt-6">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="0" y1="10" x2="100" y2="10" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />
                    <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />
                    
                    {/* Fill Area */}
                    <path
                      d="M 0 35 L 20 30 L 40 28 L 60 18 L 80 15 L 100 12 L 100 40 L 0 40 Z"
                      fill="url(#chartGradient)"
                    />
                    
                    {/* Glow and Stroke */}
                    <path
                      d="M 0 35 L 20 30 L 40 28 L 60 18 L 80 15 L 100 12"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                    />
                    
                    {/* Data Points */}
                    <circle cx="20" cy="30" r="1.5" fill="#06b6d4" />
                    <circle cx="40" cy="28" r="1.5" fill="#06b6d4" />
                    <circle cx="60" cy="18" r="1.5" fill="#06b6d4" />
                    <circle cx="80" cy="15" r="1.5" fill="#06b6d4" />
                    <circle cx="100" cy="12" r="2" fill="#22c55e" />
                  </svg>
                  
                  {/* Labels */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] text-emerald-400 font-bold bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                    +15% {isKa ? "ზრდა" : "growth"}
                  </div>
                </div>

                <div className="flex justify-between text-[8px] text-text-muted uppercase font-mono">
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>{isKa ? "მიმდინარე" : "Current"}</span>
                </div>
              </div>

              {/* Next Steps / Alerts Section */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-cyan-400" />
                    {isKa ? "ყურადღებასაცემი საკითხები" : "Critical Next Steps"}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {isKa ? "საკითხები, რომლებიც საჭიროებენ თქვენს რეაგირებას" : "Action items requiring immediate resolution."}
                  </p>
                </div>

                {alerts.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    {isKa ? "ახალი შეტყობინებები არ არის" : "All cleared! No pending action items."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-2.5 transition hover:border-slate-800"
                      >
                        <div className="flex items-start gap-2 text-xs">
                          {alert.type === "review" ? (
                            <Star className="h-4 w-4 text-amber-400 shrink-0 mt-0.5 fill-amber-400" />
                          ) : alert.type === "renewal" ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <h4 className="font-extrabold text-text-primary text-[11px] leading-tight">
                              {alert.title}
                            </h4>
                            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                              {alert.desc}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={alert.actionLink}
                          className="w-full text-center bg-slate-900 hover:bg-slate-800 text-cyan-400 font-bold py-1.5 rounded-lg text-[9px] transition flex items-center justify-center gap-0.5"
                        >
                          {isKa ? "გადასვლა" : "Take Action"}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
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

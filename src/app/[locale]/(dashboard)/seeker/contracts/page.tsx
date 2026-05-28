"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  FileText,
  Briefcase,
  Users,
  DollarSign,
  Star,
  Loader2,
  X,
  Search,
  SlidersHorizontal,
  Download,
  MessageSquare,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

interface SeekerContractsProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function SeekerContractsPage({ params }: SeekerContractsProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Seeker info
  const [seekerId, setSeekerId] = useState<string | null>(null);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  // Contracts data
  const [contracts, setContracts] = useState<any[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters / Search / Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"value_desc" | "date_desc" | "date_asc">("date_desc");

  // Modal State
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingVal, setRatingVal] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [hasReviewed, setHasReviewed] = useState(false);

  // Load Seeker profile
  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadSeekerContracts() {
      if (!user) return;
      try {
        setLoading(true);

        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!dbUser) {
          setLoading(false);
          return;
        }

        setDbUserId(dbUser.id);

        const { data: seeker } = await supabase
          .from("seekers")
          .select("id")
          .eq("user_id", dbUser.id)
          .single();

        if (!seeker) {
          setLoading(false);
          return;
        }

        setSeekerId(seeker.id);
        await fetchContracts(seeker.id);
      } catch (err) {
        console.error("Failed to load contracts details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSeekerContracts();
  }, [isLoaded, user]);

  // Fetch contracts
  async function fetchContracts(seekerUuid: string) {
    // 1. Fetch engagements
    const { data: engagements } = await supabase
      .from("engagements")
      .select("id, company_id, status, engagement_type, companies(id, name, logo_url, rating)")
      .eq("seeker_id", seekerUuid);

    const engs = engagements || [];
    if (engs.length === 0) {
      setContracts([]);
      return;
    }

    const engIds = engs.map((e) => e.id);

    // 2. Fetch contracts
    const { data: contractsList } = await supabase
      .from("contracts")
      .select("*")
      .in("engagement_id", engIds);

    const mapped = (contractsList || []).map((c) => {
      const eng = engs.find((e) => e.id === c.engagement_id);
      return {
        ...c,
        engagement: eng,
      };
    });

    setContracts(mapped);
  }

  // Filter & Search Calculations
  useEffect(() => {
    let result = [...contracts];

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "renewal_soon") {
        result = result.filter((c) => {
          if (c.status !== "active" || !c.end_date) return false;
          const diffTime = new Date(c.end_date).getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays > 0 && diffDays <= 30;
        });
      } else {
        result = result.filter((c) => c.status === statusFilter);
      }
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((c) => c.contract_type === categoryFilter);
    }

    // Search query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => 
        c.engagement?.companies?.name?.toLowerCase().includes(q) ||
        (c.contract_type || "").toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortBy === "value_desc") {
      result.sort((a, b) => Number(b.monthly_value || 0) - Number(a.monthly_value || 0));
    } else if (sortBy === "date_desc") {
      result.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    } else if (sortBy === "date_asc") {
      result.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    }

    setFilteredContracts(result);
  }, [contracts, searchQuery, statusFilter, categoryFilter, sortBy]);

  // Statistics calculation
  const totalMonthlySpend = filteredContracts
    .filter((c) => c.status === "active")
    .reduce((acc, c) => acc + Number(c.monthly_value || 0), 0);

  const activeCount = filteredContracts.filter((c) => c.status === "active").length;

  const renewalSoonCount = filteredContracts.filter((c) => {
    if (c.status !== "active" || !c.end_date) return false;
    const diffTime = new Date(c.end_date).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 30;
  }).length;

  const totalProvidersEngaged = new Set(
    filteredContracts
      .map((c) => c.engagement?.companies?.id)
      .filter(Boolean)
  ).size;

  // View detail handler
  const handleOpenDetails = async (contract: any) => {
    setSelectedContract(contract);
    setRatingComment("");
    setRatingVal(5);
    setHasReviewed(false);

    if (contract.engagement?.id) {
      // Check if user already reviewed this engagement
      const { data: rev } = await supabase
        .from("reviews")
        .select("id, rating, comment")
        .eq("engagement_id", contract.engagement.id)
        .maybeSingle();

      if (rev) {
        setHasReviewed(true);
        setRatingVal(rev.rating);
        setRatingComment(rev.comment || "");
      }
    }
  };

  // Rate provider / Add review
  const handleRateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !dbUserId) return;

    // Check if engagement status is completed
    if (selectedContract.engagement?.status !== "completed") {
      alert(isKa 
        ? "შეფასების დატოვება შესაძლებელია მხოლოდ დასრულებულ შეთანხმებებზე." 
        : "Ratings and reviews can only be submitted for completed engagements."
      );
      return;
    }

    setSubmittingRating(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .insert({
          engagement_id: selectedContract.engagement.id,
          reviewer_id: dbUserId,
          rating: ratingVal,
          comment: ratingComment.trim() || null
        });

      if (error) throw error;

      alert(isKa ? "შეფასება წარმატებით გაიგზავნა!" : "Rating successfully submitted!");
      setHasReviewed(true);
    } catch (err: any) {
      alert("Error rating provider: " + err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  // Cancel contract action
  const handleCancelContract = async (contractId: string, engId: string) => {
    if (!seekerId) return;
    const confirmCancel = confirm(
      isKa ? "ნამდვილად გსურთ ხელშეკრულების გაუქმება?" : "Are you sure you want to terminate this contract?"
    );
    if (!confirmCancel) return;

    try {
      // Update contract state to cancelled
      await supabase
        .from("contracts")
        .update({ status: "cancelled" })
        .eq("id", contractId);

      // Update engagement state to cancelled
      await supabase
        .from("engagements")
        .update({ status: "cancelled" })
        .eq("id", engId);

      alert(isKa ? "ხელშეკრულება გაუქმდა" : "Contract terminated successfully.");
      setSelectedContract(null);
      await fetchContracts(seekerId);
    } catch (err: any) {
      alert("Termination failed: " + err.message);
    }
  };

  // Export to PDF
  const triggerPdfExport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rows = filteredContracts.map((c) => `
      <tr>
        <td>${c.engagement?.companies?.name || "Provider"}</td>
        <td>${c.contract_type || "N/A"}</td>
        <td>GEL ${Number(c.monthly_value).toLocaleString()}</td>
        <td>${new Date(c.start_date).toLocaleDateString()}</td>
        <td>${c.end_date ? new Date(c.end_date).toLocaleDateString() : "Ongoing"}</td>
        <td>${c.status}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <html>
        <head>
          <title>KavShare - Seeker Active Contracts Summary</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #333; padding: 40px; }
            .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #06b6d4; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { border-bottom: 2px solid #ddd; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #666; }
            td { border-bottom: 1px solid #eee; padding: 12px 10px; font-size: 12px; }
            .stats { display: flex; gap: 40px; margin-bottom: 30px; }
            .stat-box { background: #f9f9f9; padding: 15px; border-radius: 8px; flex: 1; }
            .stat-val { font-size: 20px; font-weight: bold; color: #06b6d4; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">KavShare</div>
            <p>Active Contracts Audit Summary</p>
          </div>

          <div class="stats">
            <div class="stat-box">
              <div>Total Monthly Spend</div>
              <div class="stat-val">GEL ${totalMonthlySpend.toLocaleString()}</div>
            </div>
            <div class="stat-box">
              <div>Active Agreements</div>
              <div class="stat-val">${activeCount}</div>
            </div>
            <div class="stat-box">
              <div>Providers Engaged</div>
              <div class="stat-val">${totalProvidersEngaged}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Category</th>
                <th>Monthly Rate</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
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
            {isKa ? "ხელშეკრულებები იტვირთება..." : "Loading active contracts..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["seeker"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-6">
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isKa ? "ხელშეკრულებების მართვა" : "SLA & Contracts Hub"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "აქტიური ხელშეკრულებები" : "Active Contracts"}
              </h1>
              <p className="text-xs text-text-muted mt-1">
                {isKa 
                  ? "აკონტროლეთ თქვენი აქტიური ხელშეკრულებების პირობები, ხარჯები და გადახდების ისტორია." 
                  : "Track ongoing contract values, monthly payouts, renewal schedules, and provide rating feedback."}
              </p>
            </div>

            <button
              onClick={triggerPdfExport}
              className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5 self-stretch md:self-auto justify-center"
            >
              <Download className="h-4 w-4" />
              {isKa ? "PDF ექსპორტი" : "Export to PDF"}
            </button>
          </div>

          {/* Stats Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            
            {/* Stat 1 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 shadow-lg">
              <div className="p-2 bg-emerald-500/10 rounded-xl w-fit text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "თვიური ხარჯი" : "Total Monthly Spend"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                GEL {totalMonthlySpend.toLocaleString()}
              </p>
            </div>

            {/* Stat 2 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Briefcase className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "აქტიური ხელშეკრულებები" : "Active Contracts"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {activeCount}
              </p>
            </div>

            {/* Stat 3 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 shadow-lg">
              <div className="p-2 bg-amber-500/10 rounded-xl w-fit text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "განახლებები მალე" : "Upcoming Renewals"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {renewalSoonCount}
              </p>
            </div>

            {/* Stat 4 */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl space-y-2 shadow-lg">
              <div className="p-2 bg-cyan-500/10 rounded-xl w-fit text-cyan-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {isKa ? "პროვაიდერები" : "Total Providers"}
              </p>
              <p className="text-2xl font-black text-text-primary tracking-tight">
                {totalProvidersEngaged}
              </p>
            </div>

          </div>

          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder={isKa ? "ძებნა პროვაიდერით..." : "Search by provider or category..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition"
                />
              </div>

              {/* Status filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[140px]"
                >
                  <option value="all">{isKa ? "ყველა სტატუსი" : "All Statuses"}</option>
                  <option value="active">{isKa ? "აქტიური" : "Active"}</option>
                  <option value="renewal_soon">{isKa ? "განახლებადი მალე" : "Renewal Soon"}</option>
                  <option value="completed">{isKa ? "დასრულებული" : "Completed"}</option>
                  <option value="cancelled">{isKa ? "გაუქმებული" : "Cancelled"}</option>
                </select>
                <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
              </div>

              {/* Category filter */}
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[140px]"
                >
                  <option value="all">{isKa ? "ყველა კატეგორია" : "All Categories"}</option>
                  <option value="fixed-price">{isKa ? "ფიქსირებული" : "Fixed-price"}</option>
                  <option value="hourly">{isKa ? "საათობრივი" : "Hourly"}</option>
                  <option value="subscription">{isKa ? "საბონენტო" : "Subscription"}</option>
                  <option value="retained">{isKa ? "რეტეინერი" : "Retained"}</option>
                </select>
                <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
              </div>
            </div>

            {/* Sort options */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[150px] w-full md:w-auto"
              >
                <option value="date_desc">{isKa ? "ახალი ხელშეკრულებები" : "Sort: Newest"}</option>
                <option value="date_asc">{isKa ? "ძველი ხელშეკრულებები" : "Sort: Oldest"}</option>
                <option value="value_desc">{isKa ? "უმაღლესი ღირებულება" : "Sort: Value"}</option>
              </select>
              <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>

          </div>

          {/* Contracts List Display */}
          {filteredContracts.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/10 border border-slate-850 rounded-3xl p-8 space-y-4">
              <div className="mx-auto w-12 h-12 bg-slate-900 border border-slate-850 rounded-2xl flex items-center justify-center text-text-muted">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  {isKa ? "კონტრაქტები არ მოიძებნა" : "No contracts found"}
                </h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  {isKa 
                    ? "თქვენ არ გაქვთ აქტიური ხელშეკრულებები შესაბამის კატეგორიაში." 
                    : "No contracts matching your filter parameters are registered."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredContracts.map((c) => {
                const isRenewalSoon = (() => {
                  if (c.status !== "active" || !c.end_date) return false;
                  const diffTime = new Date(c.end_date).getTime() - new Date().getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays > 0 && diffDays <= 30;
                })();

                return (
                  <div
                    key={c.id}
                    className="bg-slate-900/20 border border-slate-850/80 p-5 rounded-2xl flex flex-col justify-between gap-4 transition hover:border-slate-800 shadow-md"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400">
                            {c.contract_type || "SLA AGREEMENT"}
                          </span>
                          <h4 className="font-extrabold text-text-primary text-sm mt-0.5">
                            {c.engagement?.companies?.name || "Provider Company"}
                          </h4>
                        </div>
                        
                        {/* Status badge */}
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          isRenewalSoon
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : c.status === "active"
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            : c.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-text-muted"
                        }`}>
                          {isRenewalSoon ? "Renewal Soon" : c.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 pt-2 border-t border-slate-900 text-[11px] text-text-secondary">
                        <div>
                          <span>Start Date</span>
                          <strong className="block text-text-primary font-mono">{new Date(c.start_date).toLocaleDateString()}</strong>
                        </div>
                        <div>
                          <span>End Date</span>
                          <strong className="block text-text-primary font-mono">
                            {c.end_date ? new Date(c.end_date).toLocaleDateString() : "Ongoing"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-900 pt-3">
                      <span className="font-mono text-cyan-400 font-bold text-xs">
                        GEL {Number(c.monthly_value).toLocaleString()}/mo
                      </span>

                      <div className="flex gap-2">
                        {/* Message Provider */}
                        <Link
                          href={`/${locale}/seeker/chat`}
                          className="bg-slate-950 hover:bg-slate-850 text-text-secondary hover:text-text-primary border border-slate-850 p-2 rounded-xl transition"
                          title="Message Provider"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Link>
                        
                        {/* View Details */}
                        <button
                          onClick={() => handleOpenDetails(c)}
                          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl transition text-[10px] flex items-center gap-1"
                        >
                          {isKa ? "დეტალები" : "View Details"}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* CONTRACT DETAIL MODAL */}
          {selectedContract && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-xl w-full rounded-3xl p-6 relative space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setSelectedContract(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Modal Title */}
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400 font-mono">
                    Agreement details / {selectedContract.id.substring(0, 8)}
                  </span>
                  <h3 className="text-xl font-black text-text-primary mt-1 tracking-tight">
                    {selectedContract.engagement?.companies?.name}
                  </h3>
                  <div className="flex gap-2.5 mt-2 flex-wrap text-[10px]">
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-text-secondary">
                      Type: {selectedContract.contract_type}
                    </span>
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-emerald-400">
                      Rate: GEL {Number(selectedContract.monthly_value).toLocaleString()}
                    </span>
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-text-muted">
                      Status: {selectedContract.status}
                    </span>
                  </div>
                </div>

                {/* Commitment Info */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60 font-mono">
                  <div>
                    <span className="text-text-secondary text-[10px] uppercase font-bold">Start Date</span>
                    <strong className="block text-text-primary text-[12px] mt-0.5">
                      {new Date(selectedContract.start_date).toLocaleDateString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-text-secondary text-[10px] uppercase font-bold">End Date</span>
                    <strong className="block text-text-primary text-[12px] mt-0.5">
                      {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString() : "Ongoing Retainer"}
                    </strong>
                  </div>
                </div>

                {/* Ratings and reviews section (only if completed) */}
                {selectedContract.engagement?.status === "completed" && (
                  <div className="border-t border-slate-850 pt-4 space-y-4">
                    <h4 className="font-bold text-text-primary uppercase tracking-widest text-[9px] flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      Rate & Review Provider
                    </h4>

                    {hasReviewed ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-3 text-xs">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div>
                          <strong className="block text-text-primary">Review Submitted</strong>
                          <span className="text-text-muted mt-0.5">
                            You evaluated this provider at {ratingVal} stars with note: "{ratingComment}"
                          </span>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleRateProvider} className="space-y-3">
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                            Stars Rating
                          </label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRatingVal(star)}
                                className="p-1 hover:scale-110 transition"
                              >
                                <Star 
                                  className={`h-6 w-6 ${
                                    star <= ratingVal 
                                      ? "text-amber-400 fill-amber-400" 
                                      : "text-slate-800"
                                  }`} 
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                            Review Comments
                          </label>
                          <textarea
                            rows={3}
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="Share your experience working with this provider..."
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingRating}
                          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition text-xs flex items-center gap-1"
                        >
                          {submittingRating && <Loader2 className="h-3 w-3 animate-spin" />}
                          Submit Feedback
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Cancel/Terminate Button (Only if active) */}
                {selectedContract.status === "active" && (
                  <div className="border-t border-slate-850 pt-4 flex justify-between items-center gap-4">
                    <div>
                      <span className="text-[10px] text-text-muted leading-relaxed block max-w-sm">
                        Early termination concludes work processes and triggers cancellation logs.
                      </span>
                    </div>

                    <button
                      onClick={() => handleCancelContract(selectedContract.id, selectedContract.engagement.id)}
                      className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 font-bold px-4 py-2 rounded-xl transition text-xs shrink-0"
                    >
                      Terminate Contract
                    </button>
                  </div>
                )}

                <div className="border-t border-slate-850 pt-4 flex justify-end">
                  <button
                    onClick={() => setSelectedContract(null)}
                    className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition text-xs"
                  >
                    Close Window
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}

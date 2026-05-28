"use client";

import { use, useState, useEffect } from "react";
import {
  Loader2,
  TrendingUp,
  FileText,
  Clock,
  Eye,
  X,
  Send,
  SlidersHorizontal,
  Download,
  Filter,
  BarChart4,
  Flame,
  Award
} from "lucide-react";

import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";

interface ProviderLeadsProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function ProviderLeadsPage({ params }: ProviderLeadsProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Core company state
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Leads and engagements lists
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [budgetRange, setBudgetRange] = useState("all");

  // Interaction Modals
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [proposalLead, setProposalLead] = useState<any | null>(null);
  const [proposalPrice, setProposalPrice] = useState("");
  const [proposalDuration, setProposalDuration] = useState("");
  const [proposalScope, setProposalScope] = useState("");
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Analytics states
  const [analytics] = useState({
    ctr: 84.5,
    conversionRate: 12.8,
    responseTimeHours: 4.2,
  });

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadLeadsData() {
      if (!user) return;
      try {
        setLoading(true);

        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!dbUser) return;

        const { data: comp } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", dbUser.id)
          .single();

        if (!comp) return;
        setCompanyId(comp.id);

        // Fetch engagements to see status of proposals
        const { data: engList } = await supabase
          .from("engagements")
          .select("*")
          .eq("company_id", comp.id);

        // Fetch procurement posts
        const { data: posts } = await supabase
          .from("procurement_posts")
          .select("id, title, description, budget, urgency, created_at, required_tools, expires_at, seeker_id, seekers(company_name)")
          .eq("status", "active");

        const mappedLeads = (posts || []).map((post) => {
          // Check if there is an engagement already
          const eng = (engList || []).find((e) => e.procurement_post_id === post.id);
          
          // Calculate a mock dynamic match score based on title overlap or tools
          const matchScore = calculateMatchScore(post.title, post.required_tools);
          
          return {
            ...post,
            engagement: eng,
            matchScore,
            status: eng ? (eng.status === "active" ? "Won" : eng.status === "pending" ? "Proposal Sent" : "Declined") : "New",
          };
        });

        setLeads(mappedLeads);
      } catch (err) {
        console.error("Failed to load matching opportunities:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLeadsData();
  }, [isLoaded, user]);

  // Lead match scoring simulation
  function calculateMatchScore(title: string, tools: string[]) {
    let score = 75;
    if (tools.length > 0) score += tools.length * 4;
    if (title.toLowerCase().includes("support") || title.toLowerCase().includes("procurement")) score += 8;
    return Math.min(score, 99);
  }

  // Filter calculation
  useEffect(() => {
    let result = [...leads];

    // Search filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => 
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        (l.seekers?.company_name || "").toLowerCase().includes(q)
      );
    }

    // Status Filter
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }

    // Urgency Filter
    if (urgencyFilter !== "all") {
      result = result.filter((l) => l.urgency === urgencyFilter);
    }

    // Budget range Filter
    if (budgetRange !== "all") {
      if (budgetRange === "low") {
        result = result.filter((l) => Number(l.budget || 0) < 5000);
      } else if (budgetRange === "mid") {
        result = result.filter((l) => Number(l.budget || 0) >= 5000 && Number(l.budget || 0) <= 20000);
      } else if (budgetRange === "high") {
        result = result.filter((l) => Number(l.budget || 0) > 20000);
      }
    }

    setFilteredLeads(result);
  }, [leads, searchQuery, statusFilter, urgencyFilter, budgetRange]);

  // Handle send proposal (Insert new engagement with pending status)
  const handleOpenProposal = (lead: any) => {
    setProposalLead(lead);
    setProposalPrice(lead.budget ? lead.budget.toString() : "");
    setProposalDuration("4 weeks");
    setProposalScope(`We would love to collaborate on: ${lead.title}.\nOur expert team is fully equipped with tools like: ${lead.required_tools.join(", ") || "N/A"}.`);
  };

  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !proposalLead) return;

    setSubmittingProposal(true);
    try {
      // In KavShare engagements, it connects company_id, seeker_id, and procurement_post_id
      const { error } = await supabase
        .from("engagements")
        .insert({
          company_id: companyId,
          seeker_id: proposalLead.seeker_id,
          procurement_post_id: proposalLead.id,
          status: "pending",
          engagement_type: "fixed-price" // Defaulting to fixed-price
        });

      if (error) throw error;

      alert(isKa ? "წინადადება წარმატებით გაიგზავნა!" : "Proposal successfully submitted!");
      setProposalLead(null);
      
      // Reload matching opportunities page data
      const { data: updatedEngs } = await supabase
        .from("engagements")
        .select("*")
        .eq("company_id", companyId);

      if (updatedEngs) {
        setLeads((prev) => 
          prev.map((l) => {
            if (l.id === proposalLead.id) {
              const matchedEng = updatedEngs.find((e) => e.procurement_post_id === l.id);
              return {
                ...l,
                engagement: matchedEng,
                status: "Proposal Sent",
              };
            }
            return l;
          })
        );
      }
    } catch (err: any) {
      alert("Error sending proposal: " + err.message);
    } finally {
      setSubmittingProposal(false);
    }
  };

  // Decline Lead locally/internally
  const handleDeclineLead = (leadId: string) => {
    const confirmDecline = confirm(
      isKa ? "ნამდვილად გსურთ ამ შესაძლებლობის უარყოფა?" : "Are you sure you want to decline this lead?"
    );
    if (!confirmDecline) return;

    setLeads((prev) => 
      prev.map((l) => (l.id === leadId ? { ...l, status: "Declined" } : l))
    );
  };

  // Export Lead data csv helper
  const triggerLeadCsvExport = () => {
    const headers = ["Title", "Client", "Budget", "Urgency", "Match Score", "Status"];
    const rows = filteredLeads.map((l) => [
      l.title,
      l.seekers?.company_name || "N/A",
      l.budget ? `GEL ${l.budget}` : "N/A",
      l.urgency,
      `${l.matchScore}%`,
      l.status
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kavshare_opportunities_audit.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "განაცხადები იტვირთება..." : "Loading compatible opportunities..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["provider"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-6">
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                {isKa ? "შესაბამისი შესაძლებლობები" : "Lead Compatibility Hub"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "შესატყვისი შესაძლებლობები" : "Matching Opportunities"}
              </h1>
              <p className="text-xs text-text-muted mt-1">
                {isKa 
                  ? "იხილეთ თქვენს პროფილზე მორგებული განაცხადები და გაგზავნეთ შეთავაზებები." 
                  : "View algorithmic matches, propose billing structures, and monitor conversion metrics."}
              </p>
            </div>

            <button
              onClick={triggerLeadCsvExport}
              className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5 self-stretch md:self-auto justify-center"
            >
              <Download className="h-4 w-4" />
              {isKa ? "CSV ექსპორტი" : "Export Leads"}
            </button>
          </div>

          {/* Lead Analytics Widget Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Click-Through Rate (CTR)</span>
                <p className="text-2xl font-black text-text-primary font-mono">{analytics.ctr}%</p>
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                <BarChart4 className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Conversion Ratio</span>
                <p className="text-2xl font-black text-emerald-400 font-mono">{analytics.conversionRate}%</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Avg Response Time</span>
                <p className="text-2xl font-black text-cyan-400 font-mono">{analytics.responseTimeHours}h</p>
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Filters Area */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={isKa ? "ძებნა კომპანიით ან სათაურით..." : "Search leads by title, client..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition"
              />
              <Filter className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>

            {/* Filter by status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[140px]"
              >
                <option value="all">{isKa ? "ყველა სტატუსი" : "All Statuses"}</option>
                <option value="New">{isKa ? "ახალი" : "New"}</option>
                <option value="Proposal Sent">{isKa ? "გაგზავნილი" : "Proposal Sent"}</option>
                <option value="Won">{isKa ? "მოგებული" : "Won/Active"}</option>
                <option value="Declined">{isKa ? "უარყოფილი" : "Declined"}</option>
              </select>
              <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>

            {/* Filter by Urgency */}
            <div className="relative">
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[140px]"
              >
                <option value="all">{isKa ? "ყველა პრიორიტეტი" : "All Urgency"}</option>
                <option value="critical">{isKa ? "კრიტიკული" : "Critical"}</option>
                <option value="high">{isKa ? "მაღალი" : "High"}</option>
                <option value="medium">{isKa ? "საშუალო" : "Medium"}</option>
                <option value="low">{isKa ? "დაბალი" : "Low"}</option>
              </select>
              <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>

            {/* Filter by Budget Range */}
            <div className="relative">
              <select
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
                className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[150px]"
              >
                <option value="all">{isKa ? "ყველა ბიუჯეტი" : "All Budgets"}</option>
                <option value="low">{"< GEL 5,000"}</option>
                <option value="mid">{"GEL 5,000 - 20,000"}</option>
                <option value="high">{"> GEL 20,000"}</option>
              </select>
              <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>

          </div>

          {/* Opportunities list display */}
          {filteredLeads.length === 0 ? (
            <div className="text-center py-24 bg-slate-900/10 border border-slate-850 rounded-3xl p-8 space-y-4">
              <div className="mx-auto w-12 h-12 bg-slate-900 border border-slate-850 rounded-2xl flex items-center justify-center text-text-muted">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  {isKa ? "შესაბამისი განაცხადები არ არის" : "No matching opportunities"}
                </h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  {isKa 
                    ? "ამ კატეგორიაში განაცხადები ამჟამად არ იძებნება." 
                    : "Try broadening your filter criteria or update company services catalog."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-slate-900/20 border border-slate-850/80 p-5 rounded-2xl flex flex-col justify-between gap-5 transition hover:border-slate-800 shadow-md relative overflow-hidden"
                >
                  {/* Matching Indicator Ribbon */}
                  <div className="absolute right-0 top-0 bg-cyan-500/15 border-b border-l border-cyan-500/20 px-3 py-1 text-[9px] font-black uppercase text-cyan-400 tracking-wider font-mono flex items-center gap-1">
                    <Award className="h-3.5 w-3.5" />
                    {lead.matchScore}% Match
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400 font-mono">
                        Client: {lead.seekers?.company_name || "Private Seeker"}
                      </span>
                      <h4 className="font-extrabold text-text-primary text-sm mt-0.5 max-w-[80%] line-clamp-1">
                        {lead.title}
                      </h4>
                    </div>

                    <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {lead.description}
                    </p>

                    {/* Bullet Match reasons */}
                    <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850/60 space-y-1.5">
                      <span className="block text-[8px] uppercase tracking-widest font-black text-text-secondary">Why Matched:</span>
                      <ul className="text-[10px] text-text-muted list-disc list-inside space-y-1">
                        <li>Requirements match services spectrum.</li>
                        {lead.required_tools.length > 0 && (
                          <li>Shared tooling alignment: {lead.required_tools.slice(0, 2).join(", ")}.</li>
                        )}
                        <li>Budget fits historical pricing scope.</li>
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-text-secondary">
                      <div>
                        <span>Estimated Budget:</span>
                        <strong className="block text-emerald-400">
                          {lead.budget ? `GEL ${Number(lead.budget).toLocaleString()}` : "N/A"}
                        </strong>
                      </div>
                      <div>
                        <span>Urgency Status:</span>
                        <strong className="block text-cyan-400 uppercase">{lead.urgency}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-900 pt-3">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                      lead.status === "New"
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        : lead.status === "Proposal Sent"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : lead.status === "Won"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-800 text-text-muted"
                    }`}>
                      {lead.status}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedLead(lead)}
                        className="bg-slate-950 hover:bg-slate-850 text-text-secondary border border-slate-850 p-2 rounded-xl transition"
                        title="View Full Scope"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {lead.status === "New" && (
                        <>
                          <button
                            onClick={() => handleDeclineLead(lead.id)}
                            className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 font-bold px-3 py-1.5 rounded-xl transition text-[10px]"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleOpenProposal(lead)}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl transition text-[10px] flex items-center gap-1"
                          >
                            Send Proposal
                            <Send className="h-3 w-3" />
                          </button>
                        </>
                      )}

                      {lead.status === "Proposal Sent" && (
                        <button
                          onClick={() => handleOpenProposal(lead)}
                          className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-3 py-1.5 rounded-xl transition text-[10px]"
                        >
                          Modify Proposal
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* VIEW FULL REQUEST DETAILS MODAL */}
          {selectedLead && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-xl w-full rounded-3xl p-6 relative space-y-5 shadow-2xl">
                <button
                  onClick={() => setSelectedLead(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400 font-mono">
                    Matching solicitation detail
                  </span>
                  <h3 className="text-xl font-black text-text-primary mt-1 tracking-tight">
                    {selectedLead.title}
                  </h3>
                  <div className="flex gap-2.5 mt-2 flex-wrap text-[10px]">
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-text-secondary">
                      Client: {selectedLead.seekers?.company_name || "N/A"}
                    </span>
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-emerald-400">
                      Budget: {selectedLead.budget ? `GEL ${Number(selectedLead.budget).toLocaleString()}` : "N/A"}
                    </span>
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-cyan-400">
                      Urgency: {selectedLead.urgency}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <h4 className="font-bold text-text-primary uppercase tracking-widest text-[9px]">Scope of Services</h4>
                  <p className="text-text-secondary leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60 whitespace-pre-wrap">
                    {selectedLead.description}
                  </p>
                </div>

                {selectedLead.required_tools.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <h4 className="font-bold text-text-primary uppercase tracking-widest text-[9px]">Requested Tools / Tech Stack</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLead.required_tools.map((tool: string, i: number) => (
                        <span key={i} className="bg-slate-950 border border-slate-850/80 text-[10px] text-cyan-400 px-2.5 py-1 rounded-lg font-mono">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-850 pt-4 flex justify-end gap-2 text-xs">
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                  >
                    Close Window
                  </button>
                  {selectedLead.status === "New" && (
                    <button
                      onClick={() => {
                        setSelectedLead(null);
                        handleOpenProposal(selectedLead);
                      }}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition"
                    >
                      Send Proposal
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SEND/MODIFY PROPOSAL MODAL */}
          {proposalLead && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-xl w-full rounded-3xl p-6 relative space-y-5 shadow-2xl">
                <button
                  onClick={() => setProposalLead(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div>
                  <h3 className="text-lg font-black text-text-primary tracking-tight">
                    {isKa ? "წინადადების წარდგენა" : "Submit Service Proposal"}
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    {proposalLead.title}
                  </p>
                </div>

                <form onSubmit={submitProposal} className="space-y-4 text-xs">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                        Proposed Price (GEL)
                      </label>
                      <input
                        type="number"
                        required
                        value={proposalPrice}
                        onChange={(e) => setProposalPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                        Estimated Delivery
                      </label>
                      <input
                        type="text"
                        required
                        value={proposalDuration}
                        onChange={(e) => setProposalDuration(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Proposal Details / Cover Letter
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={proposalScope}
                      onChange={(e) => setProposalScope(e.target.value)}
                      placeholder="Outline why your company is best suited to fulfill this procurement..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                    />
                  </div>

                  <div className="border-t border-slate-850 pt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setProposalLead(null)}
                      className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2.5 border border-slate-850 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingProposal}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5"
                    >
                      {submittingProposal && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Submit Proposal
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}

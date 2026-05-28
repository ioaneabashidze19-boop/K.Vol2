"use client";

import { use, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Loader2,
  Copy,
  Check,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  Plus,
  ToggleLeft,
  ToggleRight,
  Download,
  Percent
} from "lucide-react";

interface ProviderAffiliateProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function ProviderAffiliatePage({ params }: ProviderAffiliateProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any | null>(null);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [attributions, setAttributions] = useState<any[]>([]);
  const [clickCount, setClickCount] = useState(0);
  const [conversionCount, setConversionCount] = useState(0);
  const [leadsList, setLeadsList] = useState<any[]>([]);

  // Form states
  const [newPrefix, setNewPrefix] = useState("KAVSH");
  const newType = "percentage";
  const [newValue, setNewValue] = useState(10);
  const [newExpiry, setNewExpiry] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);

  // Copy states
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  async function loadAffiliateData() {
    try {
      setLoading(true);

      // 1. Fetch Clerk mapped dbUser
      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", user?.id)
        .single();

      if (!dbUser) return;

      // 2. Fetch Provider Company profile
      const { data: comp } = await supabase
        .from("companies")
        .select("id, name")
        .eq("owner_id", dbUser.id)
        .single();

      if (!comp) return;
      setCompany(comp);

      // 3. Fetch all company promo codes
      const { data: codes } = await supabase
        .from("special_offers")
        .select("*")
        .eq("company_id", comp.id)
        .order("created_at", { ascending: false });
      setPromoCodes(codes || []);

      // 4. Fetch session attributions
      const { data: attrs } = await supabase
        .from("session_attribution")
        .select("id, token, code_used, expires_at, created_at")
        .eq("company_id", comp.id);
      setAttributions(attrs || []);

      const attrIds = (attrs || []).map((a) => a.id);

      if (attrIds.length > 0) {
        // Fetch clicks count
        const { count: clicks } = await supabase
          .from("click_events")
          .select("id", { count: "exact", head: true })
          .in("session_id", attrIds);
        setClickCount(clicks || 0);

        // Fetch leads list
        const { data: leads } = await supabase
          .from("leads")
          .select("*, seeker:seekers(id, company_name, user:users(name, email))")
          .eq("company_id", comp.id);

        const parsedLeads = (leads || []).map((l) => ({
          ...l,
          seekerName: l.seeker?.user?.name || "Seeker Guest",
          seekerOrg: l.seeker?.company_name || "N/A",
          email: l.seeker?.user?.email || "N/A"
        }));

        setLeadsList(parsedLeads);
        setConversionCount(parsedLeads.length);
      }
    } catch (err) {
      console.error("Failed compiling provider affiliate metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadAffiliateData();
  }, [isLoaded, user]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleCodeActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("special_offers")
        .update({ active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      setPromoCodes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, active: !currentStatus } : c))
      );
    } catch (err: any) {
      alert("Failed toggling code state: " + err.message);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    try {
      setCreatingCode(true);
      const response = await fetch("/api/affiliate/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          discountType: newType,
          discountValue: Number(newValue),
          expiryDate: newExpiry || undefined,
          prefix: newPrefix.trim() || undefined
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed generating code");

      alert(isKa ? "პრომო კოდი წარმატებით შეიქმნა!" : "Custom referral promo code generated!");
      setNewPrefix("KAVSH");
      setNewExpiry("");
      setNewValue(10);
      await loadAffiliateData();
    } catch (err: any) {
      alert("Error generating promo code: " + err.message);
    } finally {
      setCreatingCode(false);
    }
  };

  // Export referred leads to CSV
  const triggerCsvExport = () => {
    const headers = ["Referral Date", "Client Name", "Organization", "Email", "Status"];
    const rows = leadsList.map((l) => [
      new Date(l.created_at).toLocaleDateString(),
      l.seekerName,
      l.seekerOrg,
      l.email,
      l.status
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kavshare_affiliate_leads.csv");
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
            {isKa ? "აფილატების პანელი იტვირთება..." : "Compiling affiliate reporting..."}
          </p>
        </div>
      </div>
    );
  }

  // Primary active offer
  const primaryOffer = promoCodes.find((c) => c.active) || promoCodes[0] || null;
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://kavshare.com";
  const shareLink = primaryOffer ? `${appUrl}/register?ref=${primaryOffer.name}` : "";

  // Metrics calculations
  const conversionRate = clickCount > 0 ? ((conversionCount / clickCount) * 100).toFixed(1) : "0.0";

  return (
    <ProtectedRoute allowedRoles={["provider"]}>
      <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8 animate-in fade-in duration-500">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-6">
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1 font-mono">
                <Target className="h-4 w-4" />
                {isKa ? "პარტნიორული სისტემა" : "Affiliate & Partner Program"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "რეფერალების მართვა" : "Referrals & Performance"}
              </h1>
            </div>

            <button
              onClick={triggerCsvExport}
              disabled={leadsList.length === 0}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-text-primary border border-slate-800 font-bold px-4 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
            >
              <Download className="h-4 w-4" />
              {isKa ? "რეფერალების ექსპორტი" : "Export Referred Leads"}
            </button>
          </div>

          {/* Top Panel: Promo code box & Performance metrics */}
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            
            {/* Promo Code Box */}
            <div className="lg:col-span-1 bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-5">
              <div className="border-b border-slate-900 pb-3">
                <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400 font-mono">Primary Partner Code</span>
                <h3 className="text-sm font-extrabold text-text-primary mt-0.5">Share and Credit Leads</h3>
              </div>

              {primaryOffer ? (
                <div className="space-y-4">
                  {/* Promo display */}
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex justify-between items-center relative overflow-hidden">
                    <div>
                      <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Promo Code</span>
                      <strong className="block text-xl font-black text-cyan-400 tracking-tight mt-0.5">{primaryOffer.name}</strong>
                    </div>
                    <button
                      onClick={() => handleCopyCode(primaryOffer.name)}
                      className="bg-slate-900 hover:bg-slate-800 text-text-primary p-2 rounded-xl transition border border-slate-800"
                    >
                      {copiedCode === primaryOffer.name ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Shareable Referral Link */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">Referral Landing URL</span>
                    <div className="bg-slate-950 border border-slate-850 rounded-xl p-2.5 flex items-center justify-between text-[10px]">
                      <span className="text-text-muted truncate mr-2 font-mono">{shareLink}</span>
                      <button
                        onClick={() => handleCopyLink(shareLink)}
                        className="text-cyan-400 hover:text-cyan-300 font-bold px-2 py-1 shrink-0"
                      >
                        {copiedLink ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {/* QR & Discount Info */}
                  <div className="flex items-center gap-4 bg-slate-950/30 p-3 rounded-2xl border border-slate-900">
                    <div className="bg-slate-100 p-1.5 rounded-xl shrink-0">
                      {/* Premium inline Vector SVG QR Mock */}
                      <svg className="h-10 w-10 text-slate-950" viewBox="0 0 100 100">
                        <rect x="0" y="0" width="25" height="25" fill="currentColor" />
                        <rect x="10" y="10" width="5" height="5" fill="#fff" />
                        <rect x="75" y="0" width="25" height="25" fill="currentColor" />
                        <rect x="0" y="75" width="25" height="25" fill="currentColor" />
                        <rect x="35" y="35" width="30" height="30" fill="currentColor" />
                        <rect x="50" y="10" width="10" height="15" fill="currentColor" />
                        <rect x="15" y="50" width="15" height="10" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Credited Discount</span>
                      <strong className="block text-sm font-black text-emerald-400">
                        {primaryOffer.discount_value}% Discount
                      </strong>
                      <span className="text-[10px] text-text-muted leading-tight block">Valid on seeker platform contracts.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-text-muted text-xs">
                  No active promo codes found. Create your first code below.
                </div>
              )}
            </div>

            {/* Performance Metrics Cards */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl relative shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Total Link Clicks</span>
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                  </div>
                  <p className="text-2xl font-black text-text-primary tracking-tight mt-1">{clickCount}</p>
                </div>

                {/* Metric 2 */}
                <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl relative shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Conversions</span>
                    <Users className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-black text-emerald-400 tracking-tight mt-1">{conversionCount}</p>
                </div>

                {/* Metric 3 */}
                <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl relative shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Conversion rate</span>
                    <Target className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-black text-text-primary tracking-tight mt-1">{conversionRate}%</p>
                </div>

                {/* Metric 4 */}
                <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl relative shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Active Leads</span>
                    <BarChart3 className="h-4 w-4 text-cyan-400" />
                  </div>
                  <p className="text-2xl font-black text-text-primary tracking-tight mt-1">
                    {leadsList.filter(l => l.status === "registered").length}
                    <span className="text-[10px] text-text-muted font-normal block mt-0.5">
                      {attributions.length} campaigns
                    </span>
                  </p>
                </div>
              </div>

              {/* Conversion Funnel visual bar */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <h4 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">Referral Funnel visualization</h4>
                
                <div className="space-y-3.5">
                  {/* Stage 1 */}
                  <div>
                    <div className="flex justify-between text-xs text-text-secondary mb-1">
                      <span>Total Referral Visits (Clicks)</span>
                      <strong>{clickCount}</strong>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: clickCount > 0 ? "100%" : "0%" }} />
                    </div>
                  </div>

                  {/* Stage 2 */}
                  <div>
                    <div className="flex justify-between text-xs text-text-secondary mb-1">
                      <span>Seeker registrations</span>
                      <strong>{conversionCount}</strong>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: clickCount > 0 ? `${(conversionCount / clickCount) * 100}%` : "0%" }} />
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Col: Referred Leads ledger */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">Referred Leads Registry</h3>
                  <p className="text-[10px] text-text-muted">Referred client seeker accounts credited to your affiliate promo codes.</p>
                </div>

                {leadsList.length === 0 ? (
                  <div className="text-center py-10 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                    No referred seeker leads registered yet. Share your promo link to credit conversions.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-900 text-text-secondary uppercase tracking-widest text-[9px] font-bold">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Client Company</th>
                          <th className="pb-2">Client Owner</th>
                          <th className="pb-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/30">
                        {leadsList.map((lead) => (
                          <tr key={lead.id} className="hover:bg-slate-900/10 transition">
                            <td className="py-3 font-mono text-text-secondary text-[10px]">
                              {new Date(lead.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 font-bold text-text-primary">{lead.seekerOrg}</td>
                            <td className="py-3">
                              <div>
                                <span className="block">{lead.seekerName}</span>
                                <span className="block text-[9px] text-text-muted font-mono">{lead.email}</span>
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                {lead.status}
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

            {/* Right Col: Generate Custom Code & Codes Ledger */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Form to generate new codes */}
              <form onSubmit={handleCreateCode} className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4 text-xs">
                <div>
                  <h4 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">Generate Promo Code</h4>
                  <p className="text-[10px] text-text-muted">Create localized referral promo codes for unique campaigns.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Code Prefix</label>
                    <input
                      type="text"
                      required
                      value={newPrefix}
                      onChange={(e) => setNewPrefix(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      placeholder="SUMMER"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Discount value (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min={1}
                        max={100}
                        value={newValue}
                        onChange={(e) => setNewValue(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-3 pr-10 py-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        placeholder="10"
                      />
                      <Percent className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-text-muted" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Expiry Date (optional)</label>
                    <input
                      type="date"
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creatingCode}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
                  >
                    {creatingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create Promo Code
                  </button>
                </div>
              </form>

              {/* Codes list ledger with activate/deactivate toggles */}
              <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-4">
                <h4 className="text-xs uppercase font-extrabold text-text-primary tracking-wider">Promo Codes Registry</h4>
                
                <div className="space-y-3">
                  {promoCodes.map((code) => (
                    <div key={code.id} className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <strong className="text-text-primary">{code.name}</strong>
                        <span className="block text-[9px] text-text-muted font-mono">{code.discount_value}% discount</span>
                      </div>
                      <button
                        onClick={() => handleToggleCodeActive(code.id, code.active)}
                        className="text-text-secondary hover:text-text-primary transition"
                      >
                        {code.active ? (
                          <ToggleRight className="h-6 w-6 text-cyan-400" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-text-muted" />
                        )}
                      </button>
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

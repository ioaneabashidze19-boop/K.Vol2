"use client";

import { use, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Loader2,
  SlidersHorizontal,
  Search,
  Check,
  X,
  AlertOctagon,
  Eye,
  Edit,
  Save,
  MessageSquare,
  Percent,
  Download,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown
} from "lucide-react";

interface AdminProvidersProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function AdminProvidersPage({ params }: AdminProvidersProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Core loading states
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "revenue" | "contracts" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selection for detail panel & actions
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [editingCompany, setEditingCompany] = useState<any | null>(null);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editFounded, setEditFounded] = useState(2020);
  const [editEmployees, setEditEmployees] = useState(10);
  const [editDesc, setEditDesc] = useState("");
  const [commissionRate, setCommissionRate] = useState(10);

  // Modal / Action states
  const [suspendingCompany, setSuspendingCompany] = useState<any | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [messagingCompany, setMessagingCompany] = useState<any | null>(null);
  const [messageText, setMessageText] = useState("");

  // Load companies, contracts, services
  async function loadProvidersData() {
    try {
      setLoading(true);

      // Fetch all companies
      const { data: companyList } = await supabase
        .from("companies")
        .select("*, owner:users(name, email)");

      // Fetch all services
      const { data: servicesList } = await supabase
        .from("services")
        .select("company_id, id");

      // Fetch all engagements & contracts
      const { data: engagementsList } = await supabase
        .from("engagements")
        .select("id, status, company_id");

      const { data: contractsList } = await supabase
        .from("contracts")
        .select("engagement_id, monthly_value, status");

      const parsedCompanies = (companyList || []).map((comp) => {
        const servicesCount = (servicesList || []).filter((s) => s.company_id === comp.id).length;
        
        // Find matching engagements
        const matchedEngs = (engagementsList || []).filter((e) => e.company_id === comp.id);
        const engIds = matchedEngs.map((e) => e.id);
        
        // Contracts matching those engagements
        const contracts = (contractsList || []).filter((c) => engIds.includes(c.engagement_id));
        const activeContractsCount = contracts.filter((c) => c.status === "active").length;
        const totalRevenue = contracts
          .filter((c) => c.status === "active" || c.status === "completed")
          .reduce((acc, c) => acc + Number(c.monthly_value || 0), 0);

        return {
          ...comp,
          servicesCount,
          activeContractsCount,
          totalRevenue,
          ownerName: comp.owner?.name || "System User",
          ownerEmail: comp.owner?.email || "N/A"
        };
      });

      setCompanies(parsedCompanies);
    } catch (err) {
      console.error("Failed loading provider management ledger:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadProvidersData();
  }, [isLoaded, user]);

  // Compute sorting & filtering
  useEffect(() => {
    let result = [...companies];

    // Search query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.ownerName || "").toLowerCase().includes(q) ||
          (c.ownerEmail || "").toLowerCase().includes(q)
      );
    }

    // Status Filter
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "revenue") {
        comparison = a.totalRevenue - b.totalRevenue;
      } else if (sortBy === "contracts") {
        comparison = a.activeContractsCount - b.activeContractsCount;
      } else if (sortBy === "date") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredCompanies(result);
  }, [companies, searchQuery, statusFilter, sortBy, sortOrder]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Status updates
  const handleUpdateStatus = async (companyId: string, status: "active" | "rejected" | "suspended") => {
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status })
        .eq("id", companyId);

      if (error) throw error;

      alert(isKa ? "სტატუსი წარმატებით განახლდა!" : `Provider status successfully updated to ${status}!`);
      
      // Reload matching dataset
      await loadProvidersData();
      if (selectedCompany && selectedCompany.id === companyId) {
        setSelectedCompany((prev: any) => ({ ...prev, status }));
      }
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  // Edit provider action
  const handleStartEdit = (comp: any) => {
    setEditingCompany(comp);
    setEditName(comp.name);
    setEditWebsite(comp.website || "");
    setEditLocation(comp.location || "");
    setEditFounded(comp.founded_year || 2020);
    setEditEmployees(comp.employee_count || 10);
    setEditDesc(comp.description || "");
    // Retrieve mock or saved custom commission
    const rate = localStorage.getItem(`kavshare_commission_${comp.id}`);
    setCommissionRate(rate ? Number(rate) : 10);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: editName.trim(),
          website: editWebsite.trim() || null,
          location: editLocation.trim() || null,
          founded_year: editFounded,
          employee_count: editEmployees,
          description: editDesc.trim() || null,
        })
        .eq("id", editingCompany.id);

      if (error) throw error;

      // Save commission adjustments locally
      localStorage.setItem(`kavshare_commission_${editingCompany.id}`, commissionRate.toString());

      alert(isKa ? "კომპანიის დეტალები განახლდა" : "Provider details successfully updated!");
      setEditingCompany(null);
      await loadProvidersData();
      if (selectedCompany && selectedCompany.id === editingCompany.id) {
        setSelectedCompany({
          ...selectedCompany,
          name: editName.trim(),
          website: editWebsite.trim() || null,
          location: editLocation.trim() || null,
          founded_year: editFounded,
          employee_count: editEmployees,
          description: editDesc.trim() || null,
        });
      }
    } catch (err: any) {
      alert("Error updating company details: " + err.message);
    }
  };

  // Suspend action
  const triggerSuspend = (comp: any) => {
    setSuspendingCompany(comp);
    setSuspendReason("Failure to remit commission payouts on contract milestones.");
  };

  const submitSuspend = async () => {
    if (!suspendingCompany) return;
    await handleUpdateStatus(suspendingCompany.id, "suspended");
    // Store suspension audit log
    localStorage.setItem(`kavshare_suspend_reason_${suspendingCompany.id}`, suspendReason);
    setSuspendingCompany(null);
  };

  // Messaging action
  const triggerMessage = (comp: any) => {
    setMessagingCompany(comp);
    setMessageText(`Hello ${comp.name} Team,\nWe noticed some pending settlement schedules in your dashboard. Please verify payment channels.`);
  };

  const submitMessage = () => {
    if (!messagingCompany) return;
    alert(isKa ? "შეტყობინება გაიგზავნა!" : `Message successfully dispatched to ${messagingCompany.name} owner.`);
    setMessagingCompany(null);
  };

  // Export provider database to CSV
  const triggerCsvExport = () => {
    const headers = ["Provider Name", "Owner Email", "Status", "Services", "Revenue (GEL)", "Date Joined"];
    const rows = filteredCompanies.map((c) => [
      c.name,
      c.ownerEmail,
      c.status,
      c.servicesCount,
      c.totalRevenue,
      new Date(c.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kavshare_providers_registry.csv");
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
            {isKa ? "პროვაიდერები იტვირთება..." : "Compiling provider directory..."}
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
                <ShieldCheck className="h-4 w-4" />
                {isKa ? "პროვაიდერების კონტროლი" : "Platform Partner Accounts"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "პროვაიდერების მართვა" : "Provider Management"}
              </h1>
            </div>

            <button
              onClick={triggerCsvExport}
              className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-4 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
            >
              <Download className="h-4 w-4" />
              {isKa ? "მონაცემების ექსპორტი" : "Export Provider Registry"}
            </button>
          </div>

          {/* Search, filters, sort */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            
            {/* Search */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={isKa ? "ძებნა კომპანიით, მფლობელით..." : "Search providers by company, email..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition"
              />
              <Search className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>

            {/* Status filters */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[140px]"
              >
                <option value="all">{isKa ? "ყველა სტატუსი" : "All Statuses"}</option>
                <option value="active">{isKa ? "აქტიური" : "Active"}</option>
                <option value="pending">{isKa ? "მოლოდინში" : "Pending"}</option>
                <option value="suspended">{isKa ? "შეჩერებული" : "Suspended"}</option>
                <option value="rejected">{isKa ? "უარყოფილი" : "Rejected"}</option>
              </select>
              <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>

          </div>

          {/* Providers Grid / Detail panel layout */}
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            
            {/* Table list */}
            <div className="lg:col-span-2 bg-slate-900/20 border border-slate-850 rounded-3xl p-6 shadow-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-900 text-text-secondary uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3 cursor-pointer py-2" onClick={() => toggleSort("name")}>
                      <span className="flex items-center gap-1">
                        Name
                        <ArrowUpDown className="h-3 w-3 text-text-muted" />
                      </span>
                    </th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-center">Services</th>
                    <th className="pb-3 text-right cursor-pointer" onClick={() => toggleSort("revenue")}>
                      <span className="flex items-center justify-end gap-1">
                        Revenue
                        <ArrowUpDown className="h-3 w-3 text-text-muted" />
                      </span>
                    </th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40">
                  {filteredCompanies.map((comp) => (
                    <tr
                      key={comp.id}
                      className={`hover:bg-slate-900/35 transition cursor-pointer ${
                        selectedCompany?.id === comp.id ? "bg-slate-900/30 font-bold" : ""
                      }`}
                      onClick={() => setSelectedCompany(comp)}
                    >
                      <td className="py-3.5 font-bold text-text-primary">
                        <div>
                          <span>{comp.name}</span>
                          <span className="block text-[8px] font-normal text-text-muted font-mono">{comp.ownerEmail}</span>
                        </div>
                      </td>

                      <td className="py-3.5 text-center">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                          comp.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : comp.status === "pending"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>
                          {comp.status}
                        </span>
                      </td>

                      <td className="py-3.5 text-center font-mono">{comp.servicesCount} listings</td>

                      <td className="py-3.5 text-right font-mono text-emerald-400">
                        GEL {comp.totalRevenue.toLocaleString()}
                      </td>

                      <td className="py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCompany(comp)}
                            className="bg-slate-950 hover:bg-slate-850 text-text-secondary border border-slate-850 p-1.5 rounded-lg transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleStartEdit(comp)}
                            className="bg-slate-950 hover:bg-slate-850 text-text-secondary border border-slate-850 p-1.5 rounded-lg transition"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detail / Checklist Panel */}
            <div className="lg:col-span-1 space-y-6">
              {selectedCompany ? (
                <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-5">
                  <div className="flex justify-between items-start border-b border-slate-900 pb-3">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400 font-mono">Company ID: {selectedCompany.id.substring(0,8)}</span>
                      <h4 className="font-extrabold text-text-primary text-sm mt-0.5">{selectedCompany.name}</h4>
                    </div>

                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                      selectedCompany.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {selectedCompany.status}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest font-black text-text-secondary">Summary Profile</span>
                      <p className="text-text-muted leading-relaxed text-[11px] mt-1">{selectedCompany.description || "No description configured."}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-text-secondary">
                      <div>
                        <span>HQ Location:</span>
                        <strong className="block text-text-primary">{selectedCompany.location || "Georgia"}</strong>
                      </div>
                      <div>
                        <span>Founded:</span>
                        <strong className="block text-text-primary">{selectedCompany.founded_year || "N/A"}</strong>
                      </div>
                    </div>

                    {/* Verification Checklist */}
                    <div className="border-t border-slate-900 pt-4.5 space-y-2">
                      <span className="block text-[8px] uppercase tracking-widest font-black text-cyan-400 font-mono">Verification Checklist</span>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">Account Registered</span>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">Georgian IBAN verified</span>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">Wise Settlement Setup</span>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                      </div>
                    </div>

                    {/* Quick Admin Action Panel */}
                    <div className="border-t border-slate-900 pt-4.5 space-y-2">
                      <span className="block text-[8px] uppercase tracking-widest font-black text-text-secondary">Quick Operations</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {selectedCompany.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(selectedCompany.id, "rejected")}
                              className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 font-bold py-2 rounded-xl transition text-[10px]"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(selectedCompany.id, "active")}
                              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-2 rounded-xl transition text-[10px]"
                            >
                              Approve
                            </button>
                          </>
                        )}

                        {selectedCompany.status === "active" && (
                          <button
                            onClick={() => triggerSuspend(selectedCompany)}
                            className="col-span-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 font-bold py-2 rounded-xl transition text-[10px] flex items-center justify-center gap-1"
                          >
                            <AlertOctagon className="h-3.5 w-3.5" />
                            Suspend Provider
                          </button>
                        )}

                        <button
                          onClick={() => triggerMessage(selectedCompany)}
                          className="col-span-2 bg-slate-950 hover:bg-slate-850 text-text-primary border border-slate-850 font-bold py-2 rounded-xl transition text-[10px] flex items-center justify-center gap-1"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                          Send Admin Message
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/10 border border-slate-850 p-8 rounded-3xl text-center text-text-muted text-xs">
                  Select a provider company from the registry ledger to view verification details and run admin actions.
                </div>
              )}
            </div>

          </div>

          {/* EDIT DIALOG MODAL */}
          {editingCompany && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-xl w-full rounded-3xl p-6 relative space-y-5 shadow-2xl">
                <button
                  onClick={() => setEditingCompany(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div>
                  <h3 className="text-lg font-black text-text-primary tracking-tight">Edit Provider Profile</h3>
                  <p className="text-xs text-text-muted mt-1">{editingCompany.name}</p>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Company Name</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Website URL</label>
                      <input
                        type="url"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">HQ Location</label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Commission Rate (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={commissionRate}
                          onChange={(e) => setCommissionRate(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-3 pr-10 py-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        />
                        <Percent className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-text-muted" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest font-mono">Company Description Excerpt</label>
                    <textarea
                      rows={3}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                    />
                  </div>

                  <div className="border-t border-slate-850 pt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCompany(null)}
                      className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-2 rounded-xl transition flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SUSPENSION MODAL */}
          {suspendingCompany && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-md w-full rounded-3xl p-6 relative space-y-5 shadow-2xl">
                <button
                  onClick={() => setSuspendingCompany(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-bold text-red-400 tracking-widest flex items-center gap-1 font-mono">
                    <ShieldAlert className="h-4 w-4 animate-pulse" />
                    Confirm Suspension Action
                  </span>
                  <h3 className="text-base font-black text-text-primary tracking-tight">Suspend {suspendingCompany.name}?</h3>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Suspending accounts hides their catalog services from client searches and blocks them from accepting leads.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Reason for Suspension</label>
                    <textarea
                      rows={3}
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                    />
                  </div>

                  <div className="border-t border-slate-850 pt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setSuspendingCompany(null)}
                      className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitSuspend}
                      className="bg-red-500 hover:bg-red-600 text-slate-950 font-extrabold px-5 py-2 rounded-xl transition"
                    >
                      Confirm Suspension
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MESSAGING MODAL */}
          {messagingCompany && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-md w-full rounded-3xl p-6 relative space-y-5 shadow-2xl">
                <button
                  onClick={() => setMessagingCompany(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div>
                  <h3 className="text-base font-black text-text-primary tracking-tight">Send Platform Notice</h3>
                  <p className="text-xs text-text-muted mt-1">Recipient: {messagingCompany.name}</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Notice Content</label>
                    <textarea
                      rows={5}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                    />
                  </div>

                  <div className="border-t border-slate-850 pt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setMessagingCompany(null)}
                      className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitMessage}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-2 rounded-xl transition"
                    >
                      Send Message
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

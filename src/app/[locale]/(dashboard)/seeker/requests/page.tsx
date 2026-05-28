"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Archive,
  Eye,
  Edit2,
  X,
  Sparkles,
  ArrowRight,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderOpen
} from "lucide-react";

interface SeekerRequestsProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function SeekerRequestsPage({ params }: SeekerRequestsProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Seeker info
  const [seekerId, setSeekerId] = useState<string | null>(null);

  // Requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter / Search / Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "filled" | "expired" | "cancelled">("active");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "budget_desc" | "urgency_high">("date_desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Detail Modal state
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);

  // Edit Form Fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editUrgency, setEditUrgency] = useState("");

  // 1. Initial Load: Fetch seeker profile & requests
  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadSeekerRequests() {
      try {
        if (!user) return;
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
        await fetchRequests(seeker.id);
      } catch (err) {
        console.error("Failed to load requests:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSeekerRequests();
  }, [isLoaded, user]);

  // Fetch from DB
  async function fetchRequests(seekerUuid: string) {
    const { data, error } = await supabase
      .from("procurement_posts")
      .select("*")
      .eq("seeker_id", seekerUuid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching requests:", error);
      return;
    }

    setRequests(data || []);
  }

  // 2. Filter, search and sort calculations
  useEffect(() => {
    let result = [...requests];

    // Filter by Tab (Status mapping: active, filled, expired, cancelled)
    result = result.filter((r) => r.status === activeTab);

    // Search query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    // Sort options
    if (sortBy === "date_desc") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "date_asc") {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "budget_desc") {
      result.sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0));
    } else if (sortBy === "urgency_high") {
      const weight = { critical: 4, high: 3, medium: 2, low: 1 };
      result.sort((a, b) => {
        const wA = weight[a.urgency as keyof typeof weight] || 0;
        const wB = weight[b.urgency as keyof typeof weight] || 0;
        return wB - wA;
      });
    }

    setFilteredRequests(result);
    setCurrentPage(1);
    setSelectedIds([]);
  }, [requests, activeTab, searchQuery, sortBy]);

  // Paginated subset
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  // Bulk actions
  const handleBulkArchive = async () => {
    if (selectedIds.length === 0 || !seekerId) return;
    const confirmArchive = confirm(
      isKa ? "ნამდვილად გსურთ მონიშნული მოთხოვნების არქივირება?" : "Are you sure you want to cancel/archive selected requests?"
    );
    if (!confirmArchive) return;

    try {
      const { error } = await supabase
        .from("procurement_posts")
        .update({ status: "cancelled" })
        .in("id", selectedIds);

      if (error) throw error;

      await fetchRequests(seekerId);
      setSelectedIds([]);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || !seekerId) return;
    const confirmDelete = confirm(
      isKa ? "ნამდვილად გსურთ მონიშნული მოთხოვნების წაშლა?" : "Are you sure you want to delete selected requests?"
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("procurement_posts")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      await fetchRequests(seekerId);
      setSelectedIds([]);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Open details & fetch dynamic matchmaking matches
  const handleViewDetails = async (req: any) => {
    setSelectedRequest(req);
    setMatches([]);
    setLoadingMatches(true);

    try {
      // Call postgres score calculation matchmaking function
      const { data, error } = await supabase.rpc("match_providers_for_request", {
        p_request_id: req.id,
        p_limit: 5
      });

      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      console.error("Matchmaking calculation failed:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  // Quick action: archive single request
  const handleArchiveSingle = async (reqId: string) => {
    if (!seekerId) return;
    try {
      const { error } = await supabase
        .from("procurement_posts")
        .update({ status: "cancelled" })
        .eq("id", reqId);

      if (error) throw error;
      await fetchRequests(seekerId);
      if (selectedRequest && selectedRequest.id === reqId) {
        setSelectedRequest({ ...selectedRequest, status: "cancelled" });
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Quick action: delete single request
  const handleDeleteSingle = async (reqId: string) => {
    if (!seekerId) return;
    const confirmDel = confirm(isKa ? "ნამდვილად გსურთ წაშლა?" : "Delete this request?");
    if (!confirmDel) return;

    try {
      const { error } = await supabase
        .from("procurement_posts")
        .delete()
        .eq("id", reqId);

      if (error) throw error;
      setSelectedRequest(null);
      await fetchRequests(seekerId);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Open Edit inline
  const handleOpenEdit = (req: any) => {
    setEditingRequest(req);
    setEditTitle(req.title);
    setEditDescription(req.description);
    setEditBudget(req.budget ? req.budget.toString() : "");
    setEditUrgency(req.urgency);
  };

  // Save edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest || !seekerId) return;

    try {
      const { error } = await supabase
        .from("procurement_posts")
        .update({
          title: editTitle,
          description: editDescription,
          budget: editBudget ? parseFloat(editBudget) : null,
          urgency: editUrgency,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingRequest.id);

      if (error) throw error;

      setEditingRequest(null);
      await fetchRequests(seekerId);
      // Refresh current detail modal if open
      if (selectedRequest && selectedRequest.id === editingRequest.id) {
        const { data: updatedReq } = await supabase
          .from("procurement_posts")
          .select("*")
          .eq("id", editingRequest.id)
          .single();
        setSelectedRequest(updatedReq);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "მოთხოვნები იტვირთება..." : "Loading requests ledger..."}
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
                <FolderOpen className="h-3.5 w-3.5" />
                {isKa ? "პროცესების მართვა" : "Procurement Center"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "ჩემი მოთხოვნები" : "My Procurement Requests"}
              </h1>
              <p className="text-xs text-text-muted mt-1">
                {isKa 
                  ? "მართეთ თქვენი მოთხოვნები, დააკვირდით შესაბამის პროვაიდერებს და ჩაატარეთ ტენდერები." 
                  : "Monitor published request statuses, evaluate algorithmic compatibility match scores, and invite providers."}
              </p>
            </div>

            <Link
              href={`/${locale}/seeker/new-request`}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5 self-stretch md:self-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              {isKa ? "ახალი მოთხოვნის შექმნა" : "Create New Request"}
            </Link>
          </div>

          {/* Filtering & Bulk Actions Row */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder={isKa ? "ძებნა დასახელებით..." : "Search by keyword or title..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition"
                />
              </div>

              {/* Sort selector */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-slate-900 border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-slate-700 transition appearance-none min-w-[150px]"
                >
                  <option value="date_desc">{isKa ? "უახლესი" : "Sort: Newest First"}</option>
                  <option value="date_asc">{isKa ? "უძველესი" : "Sort: Oldest First"}</option>
                  <option value="budget_desc">{isKa ? "მაღალი ბიუჯეტი" : "Sort: Highest Budget"}</option>
                  <option value="urgency_high">{isKa ? "მაღალი პრიორიტეტი" : "Sort: Highest Urgency"}</option>
                </select>
                <SlidersHorizontal className="absolute right-3.5 top-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
              </div>

            </div>

            {/* Bulk actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-900 border border-cyan-500/20 px-3 py-1.5 rounded-xl animate-in slide-in-from-bottom duration-200">
                <span className="text-[10px] text-cyan-400 font-bold font-mono mr-2">
                  {selectedIds.length} {isKa ? "მონიშნული" : "selected"}
                </span>
                <button
                  onClick={handleBulkArchive}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-text-secondary hover:text-text-primary transition flex items-center gap-1 text-[10px]"
                  title="Archive/Cancel Selected"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {isKa ? "არქივირება" : "Archive"}
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-red-400 hover:text-red-300 transition flex items-center gap-1 text-[10px]"
                  title="Delete Selected"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isKa ? "წაშლა" : "Delete"}
                </button>
              </div>
            )}
          </div>

          {/* Request List Tabs */}
          <div className="space-y-4">
            
            {/* Tabs */}
            <div className="flex border-b border-slate-900 gap-6 text-xs overflow-x-auto">
              {(["active", "filled", "expired", "cancelled"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 font-bold uppercase tracking-wider relative transition shrink-0 ${
                    activeTab === tab ? "text-cyan-400" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                  )}
                  {tab === "active" ? (isKa ? "აქტიური" : "Active") : 
                   tab === "filled" ? (isKa ? "შესრულებული" : "Completed / Filled") :
                   tab === "expired" ? (isKa ? "ვადაგასული" : "Expired") : 
                   (isKa ? "გაუქმებული" : "Cancelled / Archived")}
                </button>
              ))}
            </div>

            {/* List State */}
            {filteredRequests.length === 0 ? (
              
              /* Empty state */
              <div className="text-center py-24 bg-slate-900/10 border border-slate-850 rounded-3xl p-8 space-y-4 shadow-inner">
                <div className="mx-auto w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-text-muted">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-text-primary">
                    {isKa ? "მოთხოვნები არ მოიძებნა" : "No requests in this category"}
                  </h3>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    {isKa 
                      ? "ამ კატეგორიაში განაცხადები არ გაქვთ. შექმენით ახალი მოთხოვნა პროვაიდერების მოსაძებნად." 
                      : "Create a request to start receiving compatibility scoring matching suggestions from Georgian bank supported providers."}
                  </p>
                </div>
                <Link
                  href={`/${locale}/seeker/new-request`}
                  className="inline-flex bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition text-xs items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  {isKa ? "პირველი მოთხოვნის შექმნა" : "Create first request"}
                </Link>
              </div>

            ) : (

              /* Cards List */
              <div className="space-y-3">
                {paginatedRequests.map((req) => {
                  const isSelected = selectedIds.includes(req.id);
                  return (
                    <div
                      key={req.id}
                      className={`bg-slate-900/30 border p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition hover:border-slate-800 shadow-md ${
                        isSelected ? "border-cyan-500/40 bg-slate-900/50" : "border-slate-850"
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedIds((prev) =>
                              isSelected ? prev.filter((id) => id !== req.id) : [...prev, req.id]
                            );
                          }}
                          className="mt-1 bg-slate-950 border-slate-850 text-cyan-500 focus:ring-0 h-4.5 w-4.5 rounded cursor-pointer"
                        />

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-text-primary text-[13px] hover:text-cyan-400 cursor-pointer transition" onClick={() => handleViewDetails(req)}>
                              {req.title}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                              req.urgency === "critical"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : req.urgency === "high"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-slate-800 text-text-secondary"
                            }`}>
                              {req.urgency}
                            </span>
                          </div>
                          
                          <p className="text-xs text-text-muted line-clamp-2 max-w-2xl leading-relaxed">
                            {req.description}
                          </p>

                          <div className="flex items-center gap-4 text-[10px] text-text-secondary pt-1 font-mono uppercase">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(req.created_at).toLocaleDateString()}
                            </span>
                            {req.budget && (
                              <span className="text-emerald-400 font-bold">
                                Budget: GEL {Number(req.budget).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Menu Buttons */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-slate-900 pt-3 sm:pt-0 shrink-0">
                        <button
                          onClick={() => handleViewDetails(req)}
                          className="p-2 hover:bg-slate-900 rounded-xl text-text-secondary hover:text-text-primary transition"
                          title="View Matches"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {req.status === "active" && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(req)}
                              className="p-2 hover:bg-slate-900 rounded-xl text-text-secondary hover:text-text-primary transition"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleArchiveSingle(req.id)}
                              className="p-2 hover:bg-slate-900 rounded-xl text-text-secondary hover:text-text-primary transition"
                              title="Archive/Cancel"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteSingle(req.id)}
                          className="p-2 hover:bg-slate-900 rounded-xl text-red-500/80 hover:text-red-400 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center text-xs text-text-muted pt-4 border-t border-slate-900">
                <span>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length}
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-bold text-text-primary font-mono">{currentPage} / {totalPages}</span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* REQUEST DETAIL MODAL (With Advanced Matchmaking Results) */}
          {selectedRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-850 max-w-2xl w-full rounded-3xl p-6 relative space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Title */}
                <div>
                  <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    Posted: {new Date(selectedRequest.created_at).toLocaleDateString()}
                  </span>
                  <h3 className="text-xl font-black text-text-primary mt-1 tracking-tight">
                    {selectedRequest.title}
                  </h3>
                  <div className="flex items-center gap-2.5 mt-2 flex-wrap text-[10px]">
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-text-secondary">
                      Urgency: <strong className="text-cyan-400 uppercase">{selectedRequest.urgency}</strong>
                    </span>
                    {selectedRequest.budget && (
                      <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-emerald-400">
                        Budget: GEL {Number(selectedRequest.budget).toLocaleString()}
                      </span>
                    )}
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-bold text-text-muted">
                      Status: {selectedRequest.status}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5 text-xs">
                  <h4 className="font-bold text-text-primary uppercase tracking-widest text-[9px]">Scope Description</h4>
                  <p className="text-text-secondary leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60 whitespace-pre-wrap">
                    {selectedRequest.description}
                  </p>
                </div>

                {/* Matchmaking Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-t border-slate-850 pt-4">
                    <h4 className="font-bold text-text-primary uppercase tracking-widest text-[9px] flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                      Algorithmic Match Matches
                    </h4>
                    <span className="text-[9px] text-text-muted uppercase font-mono">Compatibility scoring index</span>
                  </div>

                  {loadingMatches ? (
                    <div className="py-8 flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
                      <span className="text-[10px] text-text-muted">Calculating service scores...</span>
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl text-center text-text-muted text-xs">
                      No matching provider profiles found in service catalogs.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {matches.map((m: any) => (
                        <div
                          key={m.company_id}
                          className="bg-slate-950/60 border border-slate-850/80 p-3.5 rounded-xl flex items-center justify-between gap-4 hover:border-slate-800 transition text-xs"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text-primary">
                                {m.company_name}
                              </span>
                              <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-emerald-500/20">
                                Match
                              </span>
                            </div>
                            
                            {m.match_explanations && m.match_explanations.length > 0 && (
                              <ul className="text-[9.5px] text-text-muted list-disc list-inside space-y-0.5">
                                {m.match_explanations.slice(0, 2).map((exp: string, i: number) => (
                                  <li key={i}>{exp}</li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right shrink-0">
                              <span className="block text-[8px] uppercase tracking-wider text-text-secondary">Fit score</span>
                              <span className="font-mono text-[13px] text-cyan-400 font-extrabold">
                                {Number(m.total_score).toFixed(0)}%
                              </span>
                            </div>
                            <Link
                              href={`/${locale}/marketplace`}
                              className="bg-slate-900 hover:bg-slate-800 text-text-primary p-2 rounded-lg border border-slate-800 transition"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Modal Actions */}
                <div className="flex justify-between items-center border-t border-slate-850 pt-4 text-xs">
                  <div className="flex gap-2">
                    {selectedRequest.status === "active" && (
                      <button
                        onClick={() => {
                          handleOpenEdit(selectedRequest);
                        }}
                        className="bg-slate-950 hover:bg-slate-850 text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                      >
                        Edit Details
                      </button>
                    )}
                    {selectedRequest.status === "active" && (
                      <button
                        onClick={() => handleArchiveSingle(selectedRequest.id)}
                        className="bg-slate-950 hover:bg-slate-850 text-text-muted hover:text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition"
                  >
                    Done
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* EDIT REQUEST INLINE MODAL */}
          {editingRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
              <form onSubmit={handleSaveEdit} className="bg-slate-900 border border-slate-850 max-w-lg w-full rounded-3xl p-6 relative space-y-4 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="absolute right-5 top-5 p-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-text-muted hover:text-text-primary transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <h3 className="text-base font-black text-text-primary tracking-tight">
                  {isKa ? "მოთხოვნის რედაქტირება" : "Edit Request Scope"}
                </h3>

                <div className="space-y-3 text-xs">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Title</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-text-primary focus:outline-none focus:border-slate-700 transition"
                    />
                  </div>

                  {/* Budget */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Budget (GEL)</label>
                    <input
                      type="number"
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 font-mono text-text-primary focus:outline-none focus:border-slate-700 transition"
                    />
                  </div>

                  {/* Urgency */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Urgency</label>
                    <select
                      value={editUrgency}
                      onChange={(e) => setEditUrgency(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-text-primary focus:outline-none focus:border-slate-700 transition"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Description</label>
                    <textarea
                      rows={4}
                      required
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditingRequest(null)}
                    className="bg-slate-950 hover:bg-slate-850 text-text-muted hover:text-text-primary font-bold px-4 py-2 border border-slate-850 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}

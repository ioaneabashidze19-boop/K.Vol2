"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/patterns/ProtectedRoute";
import {
  Loader2,
  Building,
  Briefcase,
  DollarSign,
  CreditCard,
  FolderKanban,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  ExternalLink,
  ShieldAlert
} from "lucide-react";

interface ProviderSettingsProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function ProviderSettingsPage({ params }: ProviderSettingsProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const { user, isLoaded } = useUser();

  // Tab State
  const [activeTab, setActiveTab] = useState<"company" | "services" | "pricing" | "billing" | "portfolio" | "account">("company");

  // Loading & notification states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Db ids
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [services, setServices] = useState<any[]>([]);

  // Company editable fields
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [foundedYear, setFoundedYear] = useState(2020);
  const [employeeCount, setEmployeeCount] = useState(10);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // Services management state
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("development");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceFormat, setServiceFormat] = useState<"fixed-price" | "hourly" | "subscription" | "custom">("fixed-price");
  const [serviceTech, setServiceTech] = useState("");
  const [servicePrice, setServicePrice] = useState("");

  // Simulated state for pricing, portfolio, account, and billing settings (saved to localStorage)
  const [pricingSettings, setPricingSettings] = useState({
    commissionStructure: "percentage",
    commissionRate: 10,
    exclusiveDiscount: 5,
    avgProjectPrice: 12000,
  });

  const [stripeStatus, setStripeStatus] = useState("connected");
  const [payoutSchedule, setPayoutSchedule] = useState("monthly");

  const [portfolio, setPortfolio] = useState<any[]>([
    {
      id: "1",
      title: "Enterprise SaaS Procurement Engine",
      client: "Agrohub LLC",
      desc: "Built a customized automation tool for catalog procurement flows.",
      tags: ["React", "Go", "PostgreSQL"],
    }
  ]);

  const [newCaseStudy, setNewCaseStudy] = useState({ title: "", client: "", desc: "", tags: "" });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Show status toasts
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function loadSettings() {
      if (!user) return;
      try {
        setLoading(true);

        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!dbUser) return;
        setDbUserId(dbUser.id);

        const { data: comp } = await supabase
          .from("companies")
          .select("*")
          .eq("owner_id", dbUser.id)
          .single();

        if (comp) {
          setCompany(comp);
          setCompanyName(comp.name || "");
          setLogoUrl(comp.logo_url || "");
          setWebsite(comp.website || "");
          setFoundedYear(comp.founded_year || 2020);
          setEmployeeCount(comp.employee_count || 10);
          setLocation(comp.location || "");
          setDescription(comp.description || "");

          // Load Services
          const { data: servs } = await supabase
            .from("services")
            .select("*")
            .eq("company_id", comp.id);

          setServices(servs || []);
        }

        // Restore custom structures from localStorage if existing
        const storedPricing = localStorage.getItem(`kavshare_pricing_${dbUser.id}`);
        if (storedPricing) setPricingSettings(JSON.parse(storedPricing));

        const storedPortfolio = localStorage.getItem(`kavshare_portfolio_${dbUser.id}`);
        if (storedPortfolio) setPortfolio(JSON.parse(storedPortfolio));

        const storedStripe = localStorage.getItem(`kavshare_stripe_${dbUser.id}`);
        if (storedStripe) setStripeStatus(storedStripe);

      } catch (err) {
        console.error("Failed loading company profile configurations:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [isLoaded, user]);

  // Save Company Information (saves directly to Supabase)
  const saveCompanyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: companyName.trim(),
          logo_url: logoUrl.trim() || null,
          website: website.trim() || null,
          founded_year: foundedYear,
          employee_count: employeeCount,
          location: location.trim() || null,
          description: description.trim() || null
        })
        .eq("id", company.id);

      if (error) throw error;

      showToast(isKa ? "პროფილი წარმატებით განახლდა!" : "Company details successfully updated!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Add / Edit Service (Persists to Supabase)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setSaving(true);
    try {
      const techArray = serviceTech
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const serviceData = {
        company_id: company.id,
        name: serviceName.trim(),
        category: serviceCategory.trim(),
        description: serviceDescription.trim() || null,
        delivery_format: serviceFormat,
        tech_stack: techArray,
        starting_price: servicePrice ? Number(servicePrice) : null,
      };

      if (editingService) {
        // Update existing service
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingService.id);

        if (error) throw error;
        showToast(isKa ? "სერვისი განახლდა" : "Service offering updated.", "success");
      } else {
        // Insert new service
        const { error } = await supabase
          .from("services")
          .insert(serviceData);

        if (error) throw error;
        showToast(isKa ? "სერვისი დაემატა" : "New service offering added.", "success");
      }

      // Reload services list
      const { data: updatedServs } = await supabase
        .from("services")
        .select("*")
        .eq("company_id", company.id);

      setServices(updatedServs || []);
      setEditingService(null);
      clearServiceForm();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (service: any) => {
    setEditingService(service);
    setServiceName(service.name);
    setServiceCategory(service.category);
    setServiceDescription(service.description || "");
    setServiceFormat(service.delivery_format);
    setServiceTech((service.tech_stack || []).join(", "));
    setServicePrice(service.starting_price ? service.starting_price.toString() : "");
  };

  const handleDeleteService = async (serviceId: string) => {
    const confirmDel = confirm(isKa ? "ნამდვილად წავშალოთ სერვისი?" : "Confirm deletion of this service?");
    if (!confirmDel) return;

    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      showToast(isKa ? "სერვისი წაიშალა" : "Service deleted successfully.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const clearServiceForm = () => {
    setServiceName("");
    setServiceCategory("development");
    setServiceDescription("");
    setServiceFormat("fixed-price");
    setServiceTech("");
    setServicePrice("");
  };

  // Pricing & Commissions Settings (Persists to localStorage)
  const savePricingSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUserId) return;

    localStorage.setItem(`kavshare_pricing_${dbUserId}`, JSON.stringify(pricingSettings));
    showToast(isKa ? "ფასების პარამეტრები შენახულია" : "Pricing settings successfully recorded.", "success");
  };

  // Portfolio Management (Persists to localStorage)
  const handleAddCaseStudy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUserId || !newCaseStudy.title.trim()) return;

    const updated = [
      ...portfolio,
      {
        id: Date.now().toString(),
        title: newCaseStudy.title.trim(),
        client: newCaseStudy.client.trim() || "N/A",
        desc: newCaseStudy.desc.trim(),
        tags: newCaseStudy.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
      }
    ];

    setPortfolio(updated);
    localStorage.setItem(`kavshare_portfolio_${dbUserId}`, JSON.stringify(updated));
    setNewCaseStudy({ title: "", client: "", desc: "", tags: "" });
    showToast(isKa ? "ქეისი დაემატა" : "Portfolio case study registered.", "success");
  };

  const handleDeleteCaseStudy = (id: string) => {
    if (!dbUserId) return;
    const updated = portfolio.filter((item) => item.id !== id);
    setPortfolio(updated);
    localStorage.setItem(`kavshare_portfolio_${dbUserId}`, JSON.stringify(updated));
    showToast(isKa ? "ქეისი წაიშალა" : "Case study removed.", "success");
  };

  // Billing Connection toggle
  const handleToggleStripe = () => {
    if (!dbUserId) return;
    const status = stripeStatus === "connected" ? "disconnected" : "connected";
    setStripeStatus(status);
    localStorage.setItem(`kavshare_stripe_${dbUserId}`, status);
    showToast(isKa ? "Stripe სტატუსი განახლდა" : "Stripe status updated.", "success");
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "პარამეტრები იტვირთება..." : "Loading configuration panels..."}
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
          <div className="flex justify-between items-center border-b border-slate-900 pb-6">
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1 font-mono">
                <Settings className="h-3.5 w-3.5" />
                {isKa ? "პროფილის მართვა" : "Provider Control Panel"}
              </span>
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                {isKa ? "პროფილის პარამეტრები" : "Profile Settings"}
              </h1>
            </div>

            {/* Live Preview Button */}
            {company && (
              <a
                href={`/${locale}/companies/${company.id}`}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-900 hover:bg-slate-800 text-text-primary border border-slate-800 font-bold px-4 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5"
              >
                <Eye className="h-4 w-4" />
                {isKa ? "პროფილის ნახვა" : "Live Preview"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Toast Notification Box */}
          {toast && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-xs animate-in slide-in-from-top-4 duration-300 border ${
              toast.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          )}

          {/* Settings Tab Structure */}
          <div className="grid lg:grid-cols-4 gap-8">
            
            {/* Left Tab selector */}
            <div className="lg:col-span-1 space-y-1">
              {[
                { id: "company", label: isKa ? "კომპანიის ინფორმაცია" : "Company Profile", icon: Building },
                { id: "services", label: isKa ? "სერვისების მართვა" : "Services Catalog", icon: Briefcase },
                { id: "pricing", label: isKa ? "საკომისიო & ფასები" : "Pricing & Commission", icon: DollarSign },
                { id: "billing", label: isKa ? "გადახდის მეთოდი" : "Billing Details", icon: CreditCard },
                { id: "portfolio", label: isKa ? "პორტფოლიო" : "Portfolio", icon: FolderKanban },
                { id: "account", label: isKa ? "უსაფრთხოება" : "Account Settings", icon: Settings }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-bold transition ${
                      activeTab === tab.id
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md"
                        : "text-text-muted hover:text-text-primary hover:bg-slate-900/30"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Form container */}
            <div className="lg:col-span-3 bg-slate-900/20 border border-slate-850 p-6 sm:p-8 rounded-3xl shadow-xl">
              
              {/* TAB 1: Company Profile Info */}
              {activeTab === "company" && (
                <form onSubmit={saveCompanyInfo} className="space-y-6">
                  <div className="border-b border-slate-900 pb-4">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                      {isKa ? "კომპანიის ინფორმაცია" : "Company Information Details"}
                    </h3>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Logo Image URL</label>
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        placeholder="https://example.com/logo.png"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Company Name</label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Website URL</label>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        placeholder="https://website.com"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Founded Year</label>
                      <input
                        type="number"
                        value={foundedYear}
                        onChange={(e) => setFoundedYear(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Employee Count</label>
                      <input
                        type="number"
                        value={employeeCount}
                        onChange={(e) => setEmployeeCount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Headquarters Location</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        placeholder="Tbilisi, Georgia"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Description</label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <Save className="h-4 w-4" />
                    Save Information
                  </button>
                </form>
              )}

              {/* TAB 2: Services Catalog Management */}
              {activeTab === "services" && (
                <div className="space-y-8">
                  <div className="border-b border-slate-900 pb-4">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                      {isKa ? "სერვისების მართვა" : "Services Catalog"}
                    </h3>
                  </div>

                  {/* Existing Services list */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Active Offerings</h4>
                    {services.length === 0 ? (
                      <div className="text-center py-8 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                        No service listings configured yet.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {services.map((s) => (
                          <div
                            key={s.id}
                            className="bg-slate-950/40 border border-slate-850/80 p-4 rounded-xl flex items-center justify-between gap-4 text-xs"
                          >
                            <div>
                              <strong className="block text-text-primary">{s.name}</strong>
                              <span className="text-[10px] text-text-muted font-mono uppercase">
                                Format: {s.delivery_format} / Starting: GEL {Number(s.starting_price || 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditClick(s)}
                                className="bg-slate-900 hover:bg-slate-800 text-text-secondary hover:text-text-primary border border-slate-800 p-2 rounded-xl transition"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteService(s.id)}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 p-2 rounded-xl transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add / Edit Form */}
                  <form onSubmit={handleSaveService} className="border-t border-slate-900 pt-6 space-y-4">
                    <h4 className="text-[10px] text-cyan-400 uppercase font-black tracking-widest flex items-center gap-1 font-mono">
                      <Plus className="h-3.5 w-3.5" />
                      {editingService ? "Update Active Offering" : "Add Service Listing"}
                    </h4>

                    <div className="grid sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Service Title</label>
                        <input
                          type="text"
                          required
                          value={serviceName}
                          onChange={(e) => setServiceName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Service Category</label>
                        <input
                          type="text"
                          required
                          value={serviceCategory}
                          onChange={(e) => setServiceCategory(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Delivery Format</label>
                        <select
                          value={serviceFormat}
                          onChange={(e: any) => setServiceFormat(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        >
                          <option value="fixed-price">Fixed-price</option>
                          <option value="hourly">Hourly Billing</option>
                          <option value="subscription">Subscription retainer</option>
                          <option value="custom">Custom Quotation</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Starting Price (GEL)</label>
                        <input
                          type="number"
                          value={servicePrice}
                          onChange={(e) => setServicePrice(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Required Stack / Tools (comma-separated)</label>
                      <input
                        type="text"
                        value={serviceTech}
                        onChange={(e) => setServiceTech(e.target.value)}
                        placeholder="React, AWS, Node.js"
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Service Description</label>
                      <textarea
                        rows={3}
                        value={serviceDescription}
                        onChange={(e) => setServiceDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition text-xs flex items-center gap-1.5"
                      >
                        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {editingService ? "Update offering" : "Add listing"}
                      </button>
                      {editingService && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingService(null);
                            clearServiceForm();
                          }}
                          className="bg-slate-950 border border-slate-850 text-text-primary font-bold px-4 py-2 rounded-xl transition text-xs"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: Pricing & Platform Commissions */}
              {activeTab === "pricing" && (
                <form onSubmit={savePricingSettings} className="space-y-6">
                  <div className="border-b border-slate-900 pb-4">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                      {isKa ? "საკომისიო და ფასები" : "Pricing & Commission Structure"}
                    </h3>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Commission Structure</label>
                      <select
                        value={pricingSettings.commissionStructure}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, commissionStructure: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      >
                        <option value="percentage">Percentage (10%)</option>
                        <option value="flat">Flat Platform Fee</option>
                        <option value="hybrid">Hybrid Flat/Percentage</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Default Commission Rate (%)</label>
                      <input
                        type="number"
                        value={pricingSettings.commissionRate}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, commissionRate: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">KavShare Exclusive Discount (%)</label>
                      <input
                        type="number"
                        value={pricingSettings.exclusiveDiscount}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, exclusiveDiscount: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Average Deal / Project Price (GEL)</label>
                      <input
                        type="number"
                        value={pricingSettings.avgProjectPrice}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, avgProjectPrice: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    Save Pricing Settings
                  </button>
                </form>
              )}

              {/* TAB 4: Stripe & Bank Information */}
              {activeTab === "billing" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-900 pb-4">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                      {isKa ? "საგადახდო ინფორმაცია" : "Stripe Connection & Payout details"}
                    </h3>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-850/60 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-text-primary">Stripe Connect</strong>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          stripeStatus === "connected" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-text-secondary"
                        }`}>
                          {stripeStatus}
                        </span>
                      </div>
                      <p className="text-text-muted leading-relaxed max-w-md">
                        Integrate Stripe payouts to process customer card charges directly to bank channels.
                      </p>
                    </div>

                    <button
                      onClick={handleToggleStripe}
                      className={`font-bold px-4 py-2 rounded-xl text-xs transition border ${
                        stripeStatus === "connected"
                          ? "bg-slate-900 border-slate-800 text-text-primary hover:bg-slate-850"
                          : "bg-cyan-500 border-cyan-400 text-slate-950 hover:bg-cyan-400"
                      }`}
                    >
                      {stripeStatus === "connected" ? "Disconnect Account" : "Connect Stripe Stripe"}
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 text-xs pt-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Payout Schedule Frequency</label>
                      <select
                        value={payoutSchedule}
                        onChange={(e) => setPayoutSchedule(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      >
                        <option value="weekly">Weekly Settlement</option>
                        <option value="monthly">Monthly Payouts</option>
                        <option value="manual">Manual Settlement Request</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Associated Settlement Bank Account</label>
                      <div className="bg-slate-950/80 border border-slate-850/80 p-3 rounded-xl text-text-muted flex justify-between items-center font-mono">
                        <span>Georgia BankIBAN ending **** 4920</span>
                        <Link
                          href={`/${locale}/provider/settings/bank-details`}
                          className="text-[10px] text-cyan-400 font-sans font-bold hover:underline"
                        >
                          Modify Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Portfolio & Case Studies */}
              {activeTab === "portfolio" && (
                <div className="space-y-8">
                  <div className="border-b border-slate-900 pb-4">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                      {isKa ? "პორტფოლიო და ნამუშევრები" : "Portfolio & Case Studies"}
                    </h3>
                  </div>

                  {/* Portfolio Cases List */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Recorded Cases</h4>
                    {portfolio.length === 0 ? (
                      <div className="text-center py-8 bg-slate-950/40 border border-slate-850/60 rounded-2xl text-text-muted text-xs">
                        No case studies recorded. Add items to increase lead matchmaking scores.
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {portfolio.map((item) => (
                          <div
                            key={item.id}
                            className="bg-slate-950/60 border border-slate-850 p-4.5 rounded-2xl flex flex-col justify-between gap-4 text-xs"
                          >
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-bold text-cyan-400 font-mono">Client: {item.client}</span>
                              <h5 className="font-extrabold text-text-primary">{item.title}</h5>
                              <p className="text-text-muted leading-relaxed text-[11px] line-clamp-2">{item.desc}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(item.tags || []).map((t: string, i: number) => (
                                  <span key={i} className="bg-slate-900 text-cyan-400 border border-slate-850 text-[9px] px-2 py-0.5 rounded font-mono">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteCaseStudy(item.id)}
                              className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 py-1.5 rounded-xl font-bold transition text-[10px] text-center w-full"
                            >
                              Delete Case Study
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Portfolio Item Form */}
                  <form onSubmit={handleAddCaseStudy} className="border-t border-slate-900 pt-6 space-y-4 text-xs">
                    <h4 className="text-[10px] text-cyan-400 uppercase font-black tracking-widest flex items-center gap-1 font-mono">
                      <Plus className="h-3.5 w-3.5" />
                      Add Case Study
                    </h4>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Case Title</label>
                        <input
                          type="text"
                          required
                          value={newCaseStudy.title}
                          onChange={(e) => setNewCaseStudy({ ...newCaseStudy, title: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Client Name</label>
                        <input
                          type="text"
                          required
                          value={newCaseStudy.client}
                          onChange={(e) => setNewCaseStudy({ ...newCaseStudy, client: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Tech Stack / Tools tags (comma-separated)</label>
                      <input
                        type="text"
                        value={newCaseStudy.tags}
                        onChange={(e) => setNewCaseStudy({ ...newCaseStudy, tags: e.target.value })}
                        placeholder="React, Next.js, PostgreSQL"
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Project Summary / Results Description</label>
                      <textarea
                        rows={3}
                        required
                        value={newCaseStudy.desc}
                        onChange={(e) => setNewCaseStudy({ ...newCaseStudy, desc: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-text-primary focus:outline-none focus:border-slate-700 transition resize-none leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl transition text-xs"
                    >
                      Record Case Study
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 6: Account settings & security */}
              {activeTab === "account" && (
                <div className="space-y-8">
                  <div className="border-b border-slate-900 pb-4">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                      {isKa ? "ანგარიშის პარამეტრები" : "Account Settings & Compliance"}
                    </h3>
                  </div>

                  <div className="space-y-6 text-xs">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">Registered User Email</label>
                      <input
                        type="text"
                        disabled
                        value={user?.primaryEmailAddress?.emailAddress || ""}
                        className="w-full bg-slate-950/60 border border-slate-850 text-text-muted rounded-xl p-3 cursor-not-allowed font-mono"
                      />
                    </div>

                    {/* 2FA simulated toggle */}
                    <div className="bg-slate-950/40 border border-slate-850/60 p-4 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <strong className="block text-text-primary">Two-Factor Authentication (2FA)</strong>
                        <span className="text-[10px] text-text-muted">Secure payouts with 2FA checks.</span>
                      </div>

                      <button
                        onClick={() => {
                          setTwoFactorEnabled(!twoFactorEnabled);
                          showToast(isKa ? "ორფაქტორიანი ავტორიზაციის პარამეტრი შეიცვალა" : "Two-factor setting modified.", "success");
                        }}
                        className={`px-3.5 py-1.5 rounded-xl font-bold transition text-[10px] border ${
                          twoFactorEnabled 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                            : "bg-slate-900 border-slate-800 text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {twoFactorEnabled ? "2FA Enabled" : "Enable 2FA"}
                      </button>
                    </div>

                    {/* Danger zone delete/data exports */}
                    <div className="border-t border-slate-900 pt-6 space-y-4">
                      <h4 className="text-[10px] text-red-400 uppercase font-black tracking-widest flex items-center gap-1 font-mono">
                        <ShieldAlert className="h-4 w-4" />
                        Danger Zone
                      </h4>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => alert("Your account data file request submitted. Audit logs compile time: 24h.")}
                          className="bg-slate-900 hover:bg-slate-850 text-text-secondary hover:text-text-primary border border-slate-800 font-bold px-4 py-2.5 rounded-xl transition text-xs"
                        >
                          Export Data Dump
                        </button>
                        <button
                          onClick={() => {
                            const confirmDel = confirm("WARNING: Deleting account removes all database contracts, companies listings, and records. Proceed?");
                            if (confirmDel) alert("Account deletion requires admin request processing.");
                          }}
                          className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-950 font-bold px-4 py-2.5 rounded-xl transition text-xs"
                        >
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}

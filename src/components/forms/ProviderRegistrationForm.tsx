"use client";

import {
  Building,
  Briefcase,
  TrendingUp,
  Target,
  DollarSign,
  Award,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";

import { supabase } from "@/lib/supabaseClient";

import WebsiteImportButton from "./WebsiteImportButton";

interface Service {
  category: string;
  name: string;
  description: string;
  format: string;
  tech: string[];
}

interface CaseStudy {
  title: string;
  industry: string;
  clientSize: string;
  description: string;
  results: string;
}

export default function ProviderRegistrationForm() {
  const [stage, setStage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 7-Stage State Definition
  const [formData, setFormData] = useState({
    // Stage 1
    companyName: "",
    foundedYear: new Date().getFullYear(),
    logoUrl: "",
    websiteUrl: "",
    description: "",
    // Stage 2
    services: [] as Service[],
    // Stage 3
    retentionRate: 90,
    satisfactionRating: 4.8,
    completedProjects: 10,
    yearsInBusiness: 2,
    successStories: "",
    // Stage 4
    targetSizes: [] as string[],
    targetIndustries: [] as string[],
    targetBudget: 25000,
    workingStyle: "Agile",
    // Stage 5
    pricingModel: "flat", // percentage, flat, hybrid
    pricingValue: 0,
    avgProjectPrice: 15000,
    discountRate: 10,
    paymentTerms: "Net 30",
    // Stage 6
    registrationNumber: "",
    taxId: "",
    certifications: [] as string[],
    newCert: "",
    awards: "",
    linkedinUrl: "",
    // Stage 7
    caseStudies: [] as CaseStudy[],
    bankIban: "",
    signature: "",
    acceptTerms: false,
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kavshare_provider_draft");
      if (stored) {
        setFormData(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save draft to localStorage whenever form data mutates
  const saveDraft = (data: typeof formData) => {
    try {
      localStorage.setItem("kavshare_provider_draft", JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  };

  const updateField = (fields: Partial<typeof formData>) => {
    const nextData = { ...formData, ...fields };
    setFormData(nextData);
    saveDraft(nextData);
  };

  const handleImportSuccess = (p: any) => {
    const nextData = {
      ...formData,
      companyName: p.name || formData.companyName,
      foundedYear: p.foundedYear || formData.foundedYear,
      description: p.description || formData.description,
      websiteUrl: p.website || formData.websiteUrl,
      services: p.services?.map((s: any) => ({
        category: p.category || "saas",
        name: s.name,
        description: s.description,
        format: s.format || "project",
        tech: s.tech || [],
      })) || formData.services,
      targetIndustries: p.targetClientIndustries || formData.targetIndustries,
      targetSizes: p.targetClientCompanySizes || formData.targetSizes,
      certifications: p.certifications || formData.certifications,
      linkedinUrl: p.socialLinks?.linkedin || formData.linkedinUrl,
      caseStudies: p.caseStudies?.map((cs: any) => ({
        title: cs.title,
        industry: cs.industry || "Technology",
        clientSize: cs.clientSize || "Enterprise",
        description: cs.description,
        results: "Improved workflow metrics.",
      })) || formData.caseStudies,
    };
    setFormData(nextData);
    saveDraft(nextData);
  };

  // Stage-based Validation
  const validateStage = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (stage === 1) {
      if (!formData.companyName) nextErrors.companyName = "Company Name is required";
      if (!formData.description) nextErrors.description = "Company Description is required";
    } else if (stage === 2) {
      if (formData.services.length === 0) {
        nextErrors.services = "Please add at least one service to your catalog";
      }
    } else if (stage === 5) {
      if (formData.avgProjectPrice <= 0) nextErrors.avgProjectPrice = "Please declare an average project price";
    } else if (stage === 7) {
      if (!formData.bankIban) nextErrors.bankIban = "IBAN registration is required for payouts";
      if (!formData.signature) nextErrors.signature = "Please sign/type name to consent";
      if (!formData.acceptTerms) nextErrors.acceptTerms = "You must accept terms of service commission";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStage()) {
      setStage((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setStage((prev) => prev - 1);
  };

  // Submit Final Registration Payload
  const handleSubmit = async () => {
    if (!validateStage()) return;
    setSubmitting(true);

    try {
      // 1. Create company record
      const { data: comp, error: compErr } = await supabase
        .from("companies")
        .insert({
          name: formData.companyName,
          description: formData.description,
          logo_url: formData.logoUrl || null,
          website: formData.websiteUrl || null,
          location: "Tbilisi, Georgia",
          founded_year: formData.foundedYear,
          employee_count: formData.yearsInBusiness * 5 || 10,
          status: "active",
        })
        .select()
        .single();

      if (compErr) throw compErr;

      // 2. Add services
      if (formData.services.length > 0) {
        const servicesPayload = formData.services.map((s) => ({
          company_id: comp.id,
          name: s.name,
          description: s.description,
          starting_price: formData.avgProjectPrice,
          delivery_format: s.format,
          tech_stack: s.tech,
        }));

        const { error: servErr } = await supabase.from("services").insert(servicesPayload);
        if (servErr) throw servErr;
      }

      setSuccess(true);
      localStorage.removeItem("kavshare_provider_draft");
    } catch (err: any) {
      setErrors({ submit: err.message || "Submission failed" });
    } finally {
      setSubmitting(false);
    }
  };

  // Add Service Item Helper
  const [srvTemp, setSrvTemp] = useState<Service>({
    category: "saas",
    name: "",
    description: "",
    format: "project",
    tech: [],
  });

  const addService = () => {
    if (!srvTemp.name || !srvTemp.description) {
      setErrors({ srvAdd: "Please complete service name and description before adding" });
      return;
    }
    updateField({
      services: [...formData.services, srvTemp],
    });
    setSrvTemp({
      category: "saas",
      name: "",
      description: "",
      format: "project",
      tech: [],
    });
    setErrors({});
  };

  const removeService = (idx: number) => {
    updateField({
      services: formData.services.filter((_, i) => i !== idx),
    });
  };

  if (success) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 max-w-2xl mx-auto text-center space-y-6">
        <div className="mx-auto h-16 w-16 bg-emerald-950 border border-emerald-500 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-brand-success" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">Onboarding Request Submitted!</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your agency profile has been created and verified. Our procurement audit team will review the credentials and list the services in the Marketplace within 24 hours.
        </p>
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-left text-xs space-y-2">
          <span className="font-bold text-cyan-400">Next Steps:</span>
          <p className="text-text-muted">1. Verify your billing integrations.</p>
          <p className="text-text-muted">2. Monitor the dashboard portal for direct client match requests.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto grid md:grid-cols-4 gap-8">
      {/* Sidebar Progress Steps */}
      <div className="md:col-span-1 bg-slate-900/30 border border-slate-850 rounded-2xl p-4 self-start space-y-3">
        <span className="text-[9px] uppercase font-bold text-text-muted tracking-widest block mb-2">Registration Stages</span>
        {[
          { num: 1, label: "Identity", icon: Building },
          { num: 2, label: "Services", icon: Briefcase },
          { num: 3, label: "KPIs", icon: TrendingUp },
          { num: 4, label: "Fit Model", icon: Target },
          { num: 5, label: "Rates", icon: DollarSign },
          { num: 6, label: "Credentials", icon: Award },
          { num: 7, label: "Agreement", icon: BookOpen },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
              stage === s.num
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                : stage > s.num
                ? "bg-slate-900/60 border-slate-850 text-emerald-400"
                : "bg-transparent border-transparent text-text-muted"
            }`}
          >
            <s.icon className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Form Content area */}
      <div className="md:col-span-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="border-b border-slate-850 pb-4">
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Stage {stage} of 7</span>
          <h2 className="text-xl font-bold text-text-primary mt-1">
            {stage === 1 && "Identity & Basic Information"}
            {stage === 2 && "Services & Capabilities"}
            {stage === 3 && "Performance & Success KPIs"}
            {stage === 4 && "Client Match Criteria"}
            {stage === 5 && "Pricing & Commission Terms"}
            {stage === 6 && "Vetting Credentials"}
            {stage === 7 && "Terms, Signatures & Finish"}
          </h2>
        </div>

        {/* STAGE 1 */}
        {stage === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateField({ companyName: e.target.value })}
                  placeholder="Apex Software Labs"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500"
                />
                {errors.companyName && <span className="text-[10px] text-brand-destructive">{errors.companyName}</span>}
              </div>
              <div className="w-full md:w-36 space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Founded Year</label>
                <input
                  type="number"
                  value={formData.foundedYear}
                  onChange={(e) => updateField({ foundedYear: parseInt(e.target.value) || 2026 })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <WebsiteImportButton
              onImportSuccess={handleImportSuccess}
              onImportError={(err) => setErrors({ websiteUrl: err })}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Company Description</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => updateField({ description: e.target.value })}
                placeholder="Describe your capabilities, history, and delivery guarantees..."
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-text-primary focus:outline-none focus:border-cyan-500 resize-none"
              />
              {errors.description && <span className="text-[10px] text-brand-destructive">{errors.description}</span>}
            </div>
          </div>
        )}

        {/* STAGE 2 */}
        {stage === 2 && (
          <div className="space-y-6">
            {/* List of Added Services */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary">Added Services</label>
              {formData.services.length === 0 ? (
                <div className="text-center py-6 bg-slate-950/40 border border-dashed border-slate-850 rounded-xl">
                  <p className="text-[10px] text-text-muted">No services added yet. Add at least one below.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {formData.services.map((s, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex justify-between items-start">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-cyan-400 bg-cyan-950/20 px-1.5 py-0.5 rounded capitalize">
                          {s.category} ({s.format})
                        </span>
                        <h4 className="text-xs font-bold text-text-primary mt-1.5">{s.name}</h4>
                        <p className="text-[10px] text-text-muted line-clamp-1 mt-0.5">{s.description}</p>
                      </div>
                      <button
                        onClick={() => removeService(idx)}
                        className="text-text-muted hover:text-brand-destructive transition p-1"
                        title="Delete Service"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errors.services && <span className="text-[10px] text-brand-destructive block">{errors.services}</span>}
            </div>

            {/* Add Service Section */}
            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-4">
              <span className="text-xs font-bold text-text-primary block">Add Service Item</span>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase font-bold">Category</label>
                  <select
                    value={srvTemp.category}
                    onChange={(e) => setSrvTemp({ ...srvTemp, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="saas">SaaS Dev</option>
                    <option value="design">UI/UX Design</option>
                    <option value="cloud">Cloud Integration</option>
                    <option value="data">Data Intelligence</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase font-bold">Delivery Format</label>
                  <select
                    value={srvTemp.format}
                    onChange={(e) => setSrvTemp({ ...srvTemp, format: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="project">Project Agreement</option>
                    <option value="hourly">Hourly Contract</option>
                    <option value="retainer">Monthly Retainer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-muted uppercase font-bold">Service Name</label>
                <input
                  type="text"
                  value={srvTemp.name}
                  onChange={(e) => setSrvTemp({ ...srvTemp, name: e.target.value })}
                  placeholder="Enterprise Portal Engineering"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-muted uppercase font-bold">Service Description</label>
                <textarea
                  rows={2}
                  value={srvTemp.description}
                  onChange={(e) => setSrvTemp({ ...srvTemp, description: e.target.value })}
                  placeholder="Summarize deliverables, milestones, and testing..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-text-primary focus:outline-none resize-none"
                />
              </div>

              <button
                type="button"
                onClick={addService}
                className="w-full bg-slate-900 hover:bg-slate-850 text-xs font-bold text-cyan-400 border border-slate-800 hover:border-cyan-500/40 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="h-4 w-4" /> Add Service to Catalog
              </button>
              {errors.srvAdd && <span className="text-[10px] text-brand-destructive block">{errors.srvAdd}</span>}
            </div>
          </div>
        )}

        {/* STAGE 3 */}
        {stage === 3 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Average Client Retention Rate (%)</label>
                <input
                  type="number"
                  value={formData.retentionRate}
                  onChange={(e) => updateField({ retentionRate: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Completed Projects Count</label>
                <input
                  type="number"
                  value={formData.completedProjects}
                  onChange={(e) => updateField({ completedProjects: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Client Success Stories</label>
              <textarea
                rows={4}
                value={formData.successStories}
                onChange={(e) => updateField({ successStories: e.target.value })}
                placeholder="Share brief client outcomes, savings, and performance increases..."
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-text-primary focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* STAGE 4 */}
        {stage === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary block">Target Client Company Sizes</label>
              <div className="flex gap-4">
                {["Startup", "SME", "Enterprise"].map((sz) => (
                  <label key={sz} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.targetSizes.includes(sz)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...formData.targetSizes, sz]
                          : formData.targetSizes.filter((item) => item !== sz);
                        updateField({ targetSizes: next });
                      }}
                      className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                    />
                    <span>{sz}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary block">Target Client Industries</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["Fintech", "Healthcare", "SaaS", "Retail", "Logistics", "AI Labs"].map((ind) => (
                  <label key={ind} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.targetIndustries.includes(ind)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...formData.targetIndustries, ind]
                          : formData.targetIndustries.filter((item) => item !== ind);
                        updateField({ targetIndustries: next });
                      }}
                      className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                    />
                    <span>{ind}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-text-secondary block">Target Annual Project Budget Range</label>
                <span className="text-xs font-bold text-cyan-400">${formData.targetBudget.toLocaleString()}+</span>
              </div>
              <input
                type="range"
                min="5000"
                max="250000"
                step="5000"
                value={formData.targetBudget}
                onChange={(e) => updateField({ targetBudget: parseInt(e.target.value) })}
                className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* STAGE 5 */}
        {stage === 5 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">Commission Model Choice</label>
                <select
                  value={formData.pricingModel}
                  onChange={(e) => updateField({ pricingModel: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="flat">Flat Commission Rate</option>
                  <option value="percentage">Percentage Model</option>
                  <option value="hybrid">Hybrid (flat + percentage)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">Average Project Price ($)</label>
                <input
                  type="number"
                  value={formData.avgProjectPrice}
                  onChange={(e) => updateField({ avgProjectPrice: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
                {errors.avgProjectPrice && <span className="text-[10px] text-brand-destructive">{errors.avgProjectPrice}</span>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">KavShare Exclusive Client Discount (%)</label>
                <input
                  type="number"
                  value={formData.discountRate}
                  onChange={(e) => updateField({ discountRate: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">Payout Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => updateField({ paymentTerms: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 6 */}
        {stage === 6 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">Business Registration Number</label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => updateField({ registrationNumber: e.target.value })}
                  placeholder="ID-8924018"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">Tax ID / VAT Registration</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => updateField({ taxId: e.target.value })}
                  placeholder="GE9028301"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary block">Industry Certifications & Awards</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.newCert}
                  onChange={(e) => updateField({ newCert: e.target.value })}
                  placeholder="AWS Certified Advanced Networking"
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (formData.newCert.trim()) {
                      updateField({
                        certifications: [...formData.certifications, formData.newCert.trim()],
                        newCert: "",
                      });
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 text-xs font-semibold px-4 py-2 rounded-xl text-cyan-400 hover:bg-slate-850 transition"
                >
                  Add Cert
                </button>
              </div>

              {formData.certifications.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {formData.certifications.map((c, i) => (
                    <span key={i} className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-text-secondary px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      {c}
                      <button
                        onClick={() => updateField({ certifications: formData.certifications.filter((_, idx) => idx !== i) })}
                        className="text-text-muted hover:text-cyan-400 transition"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAGE 7 */}
        {stage === 7 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">Bank Payout IBAN</label>
                <input
                  type="text"
                  value={formData.bankIban}
                  onChange={(e) => updateField({ bankIban: e.target.value })}
                  placeholder="GE29TB79124018..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
                {errors.bankIban && <span className="text-[10px] text-brand-destructive">{errors.bankIban}</span>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary block">Signature Consent (Type Name)</label>
                <input
                  type="text"
                  value={formData.signature}
                  onChange={(e) => updateField({ signature: e.target.value })}
                  placeholder="Authorized Director Name"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                />
                {errors.signature && <span className="text-[10px] text-brand-destructive">{errors.signature}</span>}
              </div>
            </div>

            <label className="flex items-start gap-3 mt-4 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => updateField({ acceptTerms: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4 mt-0.5"
              />
              <span className="leading-relaxed">
                I hereby accept the KavShare Marketplace platform integration commission agreements, guaranteeing 10% discount configurations matching project audit schedules.
              </span>
            </label>
            {errors.acceptTerms && <span className="text-[10px] text-brand-destructive block">{errors.acceptTerms}</span>}
          </div>
        )}

        {/* Global Submit Error */}
        {errors.submit && (
          <div className="bg-red-950/20 border border-red-500/30 text-xs text-brand-destructive p-3.5 rounded-xl text-center font-bold">
            {errors.submit}
          </div>
        )}

        {/* Form controls navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-850">
          {stage > 1 ? (
            <button
              onClick={handlePrev}
              className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition"
            >
              <ArrowLeft className="h-4 w-4" /> Previous Stage
            </button>
          ) : (
            <div />
          )}

          {stage < 7 ? (
            <button
              onClick={handleNext}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              Next Stage <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-extrabold px-8 py-3 rounded-xl text-xs flex items-center gap-1.5 transition hover:from-cyan-400 hover:to-emerald-400"
            >
              {submitting ? "Submitting..." : "Complete Registration"} <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple internal helper component
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

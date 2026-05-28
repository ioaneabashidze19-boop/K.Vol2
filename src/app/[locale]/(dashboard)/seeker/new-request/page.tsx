"use client";

import {
  FileText,
  AlertCircle,
  Code,
  ShieldCheck,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  FileCode,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function NewRequestPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [matchCount, setMatchCount] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    title: "",
    description: "",
    urgency: "Medium", // Low, Medium, High, Critical
    startDate: "",
    duration: "3-6 months",

    // Step 2: Services
    category: "saas",
    requiredTech: [] as string[],
    niceToHaveTech: [] as string[],

    // Step 3: Company Profile
    companySize: "11-50",
    industry: "Fintech",
    budgetRange: 50000,
    budgetType: "Project-based", // Hourly, Project-based, Retainer
    requireNda: false,

    // Step 4: Compliance & Preferences
    compliance: [] as string[],
    commMethod: "Slack",
    pmStyle: "Agile",
    timezonePref: "UTC+4 (Georgia)",
    teamSize: "3-5 developers",

    // Step 5: Attachments
    files: [] as string[], // Mock file names
  });

  // Autocomplete Tech Helper
  const [techInput, setTechInput] = useState("");
  const [techSuggestions, setTechSuggestions] = useState<string[]>([]);
  const allTech = ["React", "Next.js", "TypeScript", "Node.js", "Python", "Go", "AWS", "Supabase", "PostgreSQL", "Docker"];

  useEffect(() => {
    if (techInput.trim()) {
      const filtered = allTech.filter(
        (t) => t.toLowerCase().includes(techInput.toLowerCase()) && !formData.requiredTech.includes(t)
      );
      setTechSuggestions(filtered);
    } else {
      setTechSuggestions([]);
    }
  }, [techInput, formData.requiredTech]);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kavshare_procurement_draft");
      if (stored) {
        setFormData(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Autosave timer (every 30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem("kavshare_procurement_draft", JSON.stringify(formData));
        console.log("[ProcurementRequest] Draft autosaved to localStorage.");
      } catch {
        // Ignore storage errors
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [formData]);

  // Dynamic Match Count Preview simulation
  useEffect(() => {
    let count = 15;
    if (formData.requiredTech.length > 0) count -= 2 * formData.requiredTech.length;
    if (formData.budgetRange < 20000) count -= 4;
    if (formData.requireNda) count -= 2;
    if (formData.compliance.length > 0) count -= 3 * formData.compliance.length;
    setMatchCount(Math.max(1, count));
  }, [formData.requiredTech, formData.budgetRange, formData.requireNda, formData.compliance]);

  const updateField = (fields: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleNext = () => {
    // Validate current step
    const nextErrors: Record<string, string> = {};
    if (activeStep === 1) {
      if (!formData.title) nextErrors.title = "Project Title is required";
      if (!formData.description) nextErrors.description = "Detailed project description is required";
      if (!formData.startDate) nextErrors.startDate = "Start Date is required";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setActiveStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // Simulate API request delays
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      localStorage.removeItem("kavshare_procurement_draft");
      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const addTech = (t: string) => {
    updateField({ requiredTech: [...formData.requiredTech, t] });
    setTechInput("");
  };

  const removeTech = (t: string) => {
    updateField({ requiredTech: formData.requiredTech.filter((item) => item !== t) });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setErrors({ file: "File exceeds 10MB limit" });
        return;
      }
      updateField({ files: [...formData.files, file.name] });
      setErrors({});
    }
  };

  if (success) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 max-w-xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-emerald-950 border border-emerald-500 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-brand-success" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Request Posted Successfully!</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your B2B procurement match criteria has been recorded. KavShare's smart matching engine identified{" "}
            <span className="font-extrabold text-cyan-400">{matchCount} service providers</span> matching your parameters.
          </p>
          <button
            onClick={() => router.push("/marketplace")}
            className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black py-3 rounded-xl text-xs transition"
          >
            Explore Matched Providers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-850 pb-6">
        <div>
          <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Dashboard / Seeker</span>
          <h1 className="text-3xl font-black text-text-primary tracking-tight mt-1">Post New Procurement Request</h1>
          <p className="text-xs text-text-muted mt-0.5">Define your project parameters to get matched with pre-vetted agencies.</p>
        </div>

        {/* Dynamic Match Badge */}
        <div className="bg-slate-900/60 border border-slate-800 px-5 py-3 rounded-2xl flex items-center gap-4">
          <div>
            <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block">Estimated Matches</span>
            <span className="text-xl font-black text-cyan-400">{matchCount} agencies</span>
          </div>
          <Sparkles className="h-6 w-6 text-cyan-400 animate-pulse" />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-8">
        {/* Step Steps Selector */}
        <div className="md:col-span-1 space-y-3">
          {[
            { step: 1, label: "Basic Info", icon: FileText },
            { step: 2, label: "Services & Tech", icon: Code },
            { step: 3, label: "Company & Budget", icon: Sparkles },
            { step: 4, label: "Compliance", icon: ShieldCheck },
            { step: 5, label: "Attachments", icon: UploadCloud },
            { step: 6, label: "Review & Submit", icon: CheckCircle },
          ].map((s) => (
            <button
              key={s.step}
              onClick={() => setActiveStep(s.step)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                activeStep === s.step
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                  : activeStep > s.step
                  ? "bg-slate-900/60 border-slate-850 text-emerald-400"
                  : "bg-transparent border-transparent text-text-muted"
              }`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Steps Forms container */}
        <div className="md:col-span-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          {/* STEP 1: Basic Info */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Project Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField({ title: e.target.value })}
                  placeholder="Need Enterprise Next.js SaaS portal development"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500"
                />
                {errors.title && <span className="text-[10px] text-brand-destructive">{errors.title}</span>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Project Description Brief</label>
                <textarea
                  rows={6}
                  value={formData.description}
                  onChange={(e) => updateField({ description: e.target.value })}
                  placeholder="Specify key details, integrations, timelines, and deliverables..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-text-primary focus:outline-none focus:border-cyan-500 resize-none"
                />
                {errors.description && <span className="text-[10px] text-brand-destructive">{errors.description}</span>}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Urgency Level</label>
                  <select
                    value={formData.urgency}
                    onChange={(e) => updateField({ urgency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Target Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateField({ startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                  />
                  {errors.startDate && <span className="text-[10px] text-brand-destructive block">{errors.startDate}</span>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Estimated Duration</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => updateField({ duration: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="1-3 months">1-3 months</option>
                    <option value="3-6 months">3-6 months</option>
                    <option value="6-12 months">6-12 months</option>
                    <option value="12+ months">12+ months</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Services & Tech */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Primary Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => updateField({ category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="saas">SaaS & Custom Software</option>
                  <option value="design">UI/UX & Brand Design</option>
                  <option value="cloud">Cloud Architecture</option>
                  <option value="data">Data Engineering & Analytics</option>
                </select>
              </div>

              {/* Autocomplete Tech */}
              <div className="space-y-2 relative">
                <label className="text-xs font-semibold text-text-secondary">Required Technologies</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    placeholder="Search e.g. Next.js, Postgres"
                    className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-text-primary focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {techSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl z-20 overflow-hidden shadow-2xl max-h-36 overflow-y-auto">
                    {techSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => addTech(s)}
                        className="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-slate-900 transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {formData.requiredTech.length === 0 ? (
                    <span className="text-[10px] text-text-muted italic">No technologies added yet.</span>
                  ) : (
                    formData.requiredTech.map((t) => (
                      <span key={t} className="bg-cyan-950/20 border border-cyan-800/40 text-[10px] font-bold text-cyan-400 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                        {t}
                        <button
                          onClick={() => removeTech(t)}
                          className="hover:text-cyan-200 transition text-[9px]"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Company Profile & Budget */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Your Company Size</label>
                  <select
                    value={formData.companySize}
                    onChange={(e) => updateField({ companySize: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="200+">200+ employees</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Industry Vertical</label>
                  <select
                    value={formData.industry}
                    onChange={(e) => updateField({ industry: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="Fintech">Fintech</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="SaaS">SaaS</option>
                    <option value="Retail">Retail</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Budget Type</label>
                  <select
                    value={formData.budgetType}
                    onChange={(e) => updateField({ budgetType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="Hourly">Hourly rates</option>
                    <option value="Project-based">Project-based fixed price</option>
                    <option value="Retainer">Monthly Retainer</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-text-secondary">Estimated Project Budget</label>
                    <span className="text-xs font-black text-cyan-400">${formData.budgetRange.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="150000"
                    step="5000"
                    value={formData.budgetRange}
                    onChange={(e) => updateField({ budgetRange: parseInt(e.target.value) })}
                    className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requireNda}
                    onChange={(e) => updateField({ requireNda: e.target.checked })}
                    className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                  />
                  <span>NDA/Confidential agreement required before matching matches</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: Compliance & PM style */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary block">Compliance Certifications Required</label>
                <div className="flex flex-wrap gap-4">
                  {["GDPR", "HIPAA", "ISO 27001", "SOC2"].map((c) => (
                    <label key={c} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.compliance.includes(c)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.compliance, c]
                            : formData.compliance.filter((item) => item !== c);
                          updateField({ compliance: next });
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Preferred Working Framework</label>
                  <select
                    value={formData.pmStyle}
                    onChange={(e) => updateField({ pmStyle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="Agile">Agile Scrum sprints</option>
                    <option value="Kanban">Kanban backlog flow</option>
                    <option value="Flexible">Flexible/Custom workflow</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary">Timezone Preference</label>
                  <select
                    value={formData.timezonePref}
                    onChange={(e) => updateField({ timezonePref: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="UTC+4 (Georgia)">UTC+4 (Georgia)</option>
                    <option value="Europe Timezones">Europe (CET/EET)</option>
                    <option value="USA Timezones">USA (EST/PST)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Attachments */}
          {activeStep === 5 && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-text-secondary">Upload Brief / RFP Document</label>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-800 hover:border-cyan-500/40 bg-slate-950/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition"
              >
                <UploadCloud className="h-10 w-10 text-cyan-400 mb-3" />
                <span className="text-xs font-bold text-text-primary">Drag & drop brief document here</span>
                <span className="text-[10px] text-text-muted mt-1">Supports PDF, DOCX, ZIP files up to 10MB</span>
              </div>
              {errors.file && <span className="text-[10px] text-brand-destructive block">{errors.file}</span>}

              {formData.files.length > 0 && (
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] text-text-muted uppercase font-bold">Attached Files</label>
                  {formData.files.map((f, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-text-secondary flex items-center gap-2">
                        <FileCode className="h-3.5 w-3.5 text-cyan-400" /> {f}
                      </span>
                      <button
                        onClick={() => updateField({ files: formData.files.filter((_, idx) => idx !== i) })}
                        className="text-[10px] text-brand-destructive font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Review & Submit */}
          {activeStep === 6 && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-text-primary block border-b border-slate-850 pb-2">Request Overview</span>
                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-text-muted block">Project Title</span>
                    <span className="text-text-secondary font-semibold">{formData.title || "Not defined"}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Urgency</span>
                    <span className="text-cyan-400 font-semibold">{formData.urgency}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Target Budget</span>
                    <span className="text-emerald-400 font-semibold">${formData.budgetRange.toLocaleString()} ({formData.budgetType})</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Required Stack</span>
                    <span className="text-text-secondary font-semibold">
                      {formData.requiredTech.join(", ") || "None selected"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-950/10 border border-cyan-800/20 p-4 rounded-2xl text-xs flex gap-3 text-cyan-400">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Upon submission, pre-vetted matching service providers will receive your anonymous brief. You will be redirected to filter matches immediately.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-850">
            {activeStep > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {activeStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-bold px-6 py-2.5 rounded-xl text-cyan-400 flex items-center gap-1.5 transition"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black px-8 py-3 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {submitting ? "Posting Request..." : "Post & Find Matches"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

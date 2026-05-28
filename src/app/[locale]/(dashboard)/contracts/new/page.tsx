"use client";

import {
  FileText,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  UserCheck,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";

interface NewContractPageProps {
  params: Promise<{
    locale: string;
  }>;
}

function ContractForm({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEngagementId = searchParams.get("engagement_id") || "";

  // Form State
  const [engagements, setEngagements] = useState<any[]>([]);
  const [loadingEngagements, setLoadingEngagements] = useState(true);
  
  const [title, setTitle] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [category, setCategory] = useState("saas");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [isOngoing, setIsOngoing] = useState(true);
  const [valueType, setValueType] = useState<"retainer" | "project" | "hourly" | "hybrid">("retainer");
  const [monthlyValue, setMonthlyValue] = useState(5000);
  const [contractDurationMonths, setContractDurationMonths] = useState(12);
  const [commissionType, setCommissionType] = useState<"percentage" | "flat" | "hybrid">("percentage");
  const [commissionValue, setCommissionValue] = useState(10); // 10%
  const [exclusiveDiscount, setExclusiveDiscount] = useState(5); // 5% discount
  const [specialTerms, setSpecialTerms] = useState("");

  // Signatures
  const [seekerSigned, setSeekerSigned] = useState(false);
  const [providerSigned, setProviderSigned] = useState(false);

  // Wizard Mode: 'form' | 'review' | 'success'
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const [submitting, setSubmitting] = useState(false);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);

  useEffect(() => {
    async function loadEngagements() {
      setLoadingEngagements(true);
      try {
        const { data, error } = await supabase
          .from("engagements")
          .select(`
            id, status, engagement_type,
            seekers (id, company_name),
            companies (id, name)
          `)
          .eq("status", "pending");

        if (!error && data) {
          setEngagements(data);
          // Auto select prefilled or first engagement
          if (prefilledEngagementId) {
            setEngagementId(prefilledEngagementId);
          } else if (data.length > 0) {
            setEngagementId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed loading pending engagements", err);
      } finally {
        setLoadingEngagements(false);
      }
    }

    loadEngagements();
  }, [prefilledEngagementId]);

  // Compute calculated commission schedules preview
  const generatePreviewSchedules = () => {
    const schedules = [];
    const monthsCount = isOngoing ? contractDurationMonths : Math.min(contractDurationMonths, 24);
    
    // Base amount for commission
    let baseAmount = monthlyValue;
    if (valueType === "project") {
      baseAmount = monthlyValue / monthsCount; // Distribute total value over months
    }

    let calculatedRate = commissionValue;
    if (commissionType === "flat") {
      calculatedRate = (commissionValue / baseAmount) * 100;
    } else if (commissionType === "hybrid") {
      calculatedRate = commissionValue + 2; // Flat fee added as additional percent weight
    }

    const discountedBaseAmount = baseAmount * (1 - exclusiveDiscount / 100);
    const expectedCommission = discountedBaseAmount * (calculatedRate / 100);

    const start = new Date(startDate);

    for (let i = 0; i < monthsCount; i++) {
      const currentMonth = new Date(start.getFullYear(), start.getMonth() + i, 1);
      schedules.push({
        month: currentMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        payment: discountedBaseAmount,
        commission: expectedCommission,
      });
    }

    return schedules;
  };

  const previewSchedules = generatePreviewSchedules();
  const totalExpectedCommission = previewSchedules.reduce((sum, item) => sum + item.commission, 0);

  const selectedEngagement = engagements.find((e) => e.id === engagementId);

  const handleExecuteContract = async () => {
    if (!seekerSigned || !providerSigned) return;
    setSubmitting(true);

    try {
      // 1. Create a placeholder special offer for KavShare discount if applicable
      let specialOfferId = null;
      if (exclusiveDiscount > 0 && selectedEngagement?.companies?.id) {
        const { data: offerData } = await supabase
          .from("special_offers")
          .insert({
            company_id: selectedEngagement.companies.id,
            name: `Exclusive ${exclusiveDiscount}% Matching Discount`,
            discount_type: "percentage",
            discount_value: exclusiveDiscount,
            active: true,
          })
          .select()
          .single();
        if (offerData) {
          specialOfferId = offerData.id;
        }
      }

      // 2. Create the contract record in DB
      const { data: contract, error: contractErr } = await supabase
        .from("contracts")
        .insert({
          engagement_id: engagementId,
          special_offer_id: specialOfferId,
          status: "active", // execute immediately
          start_date: startDate,
          end_date: isOngoing ? null : endDate || null,
          monthly_value: monthlyValue,
          commission_rate: commissionValue,
        })
        .select()
        .single();

      if (contractErr) throw contractErr;

      // 3. Call DB RPC generate_commission_schedules function
      const { error: rpcErr } = await supabase.rpc(
        "generate_commission_schedules",
        {
          p_contract_id: contract.id,
        }
      );

      if (rpcErr) throw rpcErr;

      // 4. Update the engagement status to 'active'
      const { error: engErr } = await supabase
        .from("engagements")
        .update({ status: "active" })
        .eq("id", engagementId);

      if (engErr) throw engErr;

      setCreatedContractId(contract.id);
      setStep("success");
    } catch (err) {
      console.error("Failed creating and executing contract document:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wizard Progression Headers */}
      <div className="flex items-center gap-3 text-xs text-text-muted pb-2 border-b border-slate-900">
        <span className={`${step === "form" ? "text-cyan-400 font-extrabold" : ""}`}>1. Define Terms</span>
        <ChevronRight className="h-3 w-3" />
        <span className={`${step === "review" ? "text-cyan-400 font-extrabold" : ""}`}>2. Sign & Review</span>
        <ChevronRight className="h-3 w-3" />
        <span className={`${step === "success" ? "text-emerald-400 font-extrabold" : ""}`}>3. Executed</span>
      </div>

      {step === "form" && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Platform Ledger Systems
            </span>
            <h1 className="text-xl font-black text-text-primary tracking-tight">Create B2B Engagement Contract</h1>
            <p className="text-xs text-text-muted">Draft structured retainer terms, service models, and commission tiers.</p>
          </div>

          {/* Contract Title */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary">Contract Title</label>
            <input
              type="text"
              placeholder="e.g. Apex Software Labs CRM Service Agreement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Engagement select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary">Select Associated Match / Engagement</label>
              {loadingEngagements ? (
                <div className="h-10 bg-slate-950 animate-pulse border border-slate-850 rounded-xl" />
              ) : engagements.length === 0 ? (
                <select disabled className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-muted">
                  <option>No pending matches found</option>
                </select>
              ) : (
                <select
                  value={engagementId}
                  onChange={(e) => setEngagementId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-cyan-500"
                >
                  {engagements.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.seekers?.company_name || "Seeker"} / {eng.companies?.name || "Provider"} ({eng.engagement_type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Service category */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary">Service Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
              >
                <option value="saas">SaaS & MVP Engineering</option>
                <option value="design">UI/UX Creative Design</option>
                <option value="marketing">B2B Growth Marketing</option>
                <option value="consulting">IT Infrastructure & Cloud</option>
              </select>
            </div>
          </div>

          {/* Dates & Duration */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary">Duration Term</label>
              <select
                value={contractDurationMonths}
                onChange={(e) => setContractDurationMonths(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (Standard)</option>
                <option value={24}>24 Months (Enterprise)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary">Contract Type</label>
              <div className="flex items-center gap-4 h-10">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOngoing}
                    onChange={(e) => setIsOngoing(e.target.checked)}
                    className="rounded border-slate-850 bg-slate-950 text-cyan-500 focus:ring-0"
                  />
                  Ongoing Retainer
                </label>
              </div>
            </div>
          </div>

          {!isOngoing && (
            <div className="grid md:grid-cols-3 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Pricing Structures */}
          <div className="border-t border-slate-850/60 pt-4 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">Billing Structure</label>
                <select
                  value={valueType}
                  onChange={(e: any) => setValueType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
                >
                  <option value="retainer">Monthly Retainer</option>
                  <option value="project">Project-based (Fixed)</option>
                  <option value="hourly">Hourly Rate Billing</option>
                  <option value="hybrid">Hybrid Delivery Model</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">
                  {valueType === "project" ? "Total Contract Value ($)" : "Monthly Retainer / Starting Cost ($)"}
                </label>
                <input
                  type="number"
                  value={monthlyValue}
                  onChange={(e) => setMonthlyValue(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">KavShare Exclusive Discount (%)</label>
                <input
                  type="number"
                  value={exclusiveDiscount}
                  onChange={(e) => setExclusiveDiscount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Commissions Ledger Settings */}
          <div className="border-t border-slate-850/60 pt-4 space-y-4">
            <h3 className="text-xs uppercase font-extrabold text-text-muted tracking-wider">KavShare Commission Allocation</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">Commission Tiers Structure</label>
                <select
                  value={commissionType}
                  onChange={(e: any) => setCommissionType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
                >
                  <option value="percentage">Percentage-based (Standard 10%)</option>
                  <option value="flat">Flat Platform Fee ($X/month)</option>
                  <option value="hybrid">Hybrid (Tiers + Commission)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">
                  {commissionType === "flat" ? "Flat Fee Amount ($)" : "Commission Percentage (%)"}
                </label>
                <input
                  type="number"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary">Special Notes / Deliverables Terms</label>
            <textarea
              rows={3}
              placeholder="List specific milestones, cancellation criteria, or hours reporting guarantees..."
              value={specialTerms}
              onChange={(e) => setSpecialTerms(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none resize-none"
            />
          </div>

          {/* Next Action */}
          <div className="pt-4 flex justify-end">
            <button
              onClick={() => setStep("review")}
              disabled={!title.trim() || !engagementId}
              className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-xs flex items-center gap-1.5 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              Review Ledger Schedule <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
          <div>
            <h2 className="text-lg font-black text-text-primary tracking-tight">Review Terms & Commission Schedule</h2>
            <p className="text-xs text-text-muted mt-1">Review estimated monthly billing statements and contract conditions.</p>
          </div>

          {/* Summary Details */}
          <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-3 text-xs">
            <h3 className="font-bold text-text-primary border-b border-slate-850 pb-2">{title}</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-text-secondary">
              <div>
                <span className="text-[10px] text-text-muted">Associated Engagement:</span>
                <span className="block font-medium mt-0.5">
                  {selectedEngagement?.seekers?.company_name} & {selectedEngagement?.companies?.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted">Billing Commences:</span>
                <span className="block font-medium mt-0.5">{startDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted">Value Type:</span>
                <span className="block font-medium mt-0.5 capitalize">{valueType}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted">Platform Tiers:</span>
                <span className="block font-medium mt-0.5 capitalize">
                  {commissionType === "percentage" ? `${commissionValue}% Tiers` : `$${commissionValue}/month`}
                </span>
              </div>
            </div>
          </div>

          {/* Schedules Preview Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-cyan-400" /> Projected Commission Ledger Schedule
            </h4>
            <div className="bg-slate-950/80 border border-slate-850 rounded-2xl overflow-hidden max-h-[250px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-850 text-text-muted text-[10px] uppercase font-bold">
                    <th className="p-3">Month</th>
                    <th className="p-3 text-right">Expected Payment</th>
                    <th className="p-3 text-right">Platform Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {previewSchedules.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-850/40 text-text-secondary">
                      <td className="p-3 font-semibold text-text-primary">{row.month}</td>
                      <td className="p-3 text-right">${row.payment.toFixed(2)}</td>
                      <td className="p-3 text-right text-cyan-400 font-medium">${row.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl text-xs">
              <span className="text-text-muted font-medium">Aggregate Platform Commission (24m Max):</span>
              <span className="font-extrabold text-cyan-400 text-sm">${totalExpectedCommission.toFixed(2)}</span>
            </div>
          </div>

          {/* Signature checkbox checks */}
          <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-cyan-400" /> Dual-Signature Verification
            </h4>
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={seekerSigned}
                  onChange={(e) => setSeekerSigned(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 mt-0.5"
                />
                <span>
                  Seeker Signature: I accept the billing terms and confirm the engagement terms mapping on behalf of{" "}
                  <strong>{selectedEngagement?.seekers?.company_name || "Seeker"}</strong>.
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerSigned}
                  onChange={(e) => setProviderSigned(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 mt-0.5"
                />
                <span>
                  Provider Signature: I accept the 10% platform commission matching agreement and release schedules on behalf of{" "}
                  <strong>{selectedEngagement?.companies?.name || "Provider"}</strong>.
                </span>
              </label>
            </div>
          </div>

          {/* Review Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep("form")}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold px-6 py-3 rounded-xl transition text-text-secondary"
            >
              Modify Terms
            </button>

            <button
              onClick={handleExecuteContract}
              disabled={submitting || !seekerSigned || !providerSigned}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              {submitting ? "Signing & Executing..." : "Sign & Execute Contract"}
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-8 text-center space-y-6 max-w-lg mx-auto backdrop-blur-md">
          <div className="h-16 w-16 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg">
            <CheckCircle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-text-primary tracking-tight">Contract Executed Successfully!</h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Dual signature verified. Platform commission schedules have been initialized inside the financial ledger database.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl text-xs text-left space-y-1">
            <span className="text-text-muted">Contract ID:</span>
            <code className="text-[10px] text-cyan-400 block font-mono break-all">{createdContractId}</code>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push(`/${locale}`)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold py-2.5 rounded-xl text-text-secondary transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.push(`/${locale}/contracts/ledger`)}
              className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-extrabold py-2.5 rounded-xl text-xs transition"
            >
              View Commission Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewContractPage({ params }: NewContractPageProps) {
  const resolvedParams = use(params);
  const currentLocale = resolvedParams.locale;

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
      <div className="max-w-4xl mx-auto px-6 pt-8 space-y-6">
        
        {/* Back Link */}
        <Link
          href={`/${currentLocale}`}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-cyan-400 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>

        <Suspense fallback={<div className="flex-1 flex justify-center items-center py-32 bg-slate-950 text-slate-100"><div className="h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" /></div>}>
          <ContractForm locale={currentLocale} />
        </Suspense>

      </div>
    </div>
  );
}

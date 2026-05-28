"use client";

import { use, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { 
  Building2, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck, 
  Trash2,
  RefreshCw,
  ArrowLeft
} from "lucide-react";
import { useRouter } from "next/navigation";

interface BankDetailsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

const GEORGIAN_BANKS = [
  { nameEn: "TBC Bank (JSC Georgian-American Bank)", nameKa: "თიბისი ბანკი", code: "TBC" },
  { nameEn: "Bank of Georgia", nameKa: "საქართველოს ბანკი", code: "BOG" },
  { nameEn: "Liberty Bank", nameKa: "ლიბერთი ბანკი", code: "LBRT" },
  { nameEn: "ProCredit Bank", nameKa: "პროკრედიტ ბანკი", code: "PRCD" },
  { nameEn: "Credo Bank", nameKa: "კრედო ბანკი", code: "CREDO" },
  { nameEn: "Cartu Bank", nameKa: "ქართუ ბანკი", code: "CRTU" },
  { nameEn: "Silk Road Bank", nameKa: "სილქ როუდ ბანკი", code: "SRB" },
  { nameEn: "Other Bank", nameKa: "სხვა ბანკი", code: "OTHER" },
];

export default function ProviderBankDetailsPage({ params }: BankDetailsPageProps) {
  const { locale } = use(params);
  const isKa = locale === "ka";
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();

  // Database / State variables
  const [company, setCompany] = useState<any>(null);
  const [bankAccount, setBankAccount] = useState<any>(null);
  const [lastTransfer, setLastTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit / Input form variables
  const [isEditing, setIsEditing] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [iban, setIban] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [currency, setCurrency] = useState("GEL");

  // Form states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Confirmation state for deleting
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load User, Company, and Bank Account on mount / auth load
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    async function loadData() {
      setLoading(true);
      try {
        // 1. Fetch Supabase user linked to Clerk ID
        const { data: suUser, error: suUserErr } = await supabase
          .from("users")
          .select("id, email, clerk_id")
          .eq("clerk_id", user?.id)
          .single();

        if (suUserErr || !suUser) {
          console.error("No Supabase user mapped to Clerk user:", suUserErr);
          setLoading(false);
          return;
        }

        // 2. Fetch company owned by this user
        const { data: comp, error: compErr } = await supabase
          .from("companies")
          .select("id, name")
          .eq("owner_id", suUser.id)
          .single();

        if (compErr || !comp) {
          console.error("No company registered for this provider:", compErr);
          setLoading(false);
          return;
        }
        setCompany(comp);

        // 3. Fetch active bank account linked to company
        const { data: bankAcc } = await supabase
          .from("company_bank_accounts")
          .select("*")
          .eq("company_id", comp.id)
          .single();

        if (bankAcc) {
          setBankAccount(bankAcc);
          // Populate fields
          setBankName(bankAcc.bank_name || "");
          setAccountHolderName(bankAcc.account_holder_name || "");
          setIban(formatIBAN(bankAcc.iban || ""));
          setAccountNumber(bankAcc.account_number || "");
          setSwiftCode(bankAcc.swift_code || "");
          setCurrency(bankAcc.currency || "GEL");

          // 4. Fetch last transfer details for display status
          const { data: lastTx } = await supabase
            .from("wise_transfers")
            .select("created_at, target_amount, status")
            .eq("company_id", comp.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (lastTx) {
            setLastTransfer(lastTx);
          }
        } else {
          setIsEditing(true); // default to form if no account exists
        }
      } catch (err) {
        console.error("Error loading bank details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isLoaded, isSignedIn, user]);

  // Format IBAN with spaces
  function formatIBAN(raw: string): string {
    const clean = raw.replace(/\s+/g, "").toUpperCase();
    return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
  }

  const handleIBANChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIban(formatIBAN(e.target.value));
    if (formErrors.iban) {
      setFormErrors((prev) => ({ ...prev, iban: "" }));
    }
  };

  // Mask string helper: keeps first 4 and last 4, masks the rest
  function maskValue(value: string, keepCount = 4): string {
    if (!value) return "";
    const clean = value.replace(/\s+/g, "");
    if (clean.length <= keepCount * 2) return value;
    const first = clean.substring(0, keepCount);
    const last = clean.substring(clean.length - keepCount);
    const mask = "•".repeat(clean.length - keepCount * 2);
    return `${first}${mask}${last}`;
  }

  // Client-side quick validator
  function validateForm() {
    const errors: Record<string, string> = {};
    const cleanIban = iban.replace(/\s+/g, "").toUpperCase();
    
    if (!accountHolderName.trim()) {
      errors.accountHolderName = isKa 
        ? "ანგარიშის მფლობელის სახელი სავალდებულოა" 
        : "Account holder name is required";
    }
    if (!cleanIban) {
      errors.iban = isKa ? "IBAN სავალდებულოა" : "IBAN is required";
    } else if (!/^GE\d{2}[A-Z0-9]{18}$/i.test(cleanIban)) {
      errors.iban = isKa 
        ? "არასწორი ქართული IBAN ფორმატი. უნდა იწყებოდეს GE-ით და შეიცავდეს 22 სიმბოლოს." 
        : "Invalid Georgian IBAN format (must start with GE and contain 22 characters)";
    }
    if (accountNumber && accountNumber.replace(/\s+/g, "").length < 6) {
      errors.accountNumber = isKa 
        ? "ანგარიშის ნომერი უნდა იყოს მინიმუმ 6 სიმბოლო" 
        : "Account number should be at least 6 characters";
    }
    if (swiftCode && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/i.test(swiftCode.trim())) {
      errors.swiftCode = isKa 
        ? "არასწორი SWIFT/BIC კოდის ფორმატი (8 ან 11 სიმბოლო)" 
        : "Invalid SWIFT/BIC code format (should be 8 or 11 characters)";
    }
    if (!bankName) {
      errors.bankName = isKa ? "გთხოვთ აირჩიოთ ბანკი" : "Please select your bank";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Action: Verify Bank Details against Wise & Georgian standards
  async function handleVerify() {
    if (!validateForm()) return;
    setVerifying(true);
    setVerificationResult(null);

    try {
      const res = await fetch("/api/wise/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iban: iban.replace(/\s+/g, "").toUpperCase(),
          swiftCode: swiftCode.trim().toUpperCase(),
          bankName,
          accountHolderName,
        }),
      });

      const data = await res.json();
      if (data.valid) {
        setVerificationResult({
          success: true,
          message: isKa ? data.messageKa : data.messageEn,
        });
      } else {
        setVerificationResult({
          success: false,
          message: isKa ? data.errorKa : data.errorEn,
        });
      }
    } catch (err: any) {
      setVerificationResult({
        success: false,
        message: isKa 
          ? "Wise კავშირის შემოწმება ვერ მოხერხდა" 
          : "Could not test connection to Wise API.",
      });
    } finally {
      setVerifying(false);
    }
  }

  // Action: Save / Update details in Database
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        account_holder_name: accountHolderName.trim(),
        iban: iban.replace(/\s+/g, "").toUpperCase(),
        bank_name: bankName,
        currency,
        country: "GE",
        account_number: accountNumber.trim() || null,
        swift_code: swiftCode.trim().toUpperCase() || null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("company_bank_accounts")
        .upsert(payload, { onConflict: "company_id" })
        .select()
        .single();

      if (error) throw error;

      setBankAccount(data);
      setIsEditing(false);
      setVerificationResult(null);
    } catch (err: any) {
      console.error("Failed to save bank account:", err);
      alert(isKa ? "ანგარიშის შენახვა ვერ მოხერხდა" : "Failed to save bank account details.");
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Remove Bank Account
  async function handleDelete() {
    if (!bankAccount) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("company_bank_accounts")
        .delete()
        .eq("id", bankAccount.id);

      if (error) throw error;

      setBankAccount(null);
      setLastTransfer(null);
      setIban("");
      setAccountHolderName("");
      setAccountNumber("");
      setSwiftCode("");
      setBankName("");
      setIsEditing(true);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(isKa ? "წაშლა ვერ მოხერხდა" : "Failed to remove payout account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32 bg-slate-950 text-slate-100 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-xs text-text-muted">
            {isKa ? "მონაცემები იტვირთება..." : "Loading bank details..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 pb-24 min-h-screen">
      <div className="max-w-4xl mx-auto px-6 pt-8 space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-6">
          <div>
            <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-widest flex items-center gap-1">
              <Building2 className="h-3 w-3" /> 
              {isKa ? "საპარტნიორო ანგარიშები" : "Provider Settings"}
            </span>
            <h1 className="text-2xl font-black text-text-primary tracking-tight">
              {isKa ? "პაუტის მონაცემები" : "Payout Bank Details"}
            </h1>
            <p className="text-xs text-text-muted mt-1">
              {isKa 
                ? "მართეთ თქვენი ქართული საბანკო ანგარიშები საკომისიოების მისაღებად." 
                : "Manage your Georgian payout accounts to receive automatic commissions."}
            </p>
          </div>
          <button
            onClick={() => router.push(`/${locale}/provider/commissions`)}
            className="bg-slate-900 border border-slate-800 text-xs font-bold px-3 py-2 rounded-xl text-text-secondary hover:bg-slate-850 hover:text-text-primary transition flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {isKa ? "უკან დაბრუნება" : "Back to Ledger"}
          </button>
        </div>

        {/* Dynamic Layout: Details Card or Form */}
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Main Action Block */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Status Section (Display Card if exists and not editing) */}
            {bankAccount && !isEditing ? (
              <div className="bg-slate-900/40 border border-slate-850 rounded-3xl overflow-hidden shadow-xl">
                
                {/* Status bar */}
                <div className="bg-emerald-950/20 border-b border-slate-850 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-text-primary">
                        {isKa ? "ანგარიში დადასტურებულია" : "Payout Account Verified"}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {isKa ? "მზად არის ავტომატური გადარიცხვებისთვის" : "Ready for automatic commission transfers"}
                      </p>
                    </div>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {isKa ? "აქტიური" : "Active"}
                  </span>
                </div>

                {/* Account details */}
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">
                        {isKa ? "ბანკის სახელი" : "Bank Name"}
                      </span>
                      <p className="font-semibold text-text-primary mt-0.5">
                        {isKa 
                          ? GEORGIAN_BANKS.find(b => b.nameEn === bankAccount.bank_name)?.nameKa || bankAccount.bank_name 
                          : bankAccount.bank_name}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">
                        {isKa ? "ანგარიშის მფლობელი" : "Account Holder"}
                      </span>
                      <p className="font-semibold text-text-primary mt-0.5">
                        {bankAccount.account_holder_name}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-text-muted uppercase block">
                        {isKa ? "საბანკო IBAN" : "Georgian IBAN"}
                      </span>
                      <p className="font-mono text-sm font-bold text-cyan-400 tracking-wider mt-0.5">
                        {maskValue(bankAccount.iban, 6)}
                      </p>
                    </div>
                    {bankAccount.account_number && (
                      <div>
                        <span className="text-[10px] text-text-muted uppercase block">
                          {isKa ? "ანგარიშის ნომერი" : "Account Number"}
                        </span>
                        <p className="font-mono font-semibold text-text-primary mt-0.5">
                          {maskValue(bankAccount.account_number, 3)}
                        </p>
                      </div>
                    )}
                    {bankAccount.swift_code && (
                      <div>
                        <span className="text-[10px] text-text-muted uppercase block">
                          {isKa ? "SWIFT/BIC კოდი" : "SWIFT/BIC Code"}
                        </span>
                        <p className="font-mono font-semibold text-text-primary mt-0.5">
                          {maskValue(bankAccount.swift_code, 2)}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">
                        {isKa ? "ვალუტა" : "Currency"}
                      </span>
                      <p className="font-semibold text-text-primary mt-0.5">
                        {bankAccount.currency} (GE)
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">
                        {isKa ? "დამატების თარიღი" : "Date Linked"}
                      </span>
                      <p className="font-semibold text-text-primary mt-0.5">
                        {new Date(bankAccount.created_at).toLocaleDateString(isKa ? "ka-GE" : "en-US")}
                      </p>
                    </div>
                  </div>

                  {/* Wise cached ID verification */}
                  {bankAccount.wise_recipient_id && (
                    <div className="bg-slate-950/60 border border-slate-850/60 rounded-xl p-3 flex items-center justify-between text-xs">
                      <span className="text-text-muted">Wise ID Reference:</span>
                      <code className="text-cyan-400 font-mono text-[10px]">
                        {bankAccount.wise_recipient_id}
                      </code>
                    </div>
                  )}

                  {/* Last payout status if present */}
                  {lastTransfer && (
                    <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2 text-xs">
                      <p className="font-bold text-text-secondary uppercase text-[9px] tracking-wider">
                        {isKa ? "ბოლო გადარიცხვის სტატუსი" : "Last Transfer Status"}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-text-muted">
                          {new Date(lastTransfer.created_at).toLocaleDateString()}
                        </span>
                        <span className="font-bold text-text-primary">
                          GEL {lastTransfer.target_amount}
                        </span>
                        <span className="bg-emerald-950/50 text-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-emerald-900/50">
                          {lastTransfer.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-4 border-t border-slate-850 pt-6">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="h-4 w-4 animate-hover" />
                      {isKa ? "მონაცემების განახლება" : "Update Bank Details"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-slate-950 border border-slate-850 hover:bg-rose-950/30 hover:border-rose-900/40 text-text-muted hover:text-rose-400 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isKa ? "წაშლა" : "Remove Account"}
                    </button>
                  </div>

                </div>
              </div>
            ) : (
              /* Setup Form */
              <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                    {bankAccount ? (isKa ? "ანგარიშის რედაქტირება" : "Edit Payout Details") : (isKa ? "ახალი ანგარიშის დამატება" : "Setup Payout Account")}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {isKa 
                      ? "შეიყვანეთ თქვენი ქართული კომპანიის საბანკო რეკვიზიტები." 
                      : "Fill in your Georgian company bank credentials. All commissions will route here."}
                  </p>
                </div>

                <form onSubmit={handleSave} className="space-y-4 text-xs">
                  
                  {/* Bank Select Dropdown */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                      {isKa ? "ბანკის სახელი" : "Bank Name"} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={bankName}
                      onChange={(e) => {
                        setBankName(e.target.value);
                        if (formErrors.bankName) setFormErrors(prev => ({ ...prev, bankName: "" }));
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-slate-700 transition"
                    >
                      <option value="">{isKa ? "აირჩიეთ ბანკი..." : "Select your bank..."}</option>
                      {GEORGIAN_BANKS.map((bank) => (
                        <option key={bank.code} value={bank.nameEn}>
                          {isKa ? bank.nameKa : bank.nameEn}
                        </option>
                      ))}
                    </select>
                    {formErrors.bankName && (
                      <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {formErrors.bankName}
                      </p>
                    )}
                  </div>

                  {/* Account Holder Name */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                      {isKa ? "ანგარიშის მფლობელის სახელი" : "Account Holder Name"} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => {
                        setAccountHolderName(e.target.value);
                        if (formErrors.accountHolderName) setFormErrors(prev => ({ ...prev, accountHolderName: "" }));
                      }}
                      placeholder="e.g. Kavshare Solutions LLC"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-slate-700 transition"
                    />
                    {formErrors.accountHolderName && (
                      <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {formErrors.accountHolderName}
                      </p>
                    )}
                  </div>

                  {/* IBAN */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                      {isKa ? "ქართული საბანკო IBAN" : "Georgian IBAN"} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={iban}
                      onChange={handleIBANChange}
                      placeholder="GE00 TB00 0000 0000 0000 00"
                      maxLength={27}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 font-mono text-text-primary focus:outline-none focus:border-slate-700 tracking-wider transition"
                    />
                    <p className="text-[9px] text-text-muted">
                      {isKa 
                        ? "ქართული IBAN იწყება GE-ით და შეიცავს 22 სიმბოლოს." 
                        : "Must start with GE, followed by 20 letters/numbers."}
                    </p>
                    {formErrors.iban && (
                      <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {formErrors.iban}
                      </p>
                    )}
                  </div>

                  {/* Account Number & SWIFT Row */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                        {isKa ? "ანგარიშის ნომერი" : "Account Number"} <span className="text-text-muted font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => {
                          setAccountNumber(e.target.value);
                          if (formErrors.accountNumber) setFormErrors(prev => ({ ...prev, accountNumber: "" }));
                        }}
                        placeholder="e.g. 123456789"
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                      {formErrors.accountNumber && (
                        <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {formErrors.accountNumber}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                        SWIFT / BIC კოდი <span className="text-text-muted font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={swiftCode}
                        onChange={(e) => {
                          setSwiftCode(e.target.value);
                          if (formErrors.swiftCode) setFormErrors(prev => ({ ...prev, swiftCode: "" }));
                        }}
                        placeholder="e.g. TBCBGE22"
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 font-mono text-text-primary focus:outline-none focus:border-slate-700 transition"
                      />
                      {formErrors.swiftCode && (
                        <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {formErrors.swiftCode}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                      {isKa ? "ანგარიშის ვალუტა" : "Account Currency"}
                    </label>
                    <div className="flex gap-4">
                      {["GEL", "USD", "EUR"].map((cur) => (
                        <label key={cur} className="flex items-center gap-2 cursor-pointer text-text-secondary hover:text-text-primary transition">
                          <input
                            type="radio"
                            name="currency"
                            value={cur}
                            checked={currency === cur}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 h-4 w-4"
                          />
                          <span className="font-semibold text-xs">{cur}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Action alert box for validation result */}
                  {verificationResult && (
                    <div className={`p-4 rounded-xl border text-xs flex gap-2 items-start ${
                      verificationResult.success 
                        ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" 
                        : "bg-rose-950/20 border-rose-900/50 text-rose-400"
                    }`}>
                      {verificationResult.success ? (
                        <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      )}
                      <p>{verificationResult.message}</p>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex gap-4 pt-4 border-t border-slate-900">
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifying}
                      className="bg-slate-950 border border-slate-850 hover:border-cyan-500/40 text-cyan-400 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      {isKa ? "მონაცემების შემოწმება" : "Verify Bank Account"}
                    </button>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      {isKa ? "ანგარიშის შენახვა" : "Save Payout Details"}
                    </button>

                    {bankAccount && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="bg-slate-950 border border-slate-850 text-xs font-bold px-4 py-2.5 rounded-xl text-text-secondary hover:bg-slate-850 transition"
                      >
                        {isKa ? "გაუქმება" : "Cancel"}
                      </button>
                    )}
                  </div>

                </form>
              </div>
            )}

          </div>

          {/* Sidebar / Info Column */}
          <div className="space-y-6">
            
            {/* Info panel 1: Security and processing */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl space-y-4">
              <h3 className="text-xs uppercase font-extrabold text-cyan-400 tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                {isKa ? "უსაფრთხოების გარანტია" : "Security & Wise System"}
              </h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {isKa 
                  ? "KavShare მუშაობს Wise API-სთან პირდაპირი ინტეგრაციით. თქვენი საბანკო ანგარიში ინახება დაცულ სერვერზე და გამოიყენება მხოლოდ საკომისიოების დასარიცხად." 
                  : "KavShare uses Wise API endpoints directly. Your bank accounts are stored securely and encrypted at rest, ensuring quick, automated wire payouts."}
              </p>
              <div className="border-t border-slate-850/60 pt-3 text-[10px] text-text-secondary space-y-1">
                <span className="block font-bold">💡 {isKa ? "მნიშვნელოვანი რეკომენდაციები" : "Verification best practices"}:</span>
                <span className="block">• {isKa ? "IBAN უნდა იწყებოდეს GE-ით" : "IBAN must begin with country code GE"}</span>
                <span className="block">• {isKa ? "სახელი უნდა ემთხვეოდეს ბანკისას" : "Account holder name must match bank records"}</span>
                <span className="block">• {isKa ? "SWIFT/BIC კოდი საჭიროა ევროს/დოლარისთვის" : "SWIFT/BIC codes required for USD/EUR accounts"}</span>
              </div>
            </div>

            {/* Info panel 2: Supported banks marquee */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl space-y-3">
              <h3 className="text-xs uppercase font-extrabold text-text-muted tracking-wider flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-cyan-400" />
                {isKa ? "მხარდაჭერილი ბანკები" : "Supported Banks"}
              </h3>
              <p className="text-[10px] text-text-muted">
                {isKa ? "ჩვენ ვთანამშრომლობთ შემდეგ ქართულ ფინანსურ ორგანიზაციებთან:" : "We support automated transfers to these Georgian banking institutes:"}
              </p>
              <div className="space-y-1.5">
                {GEORGIAN_BANKS.map((b) => (
                  <div key={b.code} className="flex justify-between items-center text-[10px] bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-850/60">
                    <span className="font-semibold text-text-secondary">
                      {isKa ? b.nameKa : b.nameEn}
                    </span>
                    <span className="text-text-muted uppercase text-[8px] font-mono bg-slate-900 px-1 py-0.5 rounded">
                      {b.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center">
            <div className="h-12 w-12 bg-rose-950/50 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-text-primary">
                {isKa ? "ანგარიშის წაშლა" : "Remove Payout Account?"}
              </h4>
              <p className="text-[11px] text-text-muted">
                {isKa 
                  ? "დარწმუნებული ხართ? ამ ანგარიშის წაშლის შემდეგ საკომისიოების ავტომატური დარიცხვა შეჩერდება." 
                  : "Are you sure you want to remove your payout details? You won't receive automatic commission payouts until you add a new one."}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-950 border border-slate-850 py-2 rounded-xl text-xs text-text-secondary hover:bg-slate-850 transition"
              >
                {isKa ? "გაუქმება" : "Cancel"}
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 bg-rose-500 hover:bg-rose-600 py-2 rounded-xl text-xs text-slate-950 font-black transition"
              >
                {submitting ? (isKa ? "იშლება..." : "Removing...") : (isKa ? "წაშლა" : "Yes, Remove")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

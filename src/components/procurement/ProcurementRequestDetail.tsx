"use client";

import {
  CheckCircle,
  FileCheck,
  Layers,
  Send,
  Info,
} from "lucide-react";
import { useState } from "react";
import { ProcurementRequest } from "./ProcurementRequestCard";

interface ProcurementRequestDetailProps {
  request: ProcurementRequest;
  isOwner?: boolean;
  onClose?: () => void;
}

export default function ProcurementRequestDetail({
  request,
  isOwner = false,
  onClose,
}: ProcurementRequestDetailProps) {
  const [proposalSubmitted, setProposalSubmitted] = useState(false);
  const [proposalText, setProposalText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalText.trim()) return;

    setSubmitting(true);
    // Simulate proposal processing delays
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitting(false);
    setProposalSubmitted(true);
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden backdrop-blur-md">
      {/* Header Panel */}
      <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-850">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-slate-950 border border-slate-850 text-[9px] uppercase font-bold text-text-secondary px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-cyan-400" /> {request.category}
            </span>
            <span className="bg-cyan-950/20 border border-cyan-500/20 text-[9px] uppercase font-bold text-cyan-400 px-2.5 py-1 rounded-lg">
              Urgency: {request.urgency}
            </span>
            {isOwner && (
              <span className="bg-emerald-950/20 border border-emerald-500/20 text-[9px] uppercase font-bold text-emerald-400 px-2.5 py-1 rounded-lg">
                Your Procurement Request
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-black text-text-primary tracking-tight">{request.title}</h2>
          <p className="text-xs text-text-muted">Posted by {request.companyName} ({request.companySize} employees)</p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xs font-bold bg-slate-950 px-3 py-1.5 border border-slate-850 rounded-xl transition"
          >
            Close View
          </button>
        )}
      </div>

      {/* Main Body Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Side: Stats and Info */}
        <div className="md:col-span-2 space-y-5">
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold text-text-muted tracking-wider">Project Brief & Details</h4>
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
              {request.description}
            </p>
          </div>

          {/* Key Checklist Requirements */}
          <div className="space-y-3 bg-slate-950/40 border border-slate-850 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-cyan-400" /> Core Compliance & Requirements
            </h4>
            <div className="grid sm:grid-cols-2 gap-2.5 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Urgency level: <strong className="text-text-primary">{request.urgency}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Start Date: <strong className="text-text-primary">{request.startDate}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>NDA / Confidentiality: <strong className="text-text-primary">Required</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Estimated duration: <strong className="text-text-primary">{request.duration}</strong></span>
              </div>
            </div>
          </div>

          {/* Tech Stack Selection */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold text-text-muted tracking-wider">Required Technology Stack</h4>
            <div className="flex flex-wrap gap-2">
              {request.requiredTech.length === 0 ? (
                <span className="text-xs text-text-muted italic">No specific technologies requested.</span>
              ) : (
                request.requiredTech.map((t) => (
                  <span
                    key={t}
                    className="bg-slate-950 border border-slate-850 px-3 py-1 rounded-xl text-xs font-semibold text-text-secondary"
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Compliance List */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold text-text-muted tracking-wider">Compliance Frameworks</h4>
            <div className="flex flex-wrap gap-2">
              {request.compliance.length === 0 ? (
                <span className="text-xs text-text-muted italic">No compliance frameworks requested.</span>
              ) : (
                request.compliance.map((c) => (
                  <span
                    key={c}
                    className="bg-red-950/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-xl text-xs font-semibold"
                  >
                    {c}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Meta Sidebar Panel */}
        <div className="space-y-5">
          <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs uppercase font-bold text-text-muted tracking-wider border-b border-slate-850 pb-2">
              Proposal Metadata
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Target Budget:</span>
                <span className="font-extrabold text-cyan-400">${request.budgetRange.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Budget Type:</span>
                <span className="text-text-primary font-semibold">{request.budgetType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Seeker Location:</span>
                <span className="text-text-primary font-semibold">Tbilisi, Georgia</span>
              </div>
            </div>
          </div>

          {/* Actions for Seeker / Provider */}
          {isOwner ? (
            <div className="bg-cyan-950/20 border border-cyan-500/20 p-4 rounded-2xl text-xs space-y-3">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Info className="h-4 w-4" /> Owner Management Mode
              </span>
              <p className="text-text-muted leading-relaxed">
                This is your request. You can view matching proposals or edit parameters from your manager dashboard.
              </p>
              <button
                className="w-full bg-cyan-500 text-slate-950 font-black py-2.5 rounded-xl transition hover:bg-cyan-400"
                onClick={() => {}}
              >
                View Matching Proposals
              </button>
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Send className="h-4 w-4 text-cyan-400" /> Apply / Send Proposal
              </h4>

              {proposalSubmitted ? (
                <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl text-center space-y-2">
                  <CheckCircle className="h-6 w-6 text-brand-success mx-auto" />
                  <span className="text-xs font-bold text-text-primary block">Proposal Submitted</span>
                  <p className="text-[10px] text-text-muted">The seeker will review your profile and project fit rating.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitProposal} className="space-y-3">
                  <textarea
                    rows={4}
                    value={proposalText}
                    onChange={(e) => setProposalText(e.target.value)}
                    placeholder="Briefly pitch your capabilities, timeline guarantees, and match qualifications..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-cyan-500 resize-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    {submitting ? "Sending..." : "Submit Proposal"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { DollarSign, Clock, Star, ArrowUpRight, Layers } from "lucide-react";
import { useState } from "react";

export interface ProcurementRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: "Low" | "Medium" | "High" | "Critical";
  startDate: string;
  duration: string;
  budgetRange: number;
  budgetType: string;
  companyName: string;
  companySize: string;
  requiredTech: string[];
  compliance: string[];
  createdAt: string;
  ownerId: string;
}

interface ProcurementRequestCardProps {
  request: ProcurementRequest;
  onQuickView?: (request: ProcurementRequest) => void;
  isOwner?: boolean;
}

export default function ProcurementRequestCard({
  request,
  onQuickView,
  isOwner = false,
}: ProcurementRequestCardProps) {
  const [starred, setStarred] = useState(false);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "Critical":
        return "bg-red-950/20 text-red-400 border-red-500/30";
      case "High":
        return "bg-amber-950/20 text-amber-400 border-amber-500/30";
      case "Medium":
        return "bg-blue-950/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-slate-900 border-slate-800 text-text-secondary";
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 transition-all duration-300 relative group overflow-hidden">
      <div className="absolute top-0 right-0 h-[80px] w-[80px] bg-gradient-to-br from-cyan-500/5 to-transparent blur-md pointer-events-none" />

      {/* Card Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-slate-950 border border-slate-850 text-[9px] uppercase font-bold text-text-secondary px-2 py-0.5 rounded-md flex items-center gap-1">
              <Layers className="h-2.5 w-2.5 text-cyan-400" /> {request.category}
            </span>
            <span className={`border text-[9px] uppercase font-bold px-2 py-0.5 rounded-md ${getUrgencyColor(request.urgency)}`}>
              {request.urgency} Urgency
            </span>
            {isOwner && (
              <span className="bg-cyan-950/20 border border-cyan-500/20 text-[9px] uppercase font-bold text-cyan-400 px-2 py-0.5 rounded-md">
                Your Request
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-text-primary tracking-tight line-clamp-1 group-hover:text-cyan-400 transition">
            {request.title}
          </h3>
        </div>

        {/* Favorite Star Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setStarred(!starred);
          }}
          className={`p-2 rounded-xl border transition ${
            starred
              ? "bg-amber-950/20 border-amber-500/40 text-amber-400"
              : "bg-slate-950 border-slate-850 text-text-muted hover:text-text-primary"
          }`}
          title={starred ? "Remove Favorite" : "Favorite Request"}
        >
          <Star className={`h-3.5 w-3.5 ${starred ? "fill-amber-400" : ""}`} />
        </button>
      </div>

      {/* Description Snippet */}
      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
        {request.description}
      </p>

      {/* Meta Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-1 text-[11px] text-text-secondary">
        <div className="flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-text-primary">${request.budgetRange.toLocaleString()}</strong> ({request.budgetType})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>Duration: <strong className="text-text-primary">{request.duration}</strong></span>
        </div>
      </div>

      {/* Footer Info Row */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-850/60 text-[10px] text-text-muted">
        <div className="flex items-center gap-1.5">
          <span>By: <strong className="text-text-secondary">{request.companyName}</strong> ({request.companySize})</span>
        </div>
        <span>Posted 2 hours ago</span>
      </div>

      {/* Action Trigger Buttons */}
      <div className="flex gap-2 pt-1.5">
        {onQuickView && (
          <button
            onClick={() => onQuickView(request)}
            className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold py-2 rounded-xl text-text-primary transition"
          >
            Quick View
          </button>
        )}
        <button
          className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 text-[10px] font-bold px-3 py-2 rounded-xl text-cyan-400 flex items-center justify-center gap-1 transition"
          onClick={() => {
            // Trigger detailed path navigate if desired
          }}
        >
          Details <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

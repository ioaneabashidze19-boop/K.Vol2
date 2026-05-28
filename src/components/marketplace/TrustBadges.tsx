"use client";

import {
  ShieldCheck,
  Star,
  Calendar,
  CheckCircle2,
  Zap,
  Info
} from "lucide-react";
import { calculateTrustScore } from "@/lib/trust-score";

interface TrustBadgesProps {
  company: {
    status: string;
    rating?: number;
    founded_year?: number;
    completion_rate?: number;
    avg_response_time_hours?: number;
  };
  locale?: string;
  showScore?: boolean;
}

export default function TrustBadges({ company, locale = "en", showScore = true }: TrustBadgesProps) {
  const isKa = locale === "ka";

  const { status, rating = 0, founded_year, completion_rate = 100, avg_response_time_hours = 24 } = company;

  // 1. Resolve active badges
  const badges = [];

  // Verified Provider badge
  if (status === "active") {
    badges.push({
      key: "verified",
      label: isKa ? "ვერიფიცირებული" : "Verified Provider",
      description: isKa ? "კომპანიამ გაიარა KYC ვერიფიკაცია" : "Company has completed KYC verification checks.",
      icon: ShieldCheck,
      color: "text-emerald-400 bg-emerald-950/30 border-emerald-900/30"
    });
  }

  // Rating badge
  if (rating > 4.5) {
    badges.push({
      key: "highly-rated",
      label: isKa ? "მაღალი რეიტინგი" : "Highly Rated",
      description: isKa ? "საშუალო შეფასება 4.5-ზე მეტია" : "Average customer satisfaction rating exceeds 4.5 stars.",
      icon: Star,
      color: "text-amber-400 bg-amber-950/30 border-amber-900/30"
    });
  }

  // Longevity badge
  const currentYear = new Date().getFullYear();
  if (founded_year && currentYear - founded_year >= 3) {
    badges.push({
      key: "established",
      label: isKa ? "გამოცდილი" : "Established",
      description: isKa ? "კომპანია ბაზარზეა 3 წელზე მეტია" : `In business for ${currentYear - founded_year} years since founded in ${founded_year}.`,
      icon: Calendar,
      color: "text-indigo-400 bg-indigo-950/30 border-indigo-900/30"
    });
  }

  // Completion badge
  if (completion_rate >= 90) {
    badges.push({
      key: "reliable",
      label: isKa ? "საიმედო" : "Reliable",
      description: isKa ? "90%-ზე მეტი დასრულებული პროექტი" : `${completion_rate}% contract completion rate on the platform.`,
      icon: CheckCircle2,
      color: "text-cyan-400 bg-cyan-950/30 border-cyan-900/30"
    });
  }

  // Response Time badge
  if (avg_response_time_hours < 24) {
    badges.push({
      key: "responsive",
      label: isKa ? "ოპერატიული" : "Responsive",
      description: isKa ? "პასუხობს 24 საათზე ნაკლებ დროში" : `Average proposal response time is under ${avg_response_time_hours} hours.`,
      icon: Zap,
      color: "text-rose-400 bg-rose-950/30 border-rose-900/30"
    });
  }

  // Calculate Trust Score
  const scoreBreakdown = calculateTrustScore({
    status,
    rating,
    completion_rate,
    avg_response_time_hours
  });

  const getScoreColor = (score: number) => {
    if (score < 60) return "text-rose-400 border-rose-900/30 bg-rose-950/10";
    if (score < 80) return "text-amber-400 border-amber-900/30 bg-amber-950/10";
    return "text-cyan-400 border-cyan-900/30 bg-cyan-950/10";
  };

  return (
    <div className="space-y-4">
      {/* Trust Score Header Indicator */}
      {showScore && (
        <div className="flex flex-wrap items-center gap-3">
          <div className={`px-4 py-2 border rounded-xl flex items-center gap-2 text-xs font-mono font-bold select-none ${getScoreColor(scoreBreakdown.total)}`}>
            <span>Trust Score: {scoreBreakdown.total}/100</span>
            
            {/* Tooltip Icon & Popup */}
            <div className="group relative cursor-help">
              <Info className="h-3.5 w-3.5 opacity-80 hover:opacity-100 transition" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-2xl text-[10px] text-text-secondary leading-normal font-sans hidden group-hover:block z-50 pointer-events-none">
                <div className="font-extrabold text-text-primary mb-1 border-b border-slate-800 pb-1 uppercase tracking-wider">
                  Trust Score Breakdown
                </div>
                <div className="space-y-1 mt-1.5">
                  <div className="flex justify-between">
                    <span>KYC / Verification:</span>
                    <span className="font-bold text-text-primary">{scoreBreakdown.verificationScore}/25 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Star Rating:</span>
                    <span className="font-bold text-text-primary">{scoreBreakdown.ratingScore}/25 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Project Completion:</span>
                    <span className="font-bold text-text-primary">{scoreBreakdown.completionScore}/25 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Response Speed:</span>
                    <span className="font-bold text-text-primary">{scoreBreakdown.responseScore}/25 pts</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Badges Container */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => {
            const IconComponent = badge.icon;
            return (
              <div
                key={badge.key}
                className={`group relative flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[10px] font-bold transition duration-200 select-none ${badge.color}`}
              >
                <IconComponent className="h-3.5 w-3.5" />
                <span>{badge.label}</span>

                {/* Badge Tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-slate-900 border border-slate-800 p-2 rounded-lg shadow-xl text-[9px] text-text-secondary leading-tight text-center hidden group-hover:block z-50 pointer-events-none">
                  {badge.description}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

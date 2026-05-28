import type { ReactNode } from "react";

interface TooltipProps {
  content: string | ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}

export default function Tooltip({ content, position = "top", children }: TooltipProps) {
  const positionClassMap = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClassMap = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-950 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-950 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-slate-950 border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-slate-950 border-y-transparent border-l-transparent",
  };

  return (
    <div className="relative group inline-block">
      {children}
      {/* Tooltip Content panel */}
      <div
        className={`absolute hidden group-hover:flex flex-col items-center bg-slate-950 text-text-primary text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-800 shadow-xl whitespace-nowrap z-50 pointer-events-none transition-all ${positionClassMap[position]}`}
        role="tooltip"
      >
        {content}
        {/* Triangle Arrow */}
        <div className={`absolute border-4 ${arrowClassMap[position]}`} />
      </div>
    </div>
  );
}

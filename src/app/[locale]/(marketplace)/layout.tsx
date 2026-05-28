import type { ReactNode } from "react";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col bg-slate-950">
      <div className="bg-slate-900/40 border-b border-slate-800/80 py-4 px-8 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-white">Provider Marketplace</h1>
          <p className="text-xs text-slate-400">Discover top-tier validated service providers</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}

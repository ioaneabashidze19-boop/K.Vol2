import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-950">
      {/* Dashboard sidebar panel */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Workspace
          </h2>
          <nav className="mt-4 flex flex-col gap-2">
            <a
              href="/dashboard"
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Overview
            </a>
            <a
              href="/dashboard/seeker/contracts"
              className="text-sm font-medium text-slate-300 hover:text-white"
            >
              Contracts
            </a>
            <a
              href="/dashboard/provider/engagements"
              className="text-sm font-medium text-slate-300 hover:text-white"
            >
              Engagements
            </a>
          </nav>
        </div>
      </aside>

      {/* Main dashboard content */}
      <section className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
        {children}
      </section>
    </div>
  );
}

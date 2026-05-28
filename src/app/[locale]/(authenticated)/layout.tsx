import type { ReactNode } from "react";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col bg-slate-950">
      {children}
    </div>
  );
}

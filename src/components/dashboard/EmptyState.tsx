import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-900/10 min-h-[300px]">
      {/* Visual Icon */}
      {icon ? (
        <div className="text-text-muted mb-4 h-12 w-12">{icon}</div>
      ) : (
        <svg
          className="mx-auto h-12 w-12 text-text-muted mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
      )}

      {/* Main Title */}
      <h3 className="text-base font-bold text-text-primary tracking-tight font-display">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-1 text-sm text-text-secondary max-w-sm leading-normal">
        {description}
      </p>

      {/* Call to action */}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

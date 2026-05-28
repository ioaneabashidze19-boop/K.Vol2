import Link from "next/link";
import type { ReactNode } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

export default function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-900 pb-5 mb-6">
      <div className="flex-1 min-w-0">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            className="flex items-center space-x-2 text-xs text-text-muted mb-2"
            aria-label="Breadcrumb"
          >
            {breadcrumbs.map((crumb, idx) => (
              <span
                key={idx}
                className="flex items-center space-x-2"
              >
                {idx > 0 && <span>/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-text-secondary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-text-secondary font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold font-display text-text-primary sm:text-3xl tracking-tight">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <p className="mt-1 text-sm text-text-secondary max-w-2xl leading-normal">
            {description}
          </p>
        )}
      </div>

      {/* Action triggers */}
      {actions && <div className="mt-4 md:mt-0 flex items-center gap-3">{actions}</div>}
    </div>
  );
}

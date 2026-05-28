import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      className="flex items-center space-x-2 text-xs text-text-muted mb-4"
      aria-label="Breadcrumb navigation list"
    >
      {items.map((item, idx) => (
        <span
          key={idx}
          className="flex items-center space-x-2"
        >
          {idx > 0 && <span className="text-slate-700 font-bold select-none">&rarr;</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-text-secondary transition-colors focus:outline-none"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-text-secondary font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

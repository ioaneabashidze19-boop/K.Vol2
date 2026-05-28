"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation, useLocale } from "@/i18n/hooks";

interface SidebarItem {
  labelKey: string;
  defaultLabel: string;
  href: string;
}

interface SidebarProps {
  items: SidebarItem[];
  title?: string;
}

export default function Sidebar({ items, title = "Workspace" }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation("dashboard");
  const locale = useLocale();

  return (
    <aside
      className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6"
      role="complementary"
      aria-label={`${title} Sidebar`}
    >
      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider font-display">
          {title}
        </h2>
        <nav
          className="mt-4 flex flex-col gap-1.5"
          role="navigation"
        >
          {items.map((item) => {
            const isSelected = pathname.endsWith(item.href);
            return (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                aria-current={isSelected ? "page" : undefined}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isSelected
                    ? "bg-slate-800 text-emerald-400"
                    : "text-text-secondary hover:text-text-primary hover:bg-slate-800/50"
                }`}
              >
                {t(item.labelKey, item.defaultLabel)}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

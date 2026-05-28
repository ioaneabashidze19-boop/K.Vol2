"use client";

import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";

export default function LocaleSwitcher({ activeLocale }: { activeLocale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (newLocale: string) => {
    startTransition(() => {
      // Use next-intl's localized router to replace paths automatically keeping query parameters
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeLocale}
        disabled={isPending}
        onChange={(e) => handleLocaleChange(e.target.value)}
        className="bg-slate-800 text-slate-100 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50 cursor-pointer"
      >
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="fr">Français</option>
        <option value="ka">ქართული</option>
      </select>
    </div>
  );
}

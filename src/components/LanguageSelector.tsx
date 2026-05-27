"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const locales = [
  { code: "en", name: "EN" },
  { code: "es", name: "ES" },
  { code: "fr", name: "FR" },
];

/**
 * Client Component for selecting the application language.
 * Automatically highlights the currently active locale based on routing.
 */
export function LanguageSelector() {
  const params = useParams();
  const currentLocale = (params?.locale as string) || "en";

  return (
    <div className="flex items-center space-x-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl text-sm text-slate-300 backdrop-blur-sm">
      <span className="font-semibold text-slate-400 mr-1">Language:</span>
      {locales.map((locale) => (
        <Link
          key={locale.code}
          href={`/${locale.code}`}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            currentLocale === locale.code
              ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-500/10"
              : "hover:text-white hover:bg-slate-800/50"
          }`}
        >
          {locale.name}
        </Link>
      ))}
    </div>
  );
}

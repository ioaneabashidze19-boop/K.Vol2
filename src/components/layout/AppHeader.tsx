"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import LocaleSwitcher from "@/components/LocaleSwitcher";
import { useTranslation, useLocale } from "@/i18n/hooks";

export default function AppHeader() {
  const { t } = useTranslation("navigation");
  const locale = useLocale();
  const { isSignedIn, isLoaded } = useUser();

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md"
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-8">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 text-xl font-bold font-display text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
              aria-label="KavShare Home"
            >
              <span className="h-6 w-6 rounded bg-emerald-500 flex items-center justify-center text-slate-950 text-sm font-black">
                K
              </span>
              <span>KavShare</span>
            </Link>

            {/* Navigation links */}
            <nav
              className="hidden md:flex items-center gap-6"
              role="navigation"
              aria-label="Main Navigation"
            >
              <Link
                href={`/${locale}/marketplace`}
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-2 py-1"
              >
                {t("marketplace", "Marketplace")}
              </Link>
              <Link
                href={`/${locale}/dashboard`}
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-2 py-1"
              >
                {t("dashboard", "Dashboard")}
              </Link>
            </nav>
          </div>

          {/* User state and language */}
          <div className="flex items-center gap-4">
            <LocaleSwitcher activeLocale={locale} />

            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/${locale}/dashboard`}
                      className="hidden sm:inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-colors"
                    >
                      {t("dashboard", "Dashboard")}
                    </Link>
                    <UserButton
                      appearance={{
                        elements: {
                          userButtonBox: "focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full",
                        },
                      }}
                    />
                  </div>
                ) : (
                  <Link
                    href={`/${locale}/sign-in`}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {t("login", "Sign In")}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

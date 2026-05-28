import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t border-slate-800 bg-slate-950 py-8 text-slate-500"
      role="contentinfo"
      aria-label="Footer"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
              K
            </span>
            <span className="text-sm font-semibold text-text-secondary">KavShare Inc.</span>
          </div>
          <p className="text-xs text-text-muted">
            &copy; {currentYear} KavShare. All rights reserved. Premium platform commission sharing and procurement.
          </p>
          <div className="flex items-center gap-4 text-xs font-medium">
            <Link
              href="/privacy"
              className="hover:text-text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="hover:text-text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

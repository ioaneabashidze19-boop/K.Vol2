import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "es", "fr"];
const defaultLocale = "en";

function getLocale(request: NextRequest): string {
  // Simple negotiator to detect Accept-Language headers
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferredLocale = locales.find((locale) =>
      acceptLanguage.toLowerCase().includes(locale.toLowerCase())
    );
    if (preferredLocale) return preferredLocale;
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the pathname is missing any locale prefix
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // Redirect if there is no locale prefix
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);
    return NextResponse.redirect(
      new URL(
        `/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}`,
        request.url
      )
    );
  }
}

export const config = {
  // Matcher ignoring `/api/`, `/_next/` (static/images), and static assets (favicon, images, etc.)
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|.*\\..*).*)",
  ],
};

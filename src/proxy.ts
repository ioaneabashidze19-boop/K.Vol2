import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define localized and unlocalized patterns for protected paths
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/files(.*)",
  "/:locale/dashboard(.*)",
  "/:locale/files(.*)",
]);

const locales = ["en", "es", "fr"];
const defaultLocale = "en";

function getLocale(request: NextRequest): string {
  // Check headers for language preferences
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferredLocale = locales.find((locale) =>
      acceptLanguage.toLowerCase().includes(locale.toLowerCase())
    );
    if (preferredLocale) return preferredLocale;
  }
  return defaultLocale;
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // 1. Enforce authentication on protected routes
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  // 2. Perform locale redirection if path is missing locale segment
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);
    return NextResponse.redirect(
      new URL(`/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}`, request.url)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in query parameters
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes and webhooks
    "/(api|trpc)(.*)",
  ],
};

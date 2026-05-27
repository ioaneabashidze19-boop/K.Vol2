import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { UserRole } from "@/lib/types/roles";

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

  // 1. Perform locale check first. If pathname has no locale segment, redirect immediately.
  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!hasLocale) {
    const locale = getLocale(request);
    return NextResponse.redirect(
      new URL(`/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}`, request.url)
    );
  }

  // Extract locale and path components
  const pathParts = pathname.split("/"); // e.g. ["", "en", "dashboard", "provider"]
  const locale = pathParts[1];

  // 2. Enforce authentication on protected routes
  if (isProtectedRoute(request)) {
    const authSession = await auth();

    // If authenticated, check role authorization rules
    if (authSession.userId) {
      const claims = authSession.sessionClaims;
      // Default to 'seeker' role if not specified in JWT claims
      const userRole = (claims?.metadata?.userRole || "seeker") as UserRole;

      // Restrict role dashboard access
      if (pathParts[2] === "dashboard") {
        const requestedSubpath = pathParts[3]; // e.g. 'provider', 'seeker', 'admin'

        // If visiting generic /dashboard or a sub-path mismatching their userRole, redirect them
        if (requestedSubpath !== userRole) {
          return NextResponse.redirect(new URL(`/${locale}/dashboard/${userRole}`, request.url));
        }
      }
    } else {
      // Direct unauthenticated sessions to Clerk auth gates
      await auth.protect();
    }
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

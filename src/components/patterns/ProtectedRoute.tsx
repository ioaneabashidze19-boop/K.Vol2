"use client";

import { useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";

import LoadingSpinner from "./LoadingSpinner";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: ("seeker" | "provider" | "admin")[];
  fallback?: ReactNode;
}

export default function ProtectedRoute({ children, allowedRoles, fallback }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, user } = useUser();

  // 1. Clerk session is loading
  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner
          size="lg"
          variant="spinner"
        />
      </div>
    );
  }

  // 2. User is not signed in
  if (!isSignedIn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-950 min-h-[400px]">
        <h2 className="text-xl font-bold font-display text-text-primary">Authentication Required</h2>
        <p className="mt-2 text-sm text-text-secondary">Please sign in to access this section.</p>
      </div>
    );
  }

  // 3. Resolve user role from Clerk custom metadata
  const userRole = (user.publicMetadata?.userRole as "seeker" | "provider" | "admin") || "seeker";

  // 4. User role is not authorized
  if (!allowedRoles.includes(userRole)) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-950 min-h-[400px]">
        <div className="bg-red-500/10 text-red-500 rounded-full p-4 mb-4">
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold font-display text-text-primary">Access Denied</h2>
        <p className="mt-2 text-sm text-text-secondary max-w-sm">
          You do not have the required permissions to access this workspace section.
        </p>
      </div>
    );
  }

  // 5. Render children if authorized
  return <>{children}</>;
}

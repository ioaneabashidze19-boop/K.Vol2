"use client";

import { useEffect, useRef, useState } from "react";

import { useUser } from "@clerk/nextjs";

export interface SyncUser {
  id: string;
  clerk_id: string;
  email: string;
  user_role: string;
  first_name: string | null;
  last_name: string | null;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseSyncUserResult {
  isSyncing: boolean;
  user: SyncUser | null;
  error: Error | null;
}

/**
 * Custom React hook to synchronize the Clerk authenticated user credentials
 * with the local Supabase users table on sign-in.
 */
export function useSyncUser(): UseSyncUserResult {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [dbUser, setDbUser] = useState<SyncUser | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const syncAttempted = useRef<boolean>(false);

  useEffect(() => {
    // Return early if authentication state is still loading or user is not signed in
    if (!isLoaded || !isSignedIn || !clerkUser || syncAttempted.current || isSyncing) {
      return;
    }

    const performSync = async () => {
      syncAttempted.current = true;
      setIsSyncing(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to synchronize user database record");
        }

        setDbUser(data.user);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err
            : new Error(
                typeof err === "object" && err !== null && "message" in err
                  ? String((err as Record<string, unknown>).message)
                  : "An unexpected error occurred during auth synchronization"
              )
        );
        // Reset reference flag on error to support retry events
        syncAttempted.current = false;
      } finally {
        setIsSyncing(false);
      }
    };

    performSync();
  }, [isLoaded, isSignedIn, clerkUser, isSyncing]);

  return { isSyncing, user: dbUser, error };
}

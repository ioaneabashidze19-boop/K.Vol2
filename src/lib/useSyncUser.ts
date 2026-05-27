"use client";

import { useEffect, useRef, useState } from "react";

import { useUser } from "@clerk/nextjs";

export interface SyncProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface UseSyncUserResult {
  isSyncing: boolean;
  profile: SyncProfile | null;
  error: Error | null;
}

/**
 * Custom React hook to synchronize the Clerk authenticated user profile
 * metadata details with the local Supabase profiles table on sign-in.
 */
export function useSyncUser(): UseSyncUserResult {
  const { user, isLoaded, isSignedIn } = useUser();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [profile, setProfile] = useState<SyncProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const syncAttempted = useRef<boolean>(false);

  useEffect(() => {
    // Return early if authentication state is still loading or user is not signed in
    if (!isLoaded || !isSignedIn || !user || syncAttempted.current || isSyncing) {
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
          throw new Error(data.error?.message || "Failed to synchronize profile database record");
        }

        setProfile(data.profile);
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
  }, [isLoaded, isSignedIn, user, isSyncing]);

  return { isSyncing, profile, error };
}

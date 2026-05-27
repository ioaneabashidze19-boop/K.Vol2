"use client";

import { useUser } from "@clerk/nextjs";

import { Permission, hasPermission } from "./permissions";
import { UserRole } from "./types/roles";

export interface UseUserRoleResult {
  isLoaded: boolean;
  isSignedIn: boolean;
  role: UserRole | null;
  hasPermission: (permission: Permission) => boolean;
}

/**
 * Client Hook to extract active Clerk user roles and evaluate permissions.
 *
 * @example
 * const { role, hasPermission } = useUserRole();
 * if (hasPermission("files:upload")) { ... }
 */
export function useUserRole(): UseUserRoleResult {
  const { user, isLoaded, isSignedIn } = useUser();

  const role = (user?.unsafeMetadata?.userRole ||
    user?.publicMetadata?.userRole ||
    (isSignedIn ? "seeker" : null)) as UserRole | null;

  const checkPermission = (permission: Permission): boolean => {
    if (!role) return false;
    return hasPermission(role, permission);
  };

  return {
    isLoaded,
    isSignedIn: !!isSignedIn,
    role,
    hasPermission: checkPermission,
  };
}

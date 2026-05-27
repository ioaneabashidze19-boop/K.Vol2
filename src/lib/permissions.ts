import { UserRole } from "@/lib/types/roles";

/**
 * KavShare Role-Based Access Control (RBAC) Permissions list
 */
export type Permission =
  // File operations
  | "files:upload"
  | "files:read"
  | "files:delete"
  | "files:share"
  // Metrics operations
  | "downloads:view_metrics"
  // User operations
  | "users:list"
  | "users:manage_roles"
  // Dashboard routes access
  | "provider:view_dashboard"
  | "provider:configure_settings"
  | "seeker:view_dashboard"
  // System logs/settings
  | "admin:view_logs"
  | "admin:manage_system";

/**
 * Permission Matrix
 *
 * | Permission                 | Seeker | Provider | Admin |
 * |----------------------------|--------|----------|-------|
 * | files:upload               |   ❌   |    ✅    |  ✅   |
 * | files:read                 |   ✅   |    ✅    |  ✅   |
 * | files:delete               |   ❌   |    ✅    |  ✅   |
 * | files:share                |   ❌   |    ✅    |  ✅   |
 * | downloads:view_metrics     |   ❌   |    ✅    |  ✅   |
 * | users:list                 |   ❌   |    ❌    |  ✅   |
 * | users:manage_roles         |   ❌   |    ❌    |  ✅   |
 * | provider:view_dashboard    |   ❌   |    ✅    |  ✅   |
 * | provider:configure_settings|   ❌   |    ✅    |  ✅   |
 * | seeker:view_dashboard      |   ✅   |    ❌    |  ✅   |
 * | admin:view_logs            |   ❌   |    ❌    |  ✅   |
 * | admin:manage_system        |   ❌   |    ❌    |  ✅   |
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "files:upload",
    "files:read",
    "files:delete",
    "files:share",
    "downloads:view_metrics",
    "users:list",
    "users:manage_roles",
    "provider:view_dashboard",
    "provider:configure_settings",
    "seeker:view_dashboard",
    "admin:view_logs",
    "admin:manage_system",
  ],
  provider: [
    "files:upload",
    "files:read",
    "files:delete",
    "files:share",
    "downloads:view_metrics",
    "provider:view_dashboard",
    "provider:configure_settings",
  ],
  seeker: ["files:read", "seeker:view_dashboard"],
};

/**
 * Helper to check if a specific user role has permissions for a given operation
 * @param role The active UserRole
 * @param permission The requested Permission scope
 * @returns boolean true if authorized
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

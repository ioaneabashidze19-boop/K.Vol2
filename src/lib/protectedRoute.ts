import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { Permission, hasPermission } from "./permissions";
import { UserRole } from "./types/roles";

export interface AuthContext {
  userId: string;
  role: UserRole;
}

export interface ProtectedRouteResult {
  context: AuthContext | null;
  response: NextResponse | null;
}

/**
 * Server-side route protector for i18n & API endpoints.
 * Verifies active session authentication and maps permissions check requests.
 *
 * @param requiredPermission Optional permission required to pass access controls
 * @returns An object containing the authorized context details OR a redirect/error response.
 *
 * @example
 * const { context, response } = await protectedRoute("admin:view_logs");
 * if (response) return response; // Return 401/403 response
 * // Proceed with authorized operations...
 */
export async function protectedRoute(
  requiredPermission?: Permission
): Promise<ProtectedRouteResult> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return {
      context: null,
      response: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication session is missing or has expired",
          },
        },
        { status: 401 }
      ),
    };
  }

  // Resolve role from metadata claims
  const role = (sessionClaims?.metadata?.userRole || "seeker") as UserRole;

  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    return {
      context: null,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `You do not have the required permission: '${requiredPermission}'`,
          },
        },
        { status: 403 }
      ),
    };
  }

  return {
    context: { userId, role },
    response: null,
  };
}

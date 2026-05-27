import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { protectedRoute } from "./protectedRoute";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key";

// Initialize server-side admin client to write to audit logs table
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface LogActionParams {
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

/**
 * Writes an administrative action directly to the immutable database audit logs.
 * Captures request client IP and User Agent headers automatically.
 *
 * @param adminId The Clerk ID of the performing administrator
 * @param params Logging details including action type and target descriptions
 */
export async function logAdminAction(adminId: string, params: LogActionParams): Promise<void> {
  try {
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || null;

    // Retrieve IP (support common headers used by proxies/load balancers)
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0] || headersList.get("x-real-ip") || null;

    const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: adminId,
      action: params.action,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      details: params.details || {},
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      console.error("Failed to write to admin_audit_logs:", error.message);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown logging error";
    console.error("Error inside logAdminAction:", msg);
  }
}

/**
 * High-level helper to secure admin-only API endpoints.
 * Verifies that the user is authenticated and possesses the system management scope.
 *
 * @returns Auth context details OR a standard error NextResponse
 *
 * @example
 * export async function POST(req: Request) {
 *   const { adminId, response } = await verifyAdminRoute();
 *   if (response) return response; // Return 401/403
 *
 *   // Proceed with admin operations...
 *   await logAdminAction(adminId, { action: "user:suspend", targetId: "user_123" });
 * }
 */
export async function verifyAdminRoute(): Promise<{
  adminId: string | null;
  response: NextResponse | null;
}> {
  const { context, response } = await protectedRoute("admin:manage_system");

  if (response) {
    return { adminId: null, response };
  }

  if (!context || context.role !== "admin") {
    return {
      adminId: null,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Administrative access is required for this resource",
          },
        },
        { status: 403 }
      ),
    };
  }

  return { adminId: context.userId, response: null };
}

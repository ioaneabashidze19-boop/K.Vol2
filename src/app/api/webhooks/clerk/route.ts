/* eslint-disable no-console */
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import type { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";

import { UserRole } from "@/lib/types/roles";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key";

// Initialize server-side admin client to bypass RLS restrictions safely
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return NextResponse.json(
      {
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Clerk webhook signing secret is not configured",
        },
      },
      { status: 500 }
    );
  }

  // Get Svix headers
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // Verify header presence
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Missing Svix verification headers" } },
      { status: 400 }
    );
  }

  // Fetch raw body content
  let payloadStr: string;
  try {
    payloadStr = await req.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to read request body stream";
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: msg } }, { status: 400 });
  }

  // Verify payload signature
  const wh = new Webhook(webhookSecret);
  let event: WebhookEvent;
  try {
    event = wh.verify(payloadStr, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook verification failed";
    console.error("Svix verification failed:", msg);
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Webhook signature is invalid" } },
      { status: 400 }
    );
  }

  const { type: eventType, data } = event;
  console.log(`Processing Clerk webhook event [${eventType}] for user [${data.id}]`);

  // Handle user creation and modification events
  if (eventType === "user.created" || eventType === "user.updated") {
    try {
      const clerkId = data.id;

      // Extract primary email
      const email = data.email_addresses?.[0]?.email_address;
      if (!email) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "Primary email address is missing in Clerk profile payload",
            },
          },
          { status: 400 }
        );
      }

      const firstName = data.first_name || null;
      const lastName = data.last_name || null;
      const profileCompleted = !!(firstName && lastName);

      // Extract metadata role values
      const metadata = (data.unsafe_metadata || data.public_metadata || {}) as Record<
        string,
        unknown
      >;
      const userRole = (metadata.userRole || "seeker") as UserRole;

      // Upsert user details into Supabase
      const { data: dbUser, error: upsertError } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            clerk_id: clerkId,
            email: email,
            first_name: firstName,
            last_name: lastName,
            user_role: userRole,
            profile_completed: profileCompleted,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "clerk_id",
          }
        )
        .select("*")
        .single();

      if (upsertError) {
        console.error("Database upsert failed inside Clerk webhook handler:", upsertError.message);
        return NextResponse.json(
          { error: { code: "DATABASE_ERROR", message: upsertError.message } },
          { status: 500 }
        );
      }

      console.log(`Successfully synchronized webhook user profile [${dbUser.clerk_id}]`);
      return NextResponse.json({ success: true, user: dbUser });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error processing user records";
      console.error("Error executing database upsert:", errorMessage);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: errorMessage } },
        { status: 500 }
      );
    }
  }

  // Handle user deletion events
  if (eventType === "user.deleted") {
    try {
      const clerkId = data.id;
      if (!clerkId) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "Clerk user ID is missing in user.deleted payload",
            },
          },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("clerk_id", clerkId);

      if (deleteError) {
        console.error(
          "Database deletion failed inside Clerk webhook handler:",
          deleteError.message
        );
        return NextResponse.json(
          { error: { code: "DATABASE_ERROR", message: deleteError.message } },
          { status: 500 }
        );
      }

      console.log(`Successfully deleted webhook user profile [${clerkId}]`);
      return NextResponse.json({ success: true, deletedId: clerkId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error executing user deletion";
      console.error("Error executing database deletion:", errorMessage);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: errorMessage } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true, type: eventType });
}

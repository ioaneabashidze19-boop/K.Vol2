import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Clerk session token is missing or expired",
          },
        },
        { status: 401 }
      );
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User profile details could not be retrieved from Clerk",
          },
        },
        { status: 404 }
      );
    }

    // Extract primary email address
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Primary email address is missing in Clerk account profile",
          },
        },
        { status: 400 }
      );
    }

    const fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || null;

    // Resolve user role from unsafeMetadata (set during signup flow) or publicMetadata
    const role = (clerkUser.unsafeMetadata?.userRole ||
      clerkUser.publicMetadata?.userRole ||
      "seeker") as string;

    // Check if a profile already exists
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Code PGRST116 represents 'no rows returned' which is expected if the user is new
    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: fetchError.message } },
        { status: 500 }
      );
    }

    if (profile) {
      // Sync update if metadata attributes differ
      if (profile.email !== email || profile.full_name !== fullName || profile.role !== role) {
        const { data: updatedProfile, error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            email,
            full_name: fullName,
            role,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select("*")
          .single();

        if (updateError) {
          return NextResponse.json(
            { error: { code: "DATABASE_ERROR", message: updateError.message } },
            { status: 500 }
          );
        }

        return NextResponse.json({ profile: updatedProfile, synced: true });
      }

      return NextResponse.json({ profile, synced: false });
    }

    // Insert new profile record
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name: fullName,
        role,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: newProfile, synced: true });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during profile synchronization";
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

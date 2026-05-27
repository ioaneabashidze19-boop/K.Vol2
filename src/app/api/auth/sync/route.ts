import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

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

    const firstName = clerkUser.firstName || null;
    const lastName = clerkUser.lastName || null;
    const profileCompleted = !!(firstName && lastName);

    // Resolve user role from unsafeMetadata (set during signup flow) or publicMetadata
    const role = (clerkUser.unsafeMetadata?.userRole ||
      clerkUser.publicMetadata?.userRole ||
      "seeker") as UserRole;

    // Check if a user profile already exists (searching by clerk_id)
    const { data: dbUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("clerk_id", userId)
      .single();

    // Code PGRST116 represents 'no rows returned' which is expected if the user is new
    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: fetchError.message } },
        { status: 500 }
      );
    }

    if (dbUser) {
      // Sync update if metadata attributes differ
      if (
        dbUser.email !== email ||
        dbUser.first_name !== firstName ||
        dbUser.last_name !== lastName ||
        dbUser.user_role !== role ||
        dbUser.profile_completed !== profileCompleted
      ) {
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            email,
            first_name: firstName,
            last_name: lastName,
            user_role: role,
            profile_completed: profileCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq("clerk_id", userId)
          .select("*")
          .single();

        if (updateError) {
          return NextResponse.json(
            { error: { code: "DATABASE_ERROR", message: updateError.message } },
            { status: 500 }
          );
        }

        return NextResponse.json({ user: updatedUser, synced: true });
      }

      return NextResponse.json({ user: dbUser, synced: false });
    }

    // Insert new user record
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        clerk_id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        user_role: role,
        profile_completed: profileCompleted,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: newUser, synced: true });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during user synchronization";
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

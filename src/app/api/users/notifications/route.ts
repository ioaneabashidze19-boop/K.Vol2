import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// GET /api/users/notifications - Fetch current user notification preferences
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: dbUser, error } = await supabaseAdmin
      .from("users")
      .select("notification_frequency, email_notifications_enabled")
      .eq("clerk_id", clerkUserId)
      .single();

    if (error || !dbUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      preferences: {
        notificationFrequency: dbUser.notification_frequency,
        emailNotificationsEnabled: dbUser.email_notifications_enabled
      }
    });
  } catch (err: any) {
    console.error("[GET /api/users/notifications] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/users/notifications - Update user notification preferences
export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notificationFrequency, emailNotificationsEnabled } = body;

    const validFrequencies = ["instant", "hourly", "daily", "off"];
    if (notificationFrequency && !validFrequencies.includes(notificationFrequency)) {
      return NextResponse.json({ error: "Invalid notificationFrequency choice" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (notificationFrequency) {
      updatePayload.notification_frequency = notificationFrequency;
    }
    if (typeof emailNotificationsEnabled === "boolean") {
      updatePayload.email_notifications_enabled = emailNotificationsEnabled;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("clerk_id", clerkUserId)
      .select("id, notification_frequency, email_notifications_enabled")
      .single();

    if (updateErr || !updatedUser) {
      console.error("[POST /api/users/notifications] Update error:", updateErr);
      return NextResponse.json({ error: "Failed to update notification parameters" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences: {
        notificationFrequency: updatedUser.notification_frequency,
        emailNotificationsEnabled: updatedUser.email_notifications_enabled
      }
    });
  } catch (err: any) {
    console.error("[POST /api/users/notifications] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

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

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PUT /api/messages/[id] - Edit an existing message
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const { id: messageId } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve dbUser
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 401 });
    }

    const { content } = await req.json();
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Non-empty content string is required to update a message" }, { status: 400 });
    }

    // Fetch message details
    const { data: existingMessage, error: fetchErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id, sender_id")
      .eq("id", messageId)
      .single();

    if (fetchErr || !existingMessage) {
      return NextResponse.json({ error: "Message record not found" }, { status: 404 });
    }

    // Verify sender ownership (or admin role)
    if (dbUser.role !== "admin" && existingMessage.sender_id !== dbUser.id) {
      return NextResponse.json({ error: "Access Denied: You do not own this message" }, { status: 403 });
    }

    // Update message
    const { data: updatedMessage, error: updateErr } = await supabaseAdmin
      .from("chat_messages")
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        updated_at,
        sender:users(name, role)
      `)
      .single();

    if (updateErr || !updatedMessage) {
      console.error("[PUT /api/messages/[id]] Update error:", updateErr);
      return NextResponse.json({ error: "Failed to update message content" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: updatedMessage });
  } catch (err: any) {
    console.error("[PUT /api/messages/[id]] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/messages/[id] - Delete an existing message
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { id: messageId } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve dbUser
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 401 });
    }

    // Fetch message details
    const { data: existingMessage, error: fetchErr } = await supabaseAdmin
      .from("chat_messages")
      .select("id, sender_id")
      .eq("id", messageId)
      .single();

    if (fetchErr || !existingMessage) {
      return NextResponse.json({ error: "Message record not found" }, { status: 404 });
    }

    // Verify sender ownership (or admin role)
    if (dbUser.role !== "admin" && existingMessage.sender_id !== dbUser.id) {
      return NextResponse.json({ error: "Access Denied: You do not own this message" }, { status: 403 });
    }

    // Delete message
    const { error: deleteErr } = await supabaseAdmin
      .from("chat_messages")
      .delete()
      .eq("id", messageId);

    if (deleteErr) {
      console.error("[DELETE /api/messages/[id]] Delete error:", deleteErr);
      return NextResponse.json({ error: "Failed to delete message record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Message deleted successfully" });
  } catch (err: any) {
    console.error("[DELETE /api/messages/[id]] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

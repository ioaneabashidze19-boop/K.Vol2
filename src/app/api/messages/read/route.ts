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

// POST /api/messages/read - Mark all messages in a conversation as read for the current user
export async function POST(req: Request) {
  try {
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

    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    // Verify user is a participant of this conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("id, seeker_id, company_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (dbUser.role !== "admin") {
      const { data: seeker } = await supabaseAdmin
        .from("seekers")
        .select("id")
        .eq("user_id", dbUser.id)
        .single();

      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("owner_id", dbUser.id)
        .single();

      const isSeekerParticipant = seeker && conversation.seeker_id === seeker.id;
      const isCompanyParticipant = company && conversation.company_id === company.id;

      if (!isSeekerParticipant && !isCompanyParticipant) {
        return NextResponse.json({ error: "Access Denied: You are not a participant in this conversation" }, { status: 403 });
      }
    }

    // Update messages: set is_read = true where conversation_id = conversationId and sender_id != dbUser.id
    const { error: updateErr } = await supabaseAdmin
      .from("chat_messages")
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq("conversation_id", conversationId)
      .neq("sender_id", dbUser.id)
      .eq("is_read", false);

    if (updateErr) {
      console.error("[POST /api/messages/read] Error updating read flags:", updateErr);
      return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Messages marked as read" });
  } catch (err: any) {
    console.error("[POST /api/messages/read] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

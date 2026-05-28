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

// POST /api/messages - Send a new message to a conversation
export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
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

    const { conversationId, content } = await req.json();

    if (!conversationId || !content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "conversationId and non-empty content string are required" }, { status: 400 });
    }

    // Verify parent conversation exists and check participation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("id, seeker_id, company_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation thread not found" }, { status: 404 });
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

    // Insert message record
    const { data: newMessage, error: msgError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: dbUser.id,
        content: content.trim(),
        created_at: timestamp,
        updated_at: timestamp
      })
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

    if (msgError || !newMessage) {
      console.error("[POST /api/messages] Supabase write error:", msgError);
      return NextResponse.json({ error: "Failed to transmit chat message" }, { status: 500 });
    }

    // Trigger update_at bump on conversation table to buble active threads to the top
    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: timestamp })
      .eq("id", conversationId);

    return NextResponse.json({ success: true, message: newMessage });
  } catch (err: any) {
    console.error("[POST /api/messages] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

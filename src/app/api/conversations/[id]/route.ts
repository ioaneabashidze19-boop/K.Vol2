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

// GET /api/conversations/[id] - Get chronological messages for a conversation
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
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

    // Fetch parent conversation to verify user is a participant
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

    // Fetch messages
    const { data: messages, error: msgError } = await supabaseAdmin
      .from("chat_messages")
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        updated_at,
        sender:users(name, role)
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) throw msgError;

    return NextResponse.json({ success: true, messages: messages || [] });
  } catch (err: any) {
    console.error("[GET /conversations/[id]] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

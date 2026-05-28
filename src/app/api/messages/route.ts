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
      .select("id, role, first_name, last_name")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 401 });
    }

    const senderName = dbUser.first_name ? `${dbUser.first_name} ${dbUser.last_name || ""}`.trim() : "A participant";

    const { conversationId, content } = await req.json();

    if (!conversationId || !content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "conversationId and non-empty content string are required" }, { status: 400 });
    }

    // Verify parent conversation exists and check participation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("conversations")
      .select(`
        id,
        seeker_id,
        company_id,
        seeker:seekers(id, user_id),
        company:companies(id, owner_id)
      `)
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation thread not found" }, { status: 404 });
    }

    const conversationData = conversation as any;
    const seekerUserId = conversationData.seeker?.user_id;
    const companyUserId = conversationData.company?.owner_id;

    // Resolve recipient user ID
    let recipientUserId = null;
    if (dbUser.id === seekerUserId) {
      recipientUserId = companyUserId;
    } else if (dbUser.id === companyUserId) {
      recipientUserId = seekerUserId;
    } else {
      // Admin sender or system: default to recipient not being the sender
      recipientUserId = dbUser.id === seekerUserId ? companyUserId : seekerUserId;
    }

    if (dbUser.role !== "admin") {
      const isSeekerParticipant = seekerUserId === dbUser.id;
      const isCompanyParticipant = companyUserId === dbUser.id;

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
        is_read: false,
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

    // Trigger update_at bump on conversation table to bubble active threads to the top
    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: timestamp })
      .eq("id", conversationId);

    // Create In-App Notification and trigger throttled Email notification if eligible
    if (recipientUserId) {
      // 1. Create In-App notification
      await supabaseAdmin.from("notifications").insert({
        user_id: recipientUserId,
        title: `New Message from ${senderName}`,
        content: content.length > 80 ? `${content.slice(0, 80)}...` : content,
        is_read: false,
        link_url: `/conversations?id=${conversationId}`
      });

      // 2. Load recipient profile settings to evaluate email options
      const { data: recipientProfile } = await supabaseAdmin
        .from("users")
        .select("email, notification_frequency, email_notifications_enabled, last_email_notification_at")
        .eq("id", recipientUserId)
        .single();

      if (recipientProfile && recipientProfile.email_notifications_enabled && recipientProfile.notification_frequency === "instant") {
        const lastEmail = recipientProfile.last_email_notification_at;
        let isThrottled = false;

        if (lastEmail) {
          const diffMs = new Date(timestamp).getTime() - new Date(lastEmail).getTime();
          const diffMin = diffMs / (1000 * 60);
          if (diffMin < 5) {
            isThrottled = true;
          }
        }

        if (!isThrottled) {
          // Trigger Mock SMTP/Postmark transmission logs
          console.log(`[Email Service Alert] Sending instant email alert to: ${recipientProfile.email}`);
          console.log(`Preview: "${content.slice(0, 60)}..."`);
          console.log(`Reply Room Link: http://localhost:3000/conversations?id=${conversationId}`);

          // Update email notification timestamp
          await supabaseAdmin
            .from("users")
            .update({ last_email_notification_at: timestamp })
            .eq("id", recipientUserId);
        }
      }
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (err: any) {
    console.error("[POST /api/messages] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

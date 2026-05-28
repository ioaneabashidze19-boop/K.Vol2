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

// GET /api/conversations - List conversations of authenticated user
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized: Session token missing" }, { status: 401 });
    }

    // Resolve dbUser
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized: Profile record not found" }, { status: 401 });
    }

    let conversations: any[] = [];

    if (dbUser.role === "admin") {
      // Admins see all conversations
      const { data, error } = await supabaseAdmin
        .from("conversations")
        .select(`
          id,
          created_at,
          updated_at,
          seeker:seekers(id, user_id, user:users(name, email)),
          company:companies(id, name, logo_url)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      conversations = data || [];
    } else {
      // 1. Fetch user's seeker profile
      const { data: seeker } = await supabaseAdmin
        .from("seekers")
        .select("id")
        .eq("user_id", dbUser.id)
        .single();

      // 2. Fetch user's companies profile
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("owner_id", dbUser.id)
        .single();

      // Fallback query parameters based on role/profiles
      if (seeker && company) {
        // User could act as both (edge cases)
        const { data, error } = await supabaseAdmin
          .from("conversations")
          .select(`
            id,
            created_at,
            updated_at,
            seeker:seekers(id, user_id, user:users(name, email)),
            company:companies(id, name, logo_url)
          `)
          .or(`seeker_id.eq.${seeker.id},company_id.eq.${company.id}`)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        conversations = data || [];
      } else if (seeker) {
        // Seeker profile only
        const { data, error } = await supabaseAdmin
          .from("conversations")
          .select(`
            id,
            created_at,
            updated_at,
            seeker:seekers(id, user_id, user:users(name, email)),
            company:companies(id, name, logo_url)
          `)
          .eq("seeker_id", seeker.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        conversations = data || [];
      } else if (company) {
        // Company profile only
        const { data, error } = await supabaseAdmin
          .from("conversations")
          .select(`
            id,
            created_at,
            updated_at,
            seeker:seekers(id, user_id, user:users(name, email)),
            company:companies(id, name, logo_url)
          `)
          .eq("company_id", company.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        conversations = data || [];
      }
    }

    return NextResponse.json({ success: true, conversations });
  } catch (err: any) {
    console.error("[GET /conversations] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/conversations - Create new conversation
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

    const { seekerId, companyId } = await req.json();

    if (!seekerId || !companyId) {
      return NextResponse.json({ error: "seekerId and companyId are required" }, { status: 400 });
    }

    // Verify ownership or participant status
    // The creator must either be the seeker owner, company owner, or admin
    if (dbUser.role !== "admin") {
      const { data: seeker } = await supabaseAdmin
        .from("seekers")
        .select("user_id")
        .eq("id", seekerId)
        .single();

      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("owner_id")
        .eq("id", companyId)
        .single();

      const isSeekerOwner = seeker?.user_id === dbUser.id;
      const isCompanyOwner = company?.owner_id === dbUser.id;

      if (!isSeekerOwner && !isCompanyOwner) {
        return NextResponse.json({ error: "Access Denied: You are not a participant in this conversation" }, { status: 403 });
      }
    }

    // Check if conversation already exists (seeker_id and company_id are unique together)
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("seeker_id", seekerId)
      .eq("company_id", companyId)
      .single();

    if (existing) {
      return NextResponse.json({ success: true, conversationId: existing.id, message: "Conversation already exists" });
    }

    // Create new conversation
    const { data: created, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        seeker_id: seekerId,
        company_id: companyId
      })
      .select("id")
      .single();

    if (error || !created) {
      throw error || new Error("Failed to write conversation record");
    }

    return NextResponse.json({ success: true, conversationId: created.id, message: "Conversation created successfully" });
  } catch (err: any) {
    console.error("[POST /conversations] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

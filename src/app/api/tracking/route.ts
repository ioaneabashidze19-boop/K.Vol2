import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key"
);

export async function POST(req: Request) {
  try {
    const { trackingToken, companyId, clickType, linkUrl, metadata } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    // 1. Resolve or create session attribution tracking record
    let sessionId: string | null = null;
    
    if (trackingToken) {
      const { data: session } = await supabaseAdmin
        .from("session_attribution")
        .select("id")
        .eq("tracking_token", trackingToken)
        .single();
      
      if (session) {
        sessionId = session.id;
      }
    }

    // 2. Insert click event log
    const { data: click, error } = await supabaseAdmin
      .from("click_events")
      .insert({
        session_id: sessionId,
        company_id: companyId,
        click_type: clickType || "view",
        link_url: linkUrl || "",
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, clickId: click.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

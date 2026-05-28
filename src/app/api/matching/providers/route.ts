import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Simple in-memory Cache for 5 minutes (300 seconds)
const cacheMap = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Simple in-memory Rate Limiting (60 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limitInfo = rateLimitMap.get(ip);

  if (!limitInfo || now > limitInfo.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  limitInfo.count += 1;
  if (limitInfo.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for") || "anonymous_ip";

  // Rate Limiting Check
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("request_id");
    const limitParam = searchParams.get("limit") || "10";
    const limit = parseInt(limitParam, 10);

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: request_id" },
        { status: 400 }
      );
    }

    // Cache lookup key
    const cacheKey = `${requestId}_limit_${limit}`;
    const cachedItem = cacheMap.get(cacheKey);
    const now = Date.now();

    if (cachedItem && now - cachedItem.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedItem.data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=59",
          "X-Cache": "HIT",
        },
        status: 200,
      });
    }

    // 1. Fetch the procurement request details first to verify existence and return it
    const { data: requestDetails, error: reqErr } = await supabase
      .from("procurement_posts")
      .select(`
        id, title, description, budget, urgency, required_tools, status, expires_at,
        created_at, updated_at, category, industry, company_size, compliance, pm_style,
        budget_type, require_nda
      `)
      .eq("id", requestId)
      .single();

    if (reqErr || !requestDetails) {
      return NextResponse.json(
        { success: false, error: `Procurement request not found: ${reqErr?.message || ""}` },
        { status: 404 }
      );
    }

    // 2. Call the PostgreSQL matching RPC function
    const { data: rawMatches, error: matchErr } = await supabase.rpc(
      "match_providers_for_request",
      {
        p_request_id: requestId,
        p_limit: limit,
      }
    );

    if (matchErr) {
      throw matchErr;
    }

    const matchesList = rawMatches || [];
    const companyIds = matchesList.map((m: any) => m.company_id);

    let enrichedMatches: any[] = [];

    if (companyIds.length > 0) {
      // 3. Fetch detailed provider company data & services
      const { data: companiesData, error: compErr } = await supabase
        .from("companies")
        .select(`
          id, logo_url, description, rating,
          services (id, category, name, description, starting_price, tech_stack)
        `)
        .in("id", companyIds);

      if (compErr) throw compErr;

      // 4. Fetch reviews count for reviews mapping
      const { data: reviewsData, error: revErr } = await supabase
        .from("reviews")
        .select(`
          id,
          engagements!inner(company_id)
        `);

      if (revErr) throw revErr;

      // Group reviews per company
      const reviewsPerCompanyMap: Record<string, number> = {};
      reviewsData?.forEach((r: any) => {
        const compId = r.engagements?.company_id;
        if (compId) {
          reviewsPerCompanyMap[compId] = (reviewsPerCompanyMap[compId] || 0) + 1;
        }
      });

      // Map matching details to response format
      enrichedMatches = matchesList.map((m: any) => {
        const companyDetail = companiesData?.find((c: any) => c.id === m.company_id);
        const companyServices = companyDetail?.services || [];
        const servicePrices = companyServices.map((s: any) => Number(s.starting_price)).filter((p) => !isNaN(p));
        
        const minPrice = servicePrices.length > 0 ? Math.min(...servicePrices) : 0;
        const maxPrice = servicePrices.length > 0 ? Math.max(...servicePrices) : 0;

        return {
          company_id: m.company_id,
          company_name: m.company_name,
          logo_url: companyDetail?.logo_url || "",
          description: companyDetail?.description || "",
          rating: Number(companyDetail?.rating || m.performance_score / 3.0 || 5.0),
          reviewCount: reviewsPerCompanyMap[m.company_id] || 0,
          totalScore: Number(m.total_score),
          scoreBreakdown: {
            categoryFit: Number(m.category_fit_score),
            industryRelevance: Number(m.industry_relevance_score),
            clientSizeFit: Number(m.client_size_fit_score),
            priceFit: Number(m.price_fit_score),
            performance: Number(m.performance_score),
            reliabilityWorkflow: Number(m.reliability_workflow_score),
          },
          matchExplanations: m.match_explanations || [],
          services: companyServices,
          priceRange: {
            min: minPrice,
            max: maxPrice,
          },
          viewProfileUrl: `/marketplace/providers/${m.company_id}`,
        };
      });
    }

    const responsePayload = {
      success: true,
      data: {
        matches: enrichedMatches,
        totalMatches: enrichedMatches.length,
        requestDetails: requestDetails,
      },
    };

    // Store in Cache
    cacheMap.set(cacheKey, { data: responsePayload, timestamp: now });

    return NextResponse.json(responsePayload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=59",
        "X-Cache": "MISS",
      },
      status: 200,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed computing provider matchmaking scores",
      },
      { status: 500 }
    );
  }
}

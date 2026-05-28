import { NextRequest, NextResponse } from "next/server";

import { supabase } from "@/lib/supabaseClient";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category");
    const ratingMin = parseFloat(searchParams.get("rating_min") || "0");
    const priceMin = parseFloat(searchParams.get("price_min") || "0");
    const priceMax = parseFloat(searchParams.get("price_max") || "1000000");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 50;
    const fromOffset = (page - 1) * limit;

    // Base query selecting active companies
    let query = supabase
      .from("companies")
      .select(`
        id, name, description, logo_url, location, status,
        services (category, starting_price, tech_stack)
      `)
      .eq("status", "active");

    // Text search filter if query term is passed
    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data: companies, error } = await query;
    if (error) throw error;

    // Fetch review ratings to compute average ratings
    const { data: reviews, error: revError } = await supabase
      .from("reviews")
      .select("rating, engagements(company_id)");

    if (revError) throw revError;

    // Map and calculate aggregated filter values
    let results = (companies || []).map((company: any) => {
      const companyServices = company.services || [];
      const companyReviews = reviews?.filter((r: any) => r.engagements?.company_id === company.id) || [];

      const avgRating =
        companyReviews.length > 0
          ? Number((companyReviews.reduce((sum, r) => sum + r.rating, 0) / companyReviews.length).toFixed(1))
          : 5.0;

      const minPrice = companyServices.length > 0 ? Math.min(...companyServices.map((s: any) => Number(s.starting_price))) : 1500;
      const maxPrice = companyServices.length > 0 ? Math.max(...companyServices.map((s: any) => Number(s.starting_price))) : 10000;
      const categories = Array.from(new Set(companyServices.map((s: any) => s.category)));
      const techStack = Array.from(new Set(companyServices.flatMap((s: any) => s.tech_stack || [])));

      return {
        id: company.id,
        name: company.name,
        description: company.description || "",
        logo_url: company.logo_url || "",
        location: company.location || "",
        rating: avgRating,
        reviewCount: companyReviews.length,
        minPrice,
        maxPrice,
        categories,
        techStack,
      };
    });

    // Apply category vertical filtering
    if (category) {
      results = results.filter((p) => p.categories.includes(category));
    }

    // Apply minimum rating filter
    if (ratingMin > 0) {
      results = results.filter((p) => p.rating >= ratingMin);
    }

    // Apply budget scale filtering
    results = results.filter((p) => p.minPrice >= priceMin && p.minPrice <= priceMax);

    const totalCount = results.length;
    const paginatedResults = results.slice(fromOffset, fromOffset + limit);

    // Setup caching headers
    const headers = new Headers();
    headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=59");

    return NextResponse.json(
      {
        success: true,
        data: paginatedResults,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      },
      { headers, status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed resolving search requests",
      },
      { status: 500 }
    );
  }
}

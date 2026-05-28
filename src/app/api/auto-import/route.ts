import { NextRequest, NextResponse } from "next/server";

import { AIProfileParser } from "@/lib/auto-import/ai-parser";
import { CrawlerService } from "@/lib/auto-import/crawler";
import { HTMLParser } from "@/lib/auto-import/parser";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ success: false, error: "URL parameter is required" }, { status: 400 });
    }

    console.log(`[AutoImportAPI] Launching crawl sequence for url: ${url}`);

    // 1. Initialize web crawler
    const crawler = new CrawlerService({ timeout: 20000 });
    const scraped = await crawler.crawlWebsite(url);

    // 2. Initialize HTML cleaner/parser
    const htmlParser = new HTMLParser();
    const cleanText = htmlParser.parseHTMLtoText(scraped.html);
    const cleanHtml = htmlParser.cleanHTML(scraped.html);

    // 3. Initialize Gemini extraction parser
    const aiParser = new AIProfileParser();
    const profile = await aiParser.parseProviderProfile(cleanHtml, cleanText);

    // Add website reference to returned profile
    profile.website = url;

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (err: any) {
    console.error("[AutoImportAPI] Fatal parsing request failure:", err.message);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed resolving automated import",
      },
      { status: 500 }
    );
  }
}

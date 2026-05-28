import * as cheerio from "cheerio";
import { chromium } from "playwright";

export interface ScrapedContent {
  url: string;
  html: string;
  text: string;
  title: string;
  images: ImageData[];
  svgs: string[];
}

export interface ImageData {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface CrawlerConfig {
  timeout?: number;
  userAgent?: string;
  rateLimitMs?: number;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
];

export class CrawlerService {
  private config: CrawlerConfig;

  constructor(config: CrawlerConfig = {}) {
    this.config = {
      timeout: 30000,
      rateLimitMs: 1000,
      ...config,
    };
  }

  private getRandomUserAgent(): string {
    if (this.config.userAgent) return this.config.userAgent;
    const index = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[index];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async crawlWebsite(url: string): Promise<ScrapedContent> {
    console.log(`[CrawlerService] Initializing crawl for: ${url}`);
    let browser: any = null;

    try {
      const userAgent = this.getRandomUserAgent();

      // Launch headless chromium using Playwright
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ userAgent });
      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.config.timeout,
      });

      // Small delay for lazy loaded resources
      await this.delay(1000);

      const html = await page.content();
      const title = await page.title();
      const text = await page.evaluate(() => document.body.innerText || "");

      // Extract SVGs from document tree
      const svgs = await page.evaluate(() => {
        const svgElements = document.querySelectorAll("svg");
        return Array.from(svgElements).map((el) => el.outerHTML);
      });

      await browser.close();

      const images = await this.extractImages(html, url);

      return {
        url,
        html,
        text,
        title,
        images,
        svgs,
      };
    } catch (err: any) {
      console.warn(`[CrawlerService] Playwright execution failed (${err.message}). Falling back to Cheerio fetch.`);
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          // Ignore closure errors
        }
      }

      // Graceful fallback to static fetch request
      const res = await fetch(url, {
        headers: { "User-Agent": this.getRandomUserAgent() },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!res.ok) {
        throw new Error(`Fallback crawl fetch failed with status ${res.status}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $("title").text() || "";
      const text = $("body").text() || "";

      const svgs: string[] = [];
      $("svg").each((_, el) => {
        svgs.push($.html(el));
      });

      const images = await this.extractImages(html, url);

      return {
        url,
        html,
        text,
        title,
        images,
        svgs,
      };
    }
  }

  async crawlMultiplePaths(baseUrl: string, paths: string[]): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];
    const formattedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

    for (const path of paths) {
      const formattedPath = path.startsWith("/") ? path : `/${path}`;
      const fullUrl = `${formattedBase}${formattedPath}`;

      if (this.config.rateLimitMs) {
        await this.delay(this.config.rateLimitMs);
      }

      try {
        const content = await this.crawlWebsite(fullUrl);
        results.push(content);
      } catch (err: any) {
        console.error(`[CrawlerService] Path crawling failed for ${fullUrl}:`, err.message);
      }
    }

    return results;
  }

  async extractImages(html: string, baseUrl: string): Promise<ImageData[]> {
    const $ = cheerio.load(html);
    const images: ImageData[] = [];

    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      const alt = $(el).attr("alt") || "";

      if (src) {
        let resolvedUrl = src;
        try {
          resolvedUrl = new URL(src, baseUrl).toString();
        } catch (urlErr) {
          // Keep raw src path if URL conversion fails
        }

        images.push({
          url: resolvedUrl,
          alt,
        });
      }
    });

    return images;
  }
}

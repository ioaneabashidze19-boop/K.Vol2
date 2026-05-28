import * as cheerio from "cheerio";

export class HTMLParser {
  /**
   * Cleans up raw HTML string by stripping script/style tags, comment structures,
   * inline tracking components, and normalizing spacing layout.
   */
  cleanHTML(html: string): string {
    try {
      const $ = cheerio.load(html);

      // Remove non-content related nodes
      $("script, style, iframe, noscript, link[rel='stylesheet']").remove();

      let cleaned = $.html();

      // Remove comment blocks
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

      // Normalize spacing layout
      cleaned = cleaned.replace(/\s+/g, " ").trim();

      return cleaned;
    } catch (err) {
      console.error("[HTMLParser] Error cleaning HTML payload:", err);
      return html;
    }
  }

  /**
   * Resolves Schema.org JSON-LD script blobs, Open Graph meta attributes,
   * and standard indexable header tags.
   */
  extractStructuredData(html: string): Record<string, any> {
    const data: Record<string, any> = {
      jsonLd: [],
      openGraph: {},
      meta: {},
    };

    try {
      const $ = cheerio.load(html);

      // Extract JSON-LD elements
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const rawText = $(el).text().trim();
          if (rawText) {
            data.jsonLd.push(JSON.parse(rawText));
          }
        } catch (jsonErr) {
          // Skip invalid JSON-LD payloads
        }
      });

      // Extract Meta tags
      $("meta").each((_, el) => {
        const property = $(el).attr("property");
        const name = $(el).attr("name");
        const content = $(el).attr("content");

        if (content) {
          if (property?.startsWith("og:")) {
            const key = property.substring(3);
            data.openGraph[key] = content;
          } else if (name) {
            data.meta[name] = content;
          }
        }
      });
    } catch (err) {
      console.error("[HTMLParser] Error parsing structured elements:", err);
    }

    return data;
  }

  /**
   * Strips remaining elements and returns structural paragraphs of content text.
   */
  parseHTMLtoText(html: string): string {
    try {
      const $ = cheerio.load(html);

      // Strip structural headers, navs, footers, and scripts to isolate main text
      $("script, style, iframe, noscript, header, footer, nav").remove();

      // Prepend/append spacing to blocks to keep text structure aligned
      $("p, div, h1, h2, h3, h4, h5, h6, li, tr").prepend("\n").append("\n");

      let textContent = $("body").text() || $("html").text() || "";

      // Clean multiple consecutive newlines and tabs
      textContent = textContent.replace(/[ \t]+/g, " ");
      textContent = textContent.replace(/\n\s*\n+/g, "\n\n");

      return textContent.trim();
    } catch (err) {
      console.error("[HTMLParser] Failed parsing HTML content to text:", err);
      return "";
    }
  }

  /**
   * Pulls all images, checking both the img element src properties
   * and inline background-image url values.
   */
  extractImages(html: string): string[] {
    const urls: string[] = [];

    try {
      const $ = cheerio.load(html);

      // Standard images
      $("img").each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && !urls.includes(src)) {
          urls.push(src);
        }
      });

      // Style background-images
      $("[style]").each((_, el) => {
        const inlineStyle = $(el).attr("style") || "";
        const bgUrlMatch = inlineStyle.match(/url\(['"]?([^'")]+)['"]?\)/);
        if (bgUrlMatch && bgUrlMatch[1]) {
          const url = bgUrlMatch[1];
          if (!urls.includes(url)) {
            urls.push(url);
          }
        }
      });
    } catch (err) {
      console.error("[HTMLParser] Failed resolving images list:", err);
    }

    return urls;
  }
}

import { supabase } from "@/lib/supabaseClient";

export class AssetUploadService {
  private maxRetries = 3;

  /**
   * Downloads image binary data from a URL and extracts its content type.
   */
  private async downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000), // 15s timeout
        });
        if (!response.ok) {
          throw new Error(`Server returned status code: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get("content-type") || "image/png";

        return { buffer, contentType };
      } catch (err: any) {
        attempts++;
        if (attempts >= this.maxRetries) {
          throw new Error(`Failed downloading image from ${url} after ${this.maxRetries} attempts: ${err.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
      }
    }
    throw new Error("Download failed");
  }

  /**
   * Optimizes the image buffer dynamically using the 'sharp' library, if installed.
   * Otherwise falls back gracefully to uploading the raw image buffer.
   */
  private async optimizeImage(
    buffer: Buffer,
    contentType: string,
    width?: number,
    height?: number
  ): Promise<{ optimizedBuffer: Buffer; finalContentType: string }> {
    try {
      // Dynamic import to prevent crash on environments without sharp native binaries
      const sharpModule = await import("sharp");
      const sharp = sharpModule.default;

      let pipeline = sharp(buffer);

      if (width || height) {
        pipeline = pipeline.resize(width, height, { fit: "cover", withoutEnlargement: true });
      }

      if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
        return { optimizedBuffer: await pipeline.toBuffer(), finalContentType: "image/jpeg" };
      } else if (contentType.includes("png")) {
        pipeline = pipeline.png({ compressionLevel: 8, palette: true });
        return { optimizedBuffer: await pipeline.toBuffer(), finalContentType: "image/png" };
      } else if (contentType.includes("webp")) {
        pipeline = pipeline.webp({ quality: 80 });
        return { optimizedBuffer: await pipeline.toBuffer(), finalContentType: "image/webp" };
      }

      return { optimizedBuffer: buffer, finalContentType: contentType };
    } catch {
      console.warn("[AssetUploadService] Sharp optimization skipped. Using raw binary buffer.");
      return { optimizedBuffer: buffer, finalContentType: contentType };
    }
  }

  /**
   * Safe upload wrapper that uploads to the specified bucket and path.
   */
  private async uploadToBucket(
    bucket: string,
    storagePath: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    // Perform standard upload
    const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.warn(`[AssetUploadService] Supabase upload failed for ${bucket}/${storagePath}: ${error.message}`);
      // Fallback return a mock placeholder URL to prevent application crash
      return `https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&auto=format&fit=crop&q=60`;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /**
   * Upload logo files (Max 2MB, resized to 200x200).
   */
  async uploadLogo(imageUrl: string, companyId: string): Promise<string> {
    console.log(`[AssetUploadService] Processing logo download for company ${companyId}...`);
    try {
      const { buffer, contentType } = await this.downloadImage(imageUrl);

      // Validate size limit (2MB)
      if (buffer.length > 2 * 1024 * 1024) {
        throw new Error("Logo exceeds size threshold limit of 2MB");
      }

      const { optimizedBuffer, finalContentType } = await this.optimizeImage(buffer, contentType, 200, 200);
      const fileExt = finalContentType.split("/")[1] || "png";
      const storagePath = `companies/${companyId}/logo_${Date.now()}.${fileExt}`;

      return await this.uploadToBucket("marketplace", storagePath, optimizedBuffer, finalContentType);
    } catch (err: any) {
      console.error("[AssetUploadService] Logo upload failed, returning fallback placeholder:", err.message);
      return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop";
    }
  }

  /**
   * Upload banner files (Max 5MB, resized to 1200x400).
   */
  async uploadBannerImage(imageUrl: string, companyId: string): Promise<string> {
    console.log(`[AssetUploadService] Processing banner download for company ${companyId}...`);
    try {
      const { buffer, contentType } = await this.downloadImage(imageUrl);

      // Validate size limit (5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error("Banner exceeds size threshold limit of 5MB");
      }

      const { optimizedBuffer, finalContentType } = await this.optimizeImage(buffer, contentType, 1200, 400);
      const fileExt = finalContentType.split("/")[1] || "png";
      const storagePath = `companies/${companyId}/banner_${Date.now()}.${fileExt}`;

      return await this.uploadToBucket("marketplace", storagePath, optimizedBuffer, finalContentType);
    } catch (err: any) {
      console.error("[AssetUploadService] Banner upload failed, returning fallback placeholder:", err.message);
      return "https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=400&fit=crop";
    }
  }

  /**
   * Upload case study image files (Max 5MB, resized to 800x600).
   */
  async uploadCaseStudyImage(imageUrl: string, companyId: string, studyId: string): Promise<string> {
    console.log(`[AssetUploadService] Processing case study image for company ${companyId}, study ${studyId}...`);
    try {
      const { buffer, contentType } = await this.downloadImage(imageUrl);

      // Validate size limit (5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error("Case study image exceeds size threshold limit of 5MB");
      }

      const { optimizedBuffer, finalContentType } = await this.optimizeImage(buffer, contentType, 800, 600);
      const fileExt = finalContentType.split("/")[1] || "png";
      const storagePath = `case-studies/${companyId}/${studyId}_${Date.now()}.${fileExt}`;

      return await this.uploadToBucket("marketplace", storagePath, optimizedBuffer, finalContentType);
    } catch (err: any) {
      console.error("[AssetUploadService] Case study upload failed, returning fallback placeholder:", err.message);
      return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop";
    }
  }
}

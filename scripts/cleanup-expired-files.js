/**
 * Cron / Scheduled Job Script: Cleanup Expired Files
 * Description: Scans the files metadata table for entries where the expiration timestamp 
 *              has passed, deletes files from the Supabase Storage bucket, and removes 
 *              metadata records from the database.
 * 
 * Run with: `node scripts/cleanup-expired-files.js`
 */

// If running in a Node environment without native ESM, use standard require
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
  console.log(`[${new Date().toISOString()}] Starting cleanup of expired files...`);

  try {
    // 1. Fetch expired files
    const { data: expiredFiles, error: fetchError } = await supabase
      .from("files")
      .select("id, storage_path")
      .lt("expires_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredFiles || expiredFiles.length === 0) {
      console.log("No expired files found.");
      return;
    }

    console.log(`Found ${expiredFiles.length} expired files. Commencing removal...`);

    // 2. Remove files from storage buckets and DB
    for (const file of expiredFiles) {
      console.log(`Deleting file: ${file.storage_path} (ID: ${file.id})`);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("shares")
        .remove([file.storage_path]);

      if (storageError) {
        console.error(`Failed to delete storage path ${file.storage_path}:`, storageError.message);
      }

      // Delete database record
      const { error: dbError } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id);

      if (dbError) {
        console.error(`Failed to delete database record for ID ${file.id}:`, dbError.message);
      }
    }

    console.log("Cleanup job run completed successfully.");
  } catch (error) {
    console.error("Error occurred during cleanup job execution:", error);
    process.exit(1);
  }
}

cleanup();

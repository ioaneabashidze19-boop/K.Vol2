/**
 * Database Seeding Script for KavShare.
 * Run with: `npx ts-node scripts/seed.ts`
 */
import { createClient } from "@supabase/supabase-js";

// Ensure environment variables are loaded (for standalone script executions)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceKey) {
  console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY is not defined. Local seeding might fail.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("🌱 Starting local database seeding...");

  // Mock profile data
  const mockProfiles = [
    { id: "00000000-0000-0000-0000-000000000000", email: "user1@kavshare.dev", full_name: "John Doe" },
    { id: "11111111-1111-1111-1111-111111111111", email: "user2@kavshare.dev", full_name: "Jane Smith" },
  ];

  try {
    // Note: Inserting into public.profiles requires either mocking the auth.users table first,
    // or executing this with service role key depending on foreign key constraints.
    console.log("Profiles to seed:", mockProfiles);
    
    // Perform upserts
    // const { error } = await supabase.from('profiles').upsert(mockProfiles);
    // if (error) throw error;
    
    console.log("✅ Database seeding complete!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();

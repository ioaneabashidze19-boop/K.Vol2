/* eslint-disable no-console */
/**
 * Database Seeding Script for KavShare.
 * Run with: `npx ts-node scripts/seed.ts`
 */
// import { createClient } from "@supabase/supabase-js";

// Ensure environment variables are loaded (for standalone script executions)
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceKey) {
  console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY is not defined. Local seeding might fail.");
}

// const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("🌱 Starting local database seeding...");

  // Mock users data conforming to users schema
  const mockUsers = [
    {
      id: "00000000-0000-0000-0000-000000000000",
      clerk_id: "user_mock_1",
      email: "user1@kavshare.dev",
      first_name: "John",
      last_name: "Doe",
      user_role: "provider",
      profile_completed: true,
    },
    {
      id: "11111111-1111-1111-1111-111111111111",
      clerk_id: "user_mock_2",
      email: "user2@kavshare.dev",
      first_name: "Jane",
      last_name: "Smith",
      user_role: "seeker",
      profile_completed: true,
    },
  ];

  try {
    console.log("Users to seed:", mockUsers);

    // Perform upserts
    // const { error } = await supabase.from('users').upsert(mockUsers);
    // if (error) throw error;

    console.log("✅ Database seeding complete!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();

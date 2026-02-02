import db from "../config/knex";

/**
 * Check database schema for g_game_worlds table
 */
async function checkSchema() {
  console.log("🔍 Checking g_game_worlds table schema...\n");

  try {
    // Check table structure
    const columns = await db.raw("DESCRIBE g_game_worlds");
    console.log("📊 Table structure:");
    console.table(columns[0]);

    // Check if there are any existing records
    const count = await db("g_game_worlds").count("* as count").first();
    console.log(`\n📈 Total records: ${count?.count}`);

    // Show sample data if any exists
    const sample = await db("g_game_worlds").limit(3);
    if (sample.length > 0) {
      console.log("\n📋 Sample data:");
      console.table(sample);
    }
  } catch (error) {
    console.error("❌ Error checking schema:", error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run the check if this file is executed directly
if (require.main === module) {
  checkSchema()
    .then(() => {
      console.log("\n✅ Schema check completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Schema check failed:", error);
      process.exit(1);
    });
}

export { checkSchema };

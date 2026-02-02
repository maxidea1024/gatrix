import { knexConfig } from "../src/config/knex";
import Knex from "knex";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  // Override DB connection for local execution against Docker
  const config = { ...knexConfig };
  if (
    config.connection &&
    typeof config.connection !== "string" &&
    typeof config.connection !== "function"
  ) {
    (config.connection as any).host = "127.0.0.1";
    (config.connection as any).port = 43306;
    (config.connection as any).user = "gatrix_user";
    (config.connection as any).password = "gatrix_password";
    (config.connection as any).database = "gatrix";
  }

  const knex = Knex(config);

  try {
    console.log("Checking ts-only-server-token...");

    // Find 'ts-only-server-token'
    const token = await knex("g_api_access_tokens")
      .where("tokenName", "ts-only-server-token")
      .first();
    if (!token) {
      console.error('Error: "ts-only-server-token" not found in database.');
      return;
    }

    console.log("Token details:");
    console.log("  id:", token.id);
    console.log("  tokenName:", token.tokenName);
    console.log("  tokenType:", token.tokenType);
    console.log(
      "  allowAllEnvironments:",
      token.allowAllEnvironments,
      "(type:",
      typeof token.allowAllEnvironments,
      ")",
    );

    // Check environment mappings
    const envMappings = await knex("g_api_access_token_environments")
      .where("tokenId", token.id)
      .select("environmentId");

    console.log(
      "  Environment mappings:",
      envMappings.map((e) => e.environmentId),
    );

    // If allowAllEnvironments is false/0 but should be true, fix it
    if (
      token.allowAllEnvironments === 0 ||
      token.allowAllEnvironments === false
    ) {
      console.log("\n  NOTE: allowAllEnvironments is FALSE in DB.");
      console.log(
        '  If UI shows "All Environments", there may be a frontend/backend sync issue.',
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  } finally {
    await knex.destroy();
  }
}

main();

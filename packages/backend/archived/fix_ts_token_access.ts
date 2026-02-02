import { knexConfig } from "../src/config/knex";
import { Model } from "objection";
import Knex from "knex";
import dotenv from "dotenv";
import path from "path";
import { ulid } from "ulid";

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  // Initialize Knex
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
  Model.knex(knex);

  try {
    console.log("Starting fix_ts_token_access script...");

    // 1. Find 'ts' environment
    console.log('Finding "ts" environment...');
    const tsEnv = await knex("g_environments")
      .where("environmentName", "ts")
      .first();
    if (!tsEnv) {
      console.error('Error: "ts" environment not found in database.');
      // List all environments to help debugging
      const allEnvs = await knex("g_environments").select(
        "environmentName",
        "id",
      );
      console.log("Available environments:", allEnvs);
      return;
    }
    console.log(
      `Found "ts" environment: ${tsEnv.id} (${tsEnv.environmentName})`,
    );

    // 2. Find 'ts-only-server-token'
    console.log('Finding "ts-only-server-token"...');
    const token = await knex("g_api_access_tokens")
      .where("tokenName", "ts-only-server-token")
      .first();
    if (!token) {
      console.error('Error: "ts-only-server-token" not found in database.');
      // List all tokens to help debugging
      const allTokens = await knex("g_api_access_tokens").select(
        "tokenName",
        "id",
      );
      console.log("Available tokens:", allTokens);
      return;
    }
    console.log(`Found token: ${token.id} (${token.tokenName})`);

    // 3. Check and add access
    console.log("Checking existing access...");
    const existing = await knex("g_api_access_token_environments")
      .where({
        tokenId: token.id,
        environmentId: tsEnv.id,
      })
      .first();

    // Check table structure
    // const columns = await knex.raw('SHOW COLUMNS FROM g_api_access_token_environments');
    // console.log('Table structure:', columns[0]);

    if (existing) {
      console.log("Access mapping already exists. No changes needed.");
    } else {
      console.log("Adding access mapping...");
      await knex("g_api_access_token_environments").insert({
        id: ulid(),
        tokenId: token.id,
        environmentId: tsEnv.id,
        createdAt: new Date(),
      });
      console.log("Access mapping added successfully.");
    }
  } catch (error) {
    console.error("Unexpected error:", JSON.stringify(error, null, 2));
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
  } finally {
    await knex.destroy();
  }
}

main();

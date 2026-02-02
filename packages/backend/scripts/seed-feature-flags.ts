/**
 * Feature Flag Seed Script
 *
 * Creates test feature flags for SDK testing
 * Run with: yarn ts-node scripts/seed-feature-flags.ts
 */

import db from "../src/config/knex";
import { ulid } from "ulid";

const ENVIRONMENT = "development";
const CREATED_BY = 1; // Admin user ID

async function main() {
  console.log("=".repeat(60));
  console.log("Feature Flag Seed Script");
  console.log("=".repeat(60));

  try {
    // 1. Basic enabled flag
    await createFlag({
      flagName: "test-basic-enabled",
      displayName: "Test Basic Enabled",
      description: "A simple flag that is always enabled",
      strategies: [{ name: "default", parameters: {}, isEnabled: true }],
    });

    // 2. Rollout 50% flag (for stickiness testing)
    await createFlag({
      flagName: "test-rollout-50",
      displayName: "Test 50% Rollout",
      description: "Flag with 50% gradual rollout for stickiness testing",
      strategies: [
        {
          name: "flexibleRollout",
          parameters: {
            rollout: 50,
            stickiness: "default",
            groupId: "test-rollout-50",
          },
          isEnabled: true,
        },
      ],
    });

    // 3. Constraint flag (admin only)
    await createFlag({
      flagName: "test-admin-only",
      displayName: "Test Admin Only",
      description: "Flag enabled only for admin users",
      strategies: [
        {
          name: "default",
          parameters: {},
          constraints: [
            { contextName: "role", operator: "str_eq", values: ["admin"] },
          ],
          isEnabled: true,
        },
      ],
    });

    // 4. Variants flag (A/B test)
    await createFlag({
      flagName: "test-variants-ab",
      displayName: "Test A/B Variants",
      description: "Flag with multiple variants for A/B testing",
      strategies: [
        {
          name: "flexibleRollout",
          parameters: {
            rollout: 100,
            stickiness: "default",
            groupId: "test-variants-ab",
          },
          isEnabled: true,
        },
      ],
      variants: [
        {
          variantName: "control",
          weight: 50,
          payload: { version: "A" },
          payloadType: "json",
        },
        {
          variantName: "experiment",
          weight: 50,
          payload: { version: "B" },
          payloadType: "json",
        },
      ],
    });

    // 5. Multiple strategies flag
    await createFlag({
      flagName: "test-multi-strategy",
      displayName: "Test Multiple Strategies",
      description: "Flag with multiple strategies (first match wins)",
      strategies: [
        {
          name: "userWithId",
          parameters: { userIds: ["vip-user-1", "vip-user-2"] },
          isEnabled: true,
          sortOrder: 0,
        },
        {
          name: "flexibleRollout",
          parameters: {
            rollout: 20,
            stickiness: "default",
            groupId: "test-multi",
          },
          isEnabled: true,
          sortOrder: 1,
        },
      ],
    });

    // 6. Disabled flag (for testing disabled state)
    await createFlag({
      flagName: "test-disabled",
      displayName: "Test Disabled Flag",
      description: "A flag that is globally disabled",
      isEnabled: false,
      strategies: [{ name: "default", parameters: {}, isEnabled: true }],
    });

    console.log("\n" + "=".repeat(60));
    console.log("Seed completed successfully!");
    console.log("=".repeat(60));
  } catch (error: any) {
    console.error("Error:", error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

interface FlagConfig {
  flagName: string;
  displayName: string;
  description: string;
  isEnabled?: boolean;
  strategies: Array<{
    name: string;
    parameters: Record<string, any>;
    constraints?: Array<{
      contextName: string;
      operator: string;
      values: string[];
    }>;
    isEnabled: boolean;
    sortOrder?: number;
  }>;
  variants?: Array<{
    variantName: string;
    weight: number;
    payload?: any;
    payloadType: string;
  }>;
}

async function createFlag(config: FlagConfig) {
  const flagId = ulid();
  const now = new Date();

  // Check if flag already exists
  const existing = await db("g_feature_flags")
    .where("flagName", config.flagName)
    .first();
  if (existing) {
    console.log(`  ⚠ Flag "${config.flagName}" already exists, skipping`);
    return;
  }

  // Create flag
  await db("g_feature_flags").insert({
    id: flagId,
    flagName: config.flagName,
    displayName: config.displayName,
    description: config.description,
    flagType: "release",
    isArchived: false,
    impressionDataEnabled: true,
    createdBy: CREATED_BY,
    createdAt: now,
    updatedAt: now,
  });

  // Create flag-environment link
  const envId = ulid();
  await db("g_feature_flag_environments").insert({
    id: envId,
    flagId: flagId,
    environment: ENVIRONMENT,
    isEnabled: config.isEnabled !== false,
    createdBy: CREATED_BY,
    createdAt: now,
    updatedAt: now,
  });

  // Create strategies
  for (let i = 0; i < config.strategies.length; i++) {
    const strategy = config.strategies[i];
    const strategyId = ulid();

    await db("g_feature_strategies").insert({
      id: strategyId,
      flagId: flagId,
      environment: ENVIRONMENT,
      strategyName: strategy.name,
      parameters: JSON.stringify(strategy.parameters),
      constraints: JSON.stringify(strategy.constraints || []),
      sortOrder: strategy.sortOrder ?? i,
      isEnabled: strategy.isEnabled,
      createdBy: CREATED_BY,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create variants
  if (config.variants) {
    for (const variant of config.variants) {
      const variantId = ulid();
      await db("g_feature_variants").insert({
        id: variantId,
        flagId: flagId,
        environment: ENVIRONMENT,
        variantName: variant.variantName,
        weight: variant.weight,
        payload: JSON.stringify(variant.payload),
        payloadType: variant.payloadType,
        createdBy: CREATED_BY,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(`  ✓ Created flag: ${config.flagName}`);
}

main();

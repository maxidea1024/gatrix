/**
 * Feature Flag SDK Test
 *
 * Tests the feature flag evaluation system with various scenarios
 * Run with: npx ts-node test-servers/feature-flag-test.ts
 */

import { GatrixServerSDK } from "../src/index";

const environment = process.env.ENVIRONMENT || "development";

async function main() {
  console.log("=".repeat(60));
  console.log("Feature Flag SDK Test");
  console.log("=".repeat(60));

  const sdk = new GatrixServerSDK({
    gatrixUrl: process.env.GATRIX_URL || "http://localhost:45000",
    apiToken: process.env.API_TOKEN || "gatrix-unsecured-server-api-token",
    applicationName: "feature-flag-test",
    service: "test",
    group: "development",
    environment,

    cache: {
      enabled: true,
      ttl: 300,
      refreshMethod: "polling",
    },

    features: {
      gameWorld: false,
      popupNotice: false,
      survey: false,
      whitelist: false,
      serviceMaintenance: false,
      featureFlag: true, // Only enable feature flags
    },

    logger: {
      level: "info",
      timeOffset: 9,
      timestampFormat: "local",
    },
  });

  try {
    console.log("\n[1] Initializing SDK...");
    await sdk.initialize();
    console.log("    ✓ SDK initialized");

    // Test 1: Get all cached flags
    console.log("\n[2] Testing getCached()...");
    const allFlags = sdk.featureFlag.getCached(environment);
    console.log(`    ✓ Retrieved ${allFlags.length} flags`);
    allFlags.forEach((flag) => {
      console.log(
        `      - ${flag.name}: enabled=${flag.isEnabled}, strategies=${flag.strategies.length}, variants=${flag.variants?.length || 0}`,
      );
    });

    if (allFlags.length === 0) {
      console.log(
        "\n    ⚠ No flags found. Please create some feature flags first.",
      );
      console.log("    Test completed with limited scope.");
      process.exit(0);
    }

    // Test 2: Get specific flag by name
    console.log("\n[3] Testing getFlagByName()...");
    const testFlagName = allFlags[0].name;
    const flag = sdk.featureFlag.getFlagByName(environment, testFlagName);
    if (flag) {
      console.log(`    ✓ Found flag: ${flag.name}`);
      console.log(`      - isEnabled: ${flag.isEnabled}`);
      console.log(
        `      - impressionDataEnabled: ${flag.impressionDataEnabled}`,
      );
      console.log(`      - strategies count: ${flag.strategies.length}`);
    } else {
      console.log(`    ✗ Flag not found: ${testFlagName}`);
    }

    // Test 3: Evaluate with different contexts
    console.log("\n[4] Testing evaluate() with various contexts...");
    const testContexts = [
      { userId: "user-001", sessionId: "session-001" },
      { userId: "user-002", sessionId: "session-002" },
      { userId: "admin-001", role: "admin" },
      { userId: "premium-user", plan: "premium" },
      { userId: "free-user", plan: "free" },
    ];

    for (const testFlag of allFlags.slice(0, 3)) {
      // Test up to 3 flags
      console.log(`\n    Flag: ${testFlag.name}`);
      for (const context of testContexts) {
        const result = sdk.featureFlag.evaluate(
          testFlag.name,
          context,
          environment,
        );
        const variantInfo = result.variant
          ? `, variant=${result.variant.name}`
          : "";
        console.log(
          `      userId=${context.userId} → enabled=${result.enabled}, reason=${result.reason}${variantInfo}`,
        );
      }
    }

    // Test 4: Test typed variation methods
    console.log("\n[5] Testing typed variation methods...");
    const testContext = { userId: "test-user" };

    // Boolean variation (flagName, context, environment, defaultValue)
    const boolResult = sdk.featureFlag.boolVariation(
      testFlagName,
      testContext,
      environment,
      false,
    );
    console.log(`    boolVariation('${testFlagName}'): ${boolResult}`);

    // Boolean variation detail
    const boolDetailResult = sdk.featureFlag.boolVariationDetail(
      testFlagName,
      testContext,
      environment,
      false,
    );
    console.log(
      `    boolVariationDetail: value=${boolDetailResult.value}, reason=${boolDetailResult.reason}`,
    );

    // String variation
    const stringResult = sdk.featureFlag.stringVariation(
      testFlagName,
      testContext,
      environment,
      "default",
    );
    console.log(`    stringVariation: ${stringResult}`);

    // Number variation
    const numberResult = sdk.featureFlag.numberVariation(
      testFlagName,
      testContext,
      environment,
      0,
    );
    console.log(`    numberVariation: ${numberResult}`);

    // JSON variation
    const jsonResult = sdk.featureFlag.jsonVariation(
      testFlagName,
      testContext,
      environment,
      {},
    );
    console.log(`    jsonVariation: ${JSON.stringify(jsonResult)}`);

    // Test 5: Test rollout consistency (stickiness)
    console.log("\n[6] Testing rollout consistency (stickiness)...");
    console.log(`    Testing stickiness for flag: ${testFlagName}`);

    // Same user should get consistent results
    const consistentContext = { userId: "sticky-user-123" };
    const results: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      const result = sdk.featureFlag.evaluate(
        testFlagName,
        consistentContext,
        environment,
      );
      results.push(result.enabled);
    }
    const allSame = results.every((r) => r === results[0]);
    console.log(
      `    ✓ Same user gets consistent result: ${allSame ? "PASS" : "FAIL"}`,
    );
    console.log(`      Results: [${results.join(", ")}]`);

    // Test complete
    console.log("\n" + "=".repeat(60));
    console.log("All tests completed successfully!");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error: any) {
    console.error("\n✗ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

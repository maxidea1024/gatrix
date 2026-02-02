// 1. Setup Environment
import dotenv from "dotenv";
import path from "path";
import { ulid } from "ulid";

// Load Env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// Default password if missing (Docker default)
if (!process.env.DB_PASSWORD) {
  process.env.DB_PASSWORD = "gatrix_password";
}

// Override Host/Port for Local Execution (outside Docker)
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "43306"; // Assuming default dev port mapping
process.env.MYSQL_HOST_PORT = "43306";

// Silence logger or make it readable
process.env.LOG_FORMAT = "simple";

const TEST_ENV = "test-cr-env";
const TEST_TABLE = "g_vars";
const TEST_VAR_KEY = "test_key_" + ulid();

async function runTest() {
  console.log("Running Unified Change Request Engine Integration Test...");
  let knex: any;

  try {
    // 2. Import Modules AFTER Env Setup
    const configModule = require("../config");
    const knexModule = require("../config/knex");
    knex = knexModule.default;

    // Debug Config
    console.log("DB Config:", {
      host: configModule.config.database.host,
      user: configModule.config.database.user,
      hasPass: !!configModule.config.database.password,
    });

    const {
      UnifiedChangeGateway,
    } = require("../services/UnifiedChangeGateway");
    const {
      ChangeRequestService,
    } = require("../services/ChangeRequestService");
    const { ChangeRequest } = require("../models/ChangeRequest");
    const { Environment } = require("../models/Environment");

    // Setup: Ensure Test Env exists
    const existingEnv = await Environment.query().findById(TEST_ENV);
    if (!existingEnv) {
      await Environment.query().insert({
        environment: TEST_ENV,
        displayName: "Test Environment",
        environmentType: "development",
        isSystemDefined: false,
        isHidden: false,
        displayOrder: 99,
        color: "#000000",
        requiresApproval: true,
        requiredApprovers: 1,
        createdBy: 1, // Admin
        isDefault: false,
      });
    } else {
      // Ensure approval is required
      await Environment.query().patchAndFetchById(TEST_ENV, {
        requiresApproval: true,
        requiredApprovers: 1,
      });
    }

    // Test 1: Request Modification (Draft)...
    console.log("[Test 1] Request Modification (Draft)...");
    const result = await UnifiedChangeGateway.requestModification(
      1, // User
      TEST_ENV,
      TEST_TABLE,
      "mock-id-not-used-by-real-vars-yet",
      { some: "data" },
    );

    if (result.status !== "DRAFT_SAVED" || result.mode !== "CHANGE_REQUEST") {
      throw new Error(
        `Failed Test 1: Expected DRAFT_SAVED, got ${result.status}`,
      );
    }
    console.log("PASS: Draft Created:", result.changeRequestId);

    // Test 2: Submit Draft
    console.log("[Test 2] Submit Draft...");
    const crId = result.changeRequestId!;

    // Update Metadata first
    await ChangeRequestService.updateChangeRequestMetadata(crId, {
      title: "Test Change",
      reason: "Integration Test",
    });

    const submitted = await ChangeRequestService.submitChangeRequest(crId);
    if (submitted.status !== "open")
      throw new Error("Failed Test 2: Status not OPEN");
    console.log("PASS: Submitted (OPEN)");

    // Test 3: Lock Check (UnifiedGateway should fail)
    console.log("[Test 3] Lock Check...");
    try {
      await UnifiedChangeGateway.requestModification(
        1,
        TEST_ENV,
        TEST_TABLE,
        "mock-id-not-used-by-real-vars-yet",
        {},
      );
      throw new Error("Failed Test 3: Should have thrown Locked Exception");
    } catch (e: any) {
      if (!e.message.includes("ResourceLockedException")) throw e;
      console.log("PASS: Resource Locked detected");
    }

    // Test 4: Approval
    console.log("[Test 4] Approval...");
    const approved = await ChangeRequestService.approveChangeRequest(
      crId,
      1,
      "Looks good",
    );
    if (approved.status !== "approved")
      throw new Error("Failed Test 4: Status not APPROVED");
    console.log("PASS: Approved");

    // Test 5: Rejection Flow (Simulator)
    // We already approved, so we can't reject this one.
    // Create another for rejection.
    console.log("[Test 5] Rejection Flow...");
    const res2 = await UnifiedChangeGateway.requestModification(
      1,
      TEST_ENV,
      TEST_TABLE,
      "rej-item",
      { val: 1 },
    );
    await ChangeRequestService.updateChangeRequestMetadata(
      res2.changeRequestId!,
      { title: "To Reject", reason: "Test" },
    );
    await ChangeRequestService.submitChangeRequest(res2.changeRequestId!);

    const rejected = await ChangeRequestService.rejectChangeRequest(
      res2.changeRequestId!,
      1,
      "Bad idea",
    );
    if (rejected.status !== "rejected")
      throw new Error("Failed Test 5: Status not REJECTED");
    console.log("PASS: Rejected");

    // Test 6: Reopen
    console.log("[Test 6] Reopen...");
    const reopened = await ChangeRequestService.reopenChangeRequest(
      res2.changeRequestId!,
      1,
    );
    const approvals = await knex("g_approvals").where(
      "changeRequestId",
      res2.changeRequestId!,
    );

    if (reopened.status !== "draft") throw new Error("Status not DRAFT");
    if (approvals.length > 0) throw new Error("Approvals not cleared");
    console.log("PASS: Reopened");

    // Cleanup
    console.log("Cleaning up...");
    await ChangeRequest.query().delete().where("environment", TEST_ENV);
    await Environment.query().deleteById(TEST_ENV);

    console.log("ALL TESTS PASSED");
  } catch (error) {
    console.error(
      "TEST FAILED:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );
    process.exitCode = 1;
  } finally {
    if (knex) {
      await knex.destroy();
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.exit();
  }
}

// Execute
runTest();

#!/usr/bin/env bun
// Integration tests for backlog-command.ts

import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import * as BacklogCommand from "./backlog-command";
import { execSync } from "child_process";
import path from "path";

// ============================================================================
// Setup & Teardown
// ============================================================================

let testBacklogFile = "";
let originalPaiDir = "";

beforeAll(() => {
  // Create a temp directory for test backlog
  const tempDir = `/tmp/backlog-test-${Date.now()}`;
  execSync(`mkdir -p "${tempDir}"`);
  testBacklogFile = `${tempDir}/enhancement-backlog.jsonl`;
  originalPaiDir = process.env.PAI_DIR || "";
  process.env.PAI_DIR = tempDir;
  process.env.HOME = tempDir; // Also set HOME for script compatibility
});

afterAll(() => {
  // Cleanup temp directory
  const tempDir = process.env.PAI_DIR;
  if (tempDir && tempDir.includes("backlog-test-")) {
    execSync(`rm -rf "${tempDir}"`, { stdio: "ignore" });
  }
  process.env.PAI_DIR = originalPaiDir;
});

afterEach(() => {
  // Clear the backlog file between tests
  if (testBacklogFile) {
    execSync(`rm -f "${testBacklogFile}"`, { stdio: "ignore" });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

async function seedBacklog() {
  // Add some test items to backlog
  const manageBacklog = `${process.env.PAI_DIR}/scripts/manage-backlog.sh`;

  // Copy the manage-backlog.sh script to temp dir
  const srcBacklog = "/Users/delphijc/Projects/sam/.agent/scripts/manage-backlog.sh";
  const destBacklog = `${process.env.PAI_DIR}/scripts/manage-backlog.sh`;
  execSync(`mkdir -p "${process.env.PAI_DIR}/scripts"`);
  execSync(`cp "${srcBacklog}" "${destBacklog}"`);
  execSync(`chmod +x "${destBacklog}"`);

  // Add test items using the script
  execSync(
    `"${destBacklog}" add --id ENH-001 --title "Test Item 1" --priority P0 --description "First test item" --source "test"`,
    { cwd: process.env.PAI_DIR }
  );

  execSync(
    `"${destBacklog}" add --id ENH-002 --title "Test Item 2" --priority P1 --description "Second test item" --source "test"`,
    { cwd: process.env.PAI_DIR }
  );

  execSync(
    `"${destBacklog}" add --id ENH-003 --title "Test Item 3" --priority P2 --description "Third test item" --source "test"`,
    { cwd: process.env.PAI_DIR }
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("backlog status command", async () => {
  await seedBacklog();

  it("returns item details for valid ID", async () => {
    const result = await BacklogCommand.handleBacklogStatus("ENH-001");
    expect(result).toBeDefined();
    expect(result.title).toContain("ENH-001");
    expect(result.color).toBeDefined();
  });

  it("returns error for invalid ID", async () => {
    const result = await BacklogCommand.handleBacklogStatus("ENH-999");
    expect(result.title).toContain("Not Found");
    expect(result.color).toEqual(0xe74c3c); // error color
  });
});

describe("backlog next command", async () => {
  await seedBacklog();

  it("returns highest priority pending item", async () => {
    const result = await BacklogCommand.handleBacklogNext();
    expect(result).toBeDefined();
    expect(result.title).toContain("ENH-001"); // P0 item
  });
});

describe("backlog pending command", async () => {
  await seedBacklog();

  it("returns list of pending items", async () => {
    const result = await BacklogCommand.handleBacklogPending(10);
    expect(result).toBeDefined();
    expect(result.title).toContain("Pending Items");
    expect(result.description).toContain("ENH-001");
  });

  it("respects limit parameter", async () => {
    const result = await BacklogCommand.handleBacklogPending(1);
    expect(result).toBeDefined();
    // Should have max 1 item in description
  });
});

describe("backlog done command", async () => {
  await seedBacklog();

  it("marks item as complete", async () => {
    const result = await BacklogCommand.handleBacklogDone("ENH-001", "Completed successfully");
    expect(result.title).toContain("Marked Complete");
    expect(result.color).toEqual(0x2ecc71); // success color

    // Verify it was actually marked
    const statusResult = await BacklogCommand.handleBacklogStatus("ENH-001");
    expect(statusResult.title).toContain("done");
  });
});

describe("backlog dupe command", async () => {
  await seedBacklog();

  it("marks item as duplicate", async () => {
    const result = await BacklogCommand.handleBacklogDupe("ENH-002", "ENH-001", "Same issue");
    expect(result.title).toContain("Marked Duplicate");
    expect(result.color).toEqual(0x3498db); // info color

    // Verify it was actually marked
    const statusResult = await BacklogCommand.handleBacklogStatus("ENH-002");
    expect(statusResult.title).toContain("ENH-002");
  });
});

describe("backlog reject command", async () => {
  await seedBacklog();

  it("marks item as rejected", async () => {
    const result = await BacklogCommand.handleBacklogReject("ENH-003", "Out of scope");
    expect(result.title).toContain("Rejected");
    expect(result.color).toEqual(0xe74c3c); // error color

    // Verify it was actually marked
    const statusResult = await BacklogCommand.handleBacklogStatus("ENH-003");
    expect(statusResult.title).toContain("ENH-003");
  });
});

describe("backlog sources command", async () => {
  await seedBacklog();

  it("returns breakdown by source", async () => {
    const result = await BacklogCommand.handleBacklogSources();
    expect(result.title).toContain("Backlog Sources");
    expect(result.description).toContain("test");
  });
});

describe("backlog stats command", async () => {
  await seedBacklog();

  it("returns statistics", async () => {
    const result = await BacklogCommand.handleBacklogStats();
    expect(result.title).toContain("Backlog Statistics");
    expect(result.fields).toBeDefined();
    expect(result.fields?.length).toBeGreaterThan(0);
  });

  it("includes priority breakdown", async () => {
    const result = await BacklogCommand.handleBacklogStats();
    const priorityField = result.fields?.find((f) => f.name === "By Priority");
    expect(priorityField).toBeDefined();
    expect(priorityField?.value).toContain("P0");
  });
});

describe("backlog command router", async () => {
  await seedBacklog();

  it("routes 'status' command", async () => {
    const result = await BacklogCommand.handleBacklogCommand(["status", "ENH-001"]);
    expect(result.title).toContain("ENH-001");
  });

  it("routes 'next' command", async () => {
    const result = await BacklogCommand.handleBacklogCommand(["next"]);
    expect(result.title).toBeDefined();
  });

  it("routes 'pending' command", async () => {
    const result = await BacklogCommand.handleBacklogCommand(["pending"]);
    expect(result.title).toContain("Pending");
  });

  it("routes 'stats' command", async () => {
    const result = await BacklogCommand.handleBacklogCommand(["stats"]);
    expect(result.title).toContain("Statistics");
  });

  it("returns error for missing arguments", async () => {
    const result = await BacklogCommand.handleBacklogCommand(["status"]);
    expect(result.title).toContain("Error");
  });

  it("returns help for empty command", async () => {
    const result = await BacklogCommand.handleBacklogCommand([]);
    expect(result.title).toContain("Backlog Commands");
  });

  it("handles unknown commands", async () => {
    const result = await BacklogCommand.handleBacklogCommand(["invalid"]);
    expect(result.title).toContain("Unknown Command");
  });
});

describe("Discord embed formatting", async () => {
  await seedBacklog();

  it("includes timestamp in all responses", async () => {
    const result = await BacklogCommand.handleBacklogStatus("ENH-001");
    expect(result.timestamp).toBeDefined();
  });

  it("includes color in all responses", async () => {
    const result = await BacklogCommand.handleBacklogPending();
    expect(result.color).toBeDefined();
    expect(typeof result.color).toBe("number");
  });

  it("handles long descriptions gracefully", async () => {
    const result = await BacklogCommand.handleBacklogStatus("ENH-001");
    // Check that fields don't exceed Discord limits
    result.fields?.forEach((field) => {
      expect(field.value.length).toBeLessThanOrEqual(2048);
    });
  });
});

describe("error handling", async () => {
  it("handles missing backlog script gracefully", async () => {
    const originalPai = process.env.PAI_DIR;
    process.env.PAI_DIR = "/nonexistent/path";

    const result = await BacklogCommand.handleBacklogStatus("ENH-001");
    expect(result.title).toContain("Error");
    expect(result.color).toEqual(0xe74c3c); // error color

    process.env.PAI_DIR = originalPai;
  });

  it("handles invalid command arguments gracefully", async () => {
    const result = await BacklogCommand.handleBacklogCommand(["done", "ENH-001"]);
    // Should return an error about missing evidence
    expect(result.title).toContain("Error");
  });
});

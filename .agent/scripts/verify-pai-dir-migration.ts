#!/usr/bin/env bun
/**
 * PAI_DIR Migration Verification Script
 *
 * Verifies that all projects in ~/Projects have been migrated to use
 * the centralized four-tier PAI_DIR resolution system.
 *
 * Usage:
 *   bun verify-pai-dir-migration.ts
 *   bun verify-pai-dir-migration.ts --verbose
 */

import { execSync } from "child_process";
import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { getPAIDir, validatePAIDir } from "../utils/env.ts";

const verbose = process.argv.includes("--verbose");

// Projects to scan
const PROJECTS_DIR = "/Users/delphijc/Projects";
const CRITICAL_PROJECTS = [
  "sam",
  "memory-system",
  "voice-server",
  "discord-remote-control",
  "awareness",
  "cyber-alert-mgr",
];

interface MigrationStatus {
  project: string;
  status: "migrated" | "partial" | "not-migrated";
  files: { path: string; status: string }[];
  adHocRefs: number;
}

const results: MigrationStatus[] = [];

console.log("🔍 PAI_DIR Migration Verification\n");
console.log("==============================\n");

// Step 1: Verify central utility
console.log("Step 1: Verify Central Utility");
const validation = validatePAIDir();
if (validation.valid) {
  console.log(`✅ PAI_DIR resolved: ${getPAIDir()}`);
  console.log(`✅ Central utility healthy\n`);
} else {
  console.error(`❌ PAI_DIR validation failed: ${validation.reason}\n`);
  process.exit(1);
}

// Step 2: Scan projects for PAI_DIR usage
console.log("Step 2: Scanning Projects for PAI_DIR Usage\n");

const projects = readdirSync(PROJECTS_DIR).filter((p) => {
  const fullPath = join(PROJECTS_DIR, p);
  try {
    return statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
});

for (const project of projects) {
  if (process.argv.includes("--only-critical") && !CRITICAL_PROJECTS.includes(project)) {
    continue;
  }

  const projectPath = join(PROJECTS_DIR, project);

  try {
    // Search for ad-hoc PAI_DIR references
    let adHocCount = 0;
    try {
      const output = execSync(
        `grep -r "PAI_DIR\\|process.env.HOME" "${projectPath}" --include="*.ts" 2>/dev/null | grep -v node_modules | wc -l`,
        { encoding: "utf-8" }
      ).trim();
      adHocCount = parseInt(output) || 0;
    } catch {
      adHocCount = 0;
    }

    // Search for migrated references (imports from /Users/delphijc/.claude/utils/env.ts)
    let migratedCount = 0;
    try {
      const migratedOutput = execSync(
        `grep -r "getPAIDir\\|getPAIPath" "${projectPath}" --include="*.ts" 2>/dev/null | grep -v node_modules | wc -l`,
        { encoding: "utf-8" }
      ).trim();
      migratedCount = parseInt(migratedOutput) || 0;
    } catch {
      migratedCount = 0;
    }

    let status: "migrated" | "partial" | "not-migrated";
    if (adHocCount === 0 && migratedCount > 0) {
      status = "migrated";
    } else if (migratedCount > 0) {
      status = "partial";
    } else {
      status = "not-migrated";
    }

    const isCritical = CRITICAL_PROJECTS.includes(project);
    const marker = isCritical ? "⚠️  " : "  ";

    if (status === "migrated") {
      console.log(`${marker}✅ ${project.padEnd(30)} (${migratedCount} migrated, ${adHocCount} ad-hoc)`);
    } else if (status === "partial") {
      console.log(`${marker}🟡 ${project.padEnd(30)} (${migratedCount} migrated, ${adHocCount} ad-hoc)`);
    } else {
      console.log(`${marker}❌ ${project.padEnd(30)} (${migratedCount} migrated, ${adHocCount} ad-hoc)`);
    }

    results.push({
      project,
      status,
      files: [],
      adHocRefs: adHocCount,
    });
  } catch (e) {
    if (verbose) {
      console.log(`  ⏭️  ${project} (skipped - not TypeScript project)`);
    }
  }
}

// Step 3: Summary
console.log("\n==============================\n");
console.log("📊 Summary\n");

const migrated = results.filter((r) => r.status === "migrated").length;
const partial = results.filter((r) => r.status === "partial").length;
const notMigrated = results.filter((r) => r.status === "not-migrated").length;

console.log(`✅ Fully migrated: ${migrated}`);
console.log(`🟡 Partially migrated: ${partial}`);
console.log(`❌ Not migrated: ${notMigrated}`);
console.log(`Total: ${results.length}\n`);

// Critical projects status
console.log("🔴 Critical Projects Status:\n");
for (const critical of CRITICAL_PROJECTS) {
  const result = results.find((r) => r.project === critical);
  if (result) {
    const emoji = result.status === "migrated" ? "✅" : result.status === "partial" ? "🟡" : "❌";
    console.log(`  ${emoji} ${critical}`);
  } else {
    console.log(`  ⏭️  ${critical} (not found)`);
  }
}

// Exit with status
if (migrated === CRITICAL_PROJECTS.length) {
  console.log("\n🎉 All critical projects migrated!");
  process.exit(0);
} else {
  console.log(`\n⚠️  ${CRITICAL_PROJECTS.length - migrated} critical projects still need migration`);
  process.exit(1);
}

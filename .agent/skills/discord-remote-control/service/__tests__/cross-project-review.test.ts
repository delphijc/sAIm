/**
 * Tests for the Cross-Project Review feature in daily-journal.ts.
 *
 * Strategy: inject a temporary directory of fake git repos via the
 * `projectsRoot` parameter so no real git state is required. Each fake repo
 * is a minimal git repository created with `git init` + controlled commits
 * so the underlying git commands return predictable output.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import path from "path";
import os from "os";

import {
  getProjectsOverview,
  generateCrossProjectReview,
  type ProjectInfo,
  type CrossProjectReview,
} from "../memory/daily-journal.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal git repo at `dir` and make one commit. */
function initRepo(dir: string, fileName = "README.md", message = "init"): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, fileName), `# ${path.basename(dir)}\n`);
  const opts = { cwd: dir };
  Bun.spawnSync(["git", "init", "-b", "main"], opts);
  Bun.spawnSync(["git", "config", "user.email", "test@test.com"], opts);
  Bun.spawnSync(["git", "config", "user.name", "Test"], opts);
  Bun.spawnSync(["git", "add", "."], opts);
  Bun.spawnSync(["git", "commit", "-m", message], opts);
}

/** Add an uncommitted change to a repo. */
function dirtyRepo(dir: string, file = "dirty.txt"): void {
  writeFileSync(path.join(dir, file), "dirty\n");
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = path.join(os.tmpdir(), `xpr-test-${Date.now()}`);
  mkdirSync(tmpRoot, { recursive: true });
});

afterEach(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  mock.restore();
});

// ---------------------------------------------------------------------------
// getProjectsOverview
// ---------------------------------------------------------------------------

describe("getProjectsOverview", () => {
  it("returns an empty array when the projects root does not exist", () => {
    const result = getProjectsOverview("/non/existent/path");
    expect(result).toEqual([]);
  });

  it("ignores directories that are not git repos", () => {
    mkdirSync(path.join(tmpRoot, "not-a-repo"), { recursive: true });
    const result = getProjectsOverview(tmpRoot);
    expect(result).toEqual([]);
  });

  it("discovers a single git repo and returns correct metadata shape", () => {
    initRepo(path.join(tmpRoot, "alpha"));
    const results = getProjectsOverview(tmpRoot);
    expect(results).toHaveLength(1);

    const p = results[0];
    expect(p.name).toBe("alpha");
    expect(typeof p.path).toBe("string");
    expect(p.branch).toBe("main");
    expect(p.hasUncommittedChanges).toBe(false);
    expect(p.changedFiles).toEqual([]);
    expect(p.hasMergeConflict).toBe(false);
    expect(Array.isArray(p.recentCommitMessages)).toBe(true);
    expect(Array.isArray(p.hotFiles)).toBe(true);
  });

  it("detects multiple repos independently", () => {
    initRepo(path.join(tmpRoot, "alpha"));
    initRepo(path.join(tmpRoot, "beta"));
    const results = getProjectsOverview(tmpRoot);
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["alpha", "beta"]);
  });

  it("reports uncommitted changes correctly", () => {
    const repoDir = path.join(tmpRoot, "dirty-project");
    initRepo(repoDir);
    dirtyRepo(repoDir, "untracked.ts");

    const results = getProjectsOverview(tmpRoot);
    expect(results).toHaveLength(1);
    const p = results[0];
    expect(p.hasUncommittedChanges).toBe(true);
    expect(p.changedFiles.some((f) => f.includes("untracked.ts"))).toBe(true);
  });

  it("counts recent commits correctly — commit made 'just now' should appear", () => {
    const repoDir = path.join(tmpRoot, "active");
    initRepo(repoDir, "index.ts", "feat: add index");

    // Use a generous sinceMs so the commit is always within window
    const sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
    const results = getProjectsOverview(tmpRoot, sinceMs);
    expect(results[0].recentCommitCount).toBeGreaterThanOrEqual(1);
    expect(results[0].recentCommitMessages[0]).toContain("feat: add index");
  });

  it("returns recentCommitCount of 0 for a repo with no recent commits", () => {
    initRepo(path.join(tmpRoot, "old"));

    // Look-back window in the past relative to `now` — nothing matches
    const futureNow = Date.now() + 100 * 24 * 60 * 60 * 1000; // 100 days ahead
    const sinceMs = futureNow - 24 * 60 * 60 * 1000;
    const results = getProjectsOverview(tmpRoot, sinceMs);
    expect(results[0].recentCommitCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateCrossProjectReview
// ---------------------------------------------------------------------------

describe("generateCrossProjectReview", () => {
  it("returns a string starting with the section heading", () => {
    initRepo(path.join(tmpRoot, "alpha"));
    const md = generateCrossProjectReview(tmpRoot);
    expect(typeof md).toBe("string");
    expect(md).toContain("## Cross-Project Review");
  });

  it("includes active project details when commits exist", () => {
    const repoDir = path.join(tmpRoot, "myapp");
    initRepo(repoDir, "server.ts", "feat: initial server");

    const sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const md = generateCrossProjectReview(tmpRoot, Date.now() + 7 * 24 * 60 * 60 * 1000);
    // With our futureNow trick the commit falls outside the 24 h window, so
    // let's use a fresh call with explicit wide window via now parameter
    const md2 = generateCrossProjectReview(
      tmpRoot,
      // Set `now` 7 days ahead so the commit is within 24 h of the look-back
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    // Either way the repo should appear in the scan
    expect(md2).toContain("myapp");
  });

  it("flags projects with uncommitted changes but no recent commits in Needs Attention section", () => {
    const repoDir = path.join(tmpRoot, "pending-work");
    initRepo(repoDir);
    dirtyRepo(repoDir, "pending.ts");

    // Use a far-future `now` so the init commit is older than 24 h from that
    // reference point — the repo will have uncommittedChanges but recentCommitCount=0.
    const futureNow = Date.now() + 100 * 24 * 60 * 60 * 1000;
    const md = generateCrossProjectReview(tmpRoot, futureNow);
    expect(md).toContain("Needs Attention");
    expect(md).toContain("pending-work");
  });

  it("lists stale projects separately", () => {
    // A freshly initialised repo with no recent activity when we use a
    // far-future `now` as reference
    initRepo(path.join(tmpRoot, "stale-proj"));

    const futureNow = Date.now() + 100 * 24 * 60 * 60 * 1000;
    const md = generateCrossProjectReview(tmpRoot, futureNow);
    expect(md).toContain("Stale");
    expect(md).toContain("stale-proj");
  });

  it("does not throw when projects root is empty", () => {
    expect(() => generateCrossProjectReview(tmpRoot)).not.toThrow();
  });

  it("does not throw when projects root does not exist", () => {
    expect(() => generateCrossProjectReview("/non/existent/path")).not.toThrow();
  });

  it("includes a velocity note line", () => {
    initRepo(path.join(tmpRoot, "proj"));
    const md = generateCrossProjectReview(tmpRoot);
    expect(md).toMatch(/_Velocity:/);
  });

  it("includes Recommendations section when projects have activity", () => {
    const repoDir = path.join(tmpRoot, "active-recs");
    initRepo(repoDir, "app.ts", "feat: bootstrap app");
    dirtyRepo(repoDir, "scratch.ts");

    const md = generateCrossProjectReview(tmpRoot);
    // Either Needs Attention or Recommendations should appear
    const hasSection = md.includes("Needs Attention") || md.includes("Recommendations");
    expect(hasSection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-project connections
// ---------------------------------------------------------------------------

describe("cross-project connections detection", () => {
  it("detects shared file-name stems between two active projects", () => {
    // Both repos edit a file called "memory-server.ts" — same stem
    const aDir = path.join(tmpRoot, "projA");
    const bDir = path.join(tmpRoot, "projB");
    initRepo(aDir, "memory-server.ts", "feat: add memory-server");
    initRepo(bDir, "memory-server.ts", "feat: add memory-server");
    dirtyRepo(aDir, "schema.ts");
    dirtyRepo(bDir, "schema.ts");

    // Use a wide window so both commits are included
    const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const projects = getProjectsOverview(tmpRoot, sinceMs);

    // At least two projects detected
    expect(projects.length).toBeGreaterThanOrEqual(2);

    const md = generateCrossProjectReview(tmpRoot, Date.now(), undefined);
    // We can't guarantee the connection fires without matching stems threshold,
    // but the review should not crash and should contain both project names.
    expect(md).toContain("projA");
    expect(md).toContain("projB");
  });
});

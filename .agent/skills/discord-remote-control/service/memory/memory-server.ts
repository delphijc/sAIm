/**
 * Lightweight HTTP Memory Server
 * Exposes memory extraction and hybrid search over HTTP
 * Runs on localhost:4242 for Claude Code hook access
 *
 * Also serves a CRUD management UI at GET /
 */

import path from "path";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "fs";
import { extractAndSaveMemories } from "./extraction.ts";
import { hybridSearch } from "./hybrid-search.ts";
import { getMemoryInstance } from "./db.ts";
import { getUIHtml } from "./ui.ts";
import {
  getGraphData,
  getNeighbors,
  bfsTraversal,
  findPath,
  detectCommunities,
  degreeCentrality,
  weightedCentrality,
} from "./graph.ts";
import { runConsolidation, formatConsolidationReport } from "./consolidation.ts";
import {
  generateAndSaveDailyJournal,
  generateDailyJournal,
  generateCrossProjectReview,
  getProjectsOverview,
} from "./daily-journal.ts";

const PORT = 4242;

// Dynamically resolve the memory directory based on current user
const _home = process.env.HOME || "";
const _homeSlug = _home.replace(/^\//, "").replace(/\//g, "-");
const MEMORY_FILES_DIR = path.join(
  _home,
  ".claude",
  "projects",
  `-${_homeSlug}-Projects-sam`,
  "memory"
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Validate a memory file name: only allow safe .md filenames, no path traversal
 */
function isValidFilename(name: string): boolean {
  return /^[a-zA-Z0-9_-]+\.md$/.test(name) && !name.includes("..");
}

/**
 * Escape LIKE wildcard characters (local copy — db.ts version is private)
 */
function escapeLike(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Start the memory server
 */
export async function startMemoryServer(): Promise<void> {
  const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0',
    async fetch(req: Request) {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const method = req.method;

      // ---------------------------------------------------------------------------
      // CORS preflight
      // ---------------------------------------------------------------------------
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // ---------------------------------------------------------------------------
      // Favicon
      // ---------------------------------------------------------------------------
      if (pathname === "/favicon.ico" || pathname === "/favicon.svg") {
        const favSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><style>.mem-bg{fill:#0a0e27}.mem-core{fill:#6366f1}.mem-core-border{fill:none;stroke:#818cf8;stroke-width:6}.mem-line{stroke:#8b5cf6;stroke-width:6;fill:none}.mem-node{fill:#a78bfa}.mem-node-border{fill:none;stroke:#ddd6fe;stroke-width:4}</style></defs><rect class="mem-bg" width="256" height="256"/><circle class="mem-core" cx="128" cy="128" r="40"/><circle class="mem-core-border" cx="128" cy="128" r="40"/><line class="mem-line" x1="128" y1="88" x2="128" y2="18"/><line class="mem-line" x1="166" y1="90" x2="214" y2="40"/><line class="mem-line" x1="176" y1="128" x2="246" y2="128"/><line class="mem-line" x1="166" y1="166" x2="214" y2="216"/><line class="mem-line" x1="128" y1="176" x2="128" y2="246"/><line class="mem-line" x1="90" y1="166" x2="42" y2="216"/><line class="mem-line" x1="80" y1="128" x2="10" y2="128"/><line class="mem-line" x1="90" y1="90" x2="42" y2="40"/><circle class="mem-node mem-node-border" cx="128" cy="18" r="12"/><circle class="mem-node mem-node-border" cx="214" cy="40" r="12"/><circle class="mem-node mem-node-border" cx="246" cy="128" r="12"/><circle class="mem-node mem-node-border" cx="214" cy="216" r="12"/><circle class="mem-node mem-node-border" cx="128" cy="246" r="12"/><circle class="mem-node mem-node-border" cx="42" cy="216" r="12"/><circle class="mem-node mem-node-border" cx="10" cy="128" r="12"/><circle class="mem-node mem-node-border" cx="42" cy="40" r="12"/></svg>`;
        return new Response(favSvg, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" }
        });
      }

      // ---------------------------------------------------------------------------
      // Existing routes (UNCHANGED)
      // ---------------------------------------------------------------------------

      // POST /memory/extract - Extract and save facts from conversation
      if (pathname === "/memory/extract" && method === "POST") {
        try {
          const body = await req.json();
          const { userMessage, assistantResponse, sessionId, source, project } = body;

          if (!userMessage || !assistantResponse || !sessionId) {
            return new Response(
              JSON.stringify({ error: "Missing required fields" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const savedCount = await extractAndSaveMemories(
            userMessage,
            assistantResponse,
            sessionId,
            source || "unknown",
            project
          );

          return new Response(
            JSON.stringify({ success: true, savedCount }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("Error in /memory/extract:", error);
          return new Response(
            JSON.stringify({ error: "Extraction failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // POST /memory/search - Hybrid search across memory
      if (pathname === "/memory/search" && method === "POST") {
        try {
          const body = await req.json();
          const { query, limit, sessionId } = body;

          if (!query) {
            return new Response(
              JSON.stringify({ error: "Missing query" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const results = await hybridSearch(query, {
            sessionId,
            limit: limit || 5,
          });

          return new Response(
            JSON.stringify({ success: true, results }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("Error in /memory/search:", error);
          return new Response(
            JSON.stringify({ error: "Search failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // GET /memory/health - Health check
      if (pathname === "/memory/health" && method === "GET") {
        return new Response(
          JSON.stringify({ status: "ok" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ---------------------------------------------------------------------------
      // UI
      // ---------------------------------------------------------------------------

      // GET / - Serve the HTML management UI
      if (pathname === "/" && method === "GET") {
        return new Response(getUIHtml(), {
          headers: { "Content-Type": "text/html", ...corsHeaders },
        });
      }

      // ---------------------------------------------------------------------------
      // API: Semantic memories
      // ---------------------------------------------------------------------------

      // GET /api/semantic - List semantic memories with search, pagination, sorting
      if (pathname === "/api/semantic" && method === "GET") {
        try {
          const mem = getMemoryInstance();
          const search = url.searchParams.get("search") ?? "";
          const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
          const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
          const sort = url.searchParams.get("sort") ?? "created_at";
          const order =
            (url.searchParams.get("order") ?? "desc").toLowerCase() === "asc"
              ? "ASC"
              : "DESC";

          // Allowlist sortable columns to prevent SQL injection
          const allowedSortCols = new Set([
            "created_at",
            "access_count",
            "confidence",
            "last_access",
            "relevance_score",
            "topic",
          ]);
          const safeSort = allowedSortCols.has(sort) ? sort : "created_at";

          let items: any[];
          let total: number;

          if (search) {
            // Try FTS5 first, fall back to LIKE
            try {
              const sanitized = search.replace(/[^\w\s]/g, "").trim();
              if (!sanitized) throw new Error("empty");

              const countRow = mem.rawQuery(
                `SELECT COUNT(*) as count
                   FROM semantic s
                   INNER JOIN semantic_fts fts ON s.rowid = fts.rowid
                   WHERE semantic_fts MATCH ?`,
                sanitized
              );
              total = (countRow[0] as any)?.count ?? 0;

              items = mem.rawQuery(
                `SELECT s.*
                   FROM semantic s
                   INNER JOIN semantic_fts fts ON s.rowid = fts.rowid
                   WHERE semantic_fts MATCH ?
                   ORDER BY ${safeSort} ${order}
                   LIMIT ? OFFSET ?`,
                sanitized,
                limit,
                offset
              );
            } catch {
              const likeVal = `%${escapeLike(search)}%`;
              const countRow = mem.rawQuery(
                `SELECT COUNT(*) as count FROM semantic
                   WHERE topic LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\'`,
                likeVal,
                likeVal
              );
              total = (countRow[0] as any)?.count ?? 0;

              items = mem.rawQuery(
                `SELECT * FROM semantic
                   WHERE topic LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\'
                   ORDER BY ${safeSort} ${order}
                   LIMIT ? OFFSET ?`,
                likeVal,
                likeVal,
                limit,
                offset
              );
            }
          } else {
            const countRow = mem.rawQuery(
              "SELECT COUNT(*) as count FROM semantic"
            );
            total = (countRow[0] as any)?.count ?? 0;

            items = mem.rawQuery(
              `SELECT * FROM semantic ORDER BY ${safeSort} ${order} LIMIT ? OFFSET ?`,
              limit,
              offset
            );
          }

          return jsonResponse({ items, total });
        } catch (error) {
          console.error("Error in GET /api/semantic:", error);
          return errorResponse("Failed to list semantic memories");
        }
      }

      // Routes with :id param
      const semanticMatch = pathname.match(/^\/api\/semantic\/(.+)$/);
      if (semanticMatch) {
        const id = semanticMatch[1];

        // GET /api/semantic/:id - Get single semantic memory
        if (method === "GET") {
          try {
            const mem = getMemoryInstance();
            const rows = mem.rawQuery(
              "SELECT * FROM semantic WHERE id = ?",
              id
            );
            if (rows.length === 0) {
              return errorResponse("Not found", 404);
            }
            return jsonResponse(rows[0]);
          } catch (error) {
            console.error(`Error in GET /api/semantic/${id}:`, error);
            return errorResponse("Failed to fetch semantic memory");
          }
        }

        // PUT /api/semantic/:id - Update semantic memory
        if (method === "PUT") {
          try {
            const mem = getMemoryInstance();
            const body = await req.json();

            const allowed = ["topic", "summary", "confidence", "tags"];
            const setClauses: string[] = [];
            const params: any[] = [];

            for (const field of allowed) {
              if (field in body) {
                let val = body[field];

                if (field === "tags") {
                  // Normalize: accept array or comma-separated string
                  if (typeof val === "string") {
                    val = JSON.stringify(
                      val
                        .split(",")
                        .map((t: string) => t.trim())
                        .filter(Boolean)
                    );
                  } else if (Array.isArray(val)) {
                    val = JSON.stringify(val);
                  }
                }

                setClauses.push(`${field} = ?`);
                params.push(val);
              }
            }

            if (setClauses.length === 0) {
              return errorResponse("No valid fields to update", 400);
            }

            params.push(id);
            mem.rawRun(
              `UPDATE semantic SET ${setClauses.join(", ")} WHERE id = ?`,
              ...params
            );

            return jsonResponse({ success: true });
          } catch (error) {
            console.error(`Error in PUT /api/semantic/${id}:`, error);
            return errorResponse("Failed to update semantic memory");
          }
        }

        // DELETE /api/semantic/:id - Delete semantic memory
        if (method === "DELETE") {
          try {
            const mem = getMemoryInstance();
            // Delete associations referencing this memory first (FK cascade
            // handles it if PRAGMA foreign_keys=ON, but be explicit for safety)
            mem.rawRun(
              "DELETE FROM associations WHERE source_id = ? OR target_id = ?",
              id,
              id
            );
            const result = mem.rawRun(
              "DELETE FROM semantic WHERE id = ?",
              id
            );
            return jsonResponse({
              success: true,
              changes: (result as any)?.changes ?? 0,
            });
          } catch (error) {
            console.error(`Error in DELETE /api/semantic/${id}:`, error);
            return errorResponse("Failed to delete semantic memory");
          }
        }
      }

      // ---------------------------------------------------------------------------
      // API: Conversations
      // ---------------------------------------------------------------------------

      // GET /api/conversations - List conversation turns with search, pagination
      if (pathname === "/api/conversations" && method === "GET") {
        try {
          const mem = getMemoryInstance();
          const search = url.searchParams.get("search") ?? "";
          const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
          const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
          const role = url.searchParams.get("role") ?? "all";

          const conditions: string[] = ["1=1"];
          const params: any[] = [];

          if (search) {
            conditions.push(
              `content LIKE ? ESCAPE '\\'`
            );
            params.push(`%${escapeLike(search)}%`);
          }

          if (role === "user" || role === "assistant") {
            conditions.push("role = ?");
            params.push(role);
          }

          const where = conditions.join(" AND ");

          const countRow = mem.rawQuery(
            `SELECT COUNT(*) as count FROM conversations WHERE ${where}`,
            ...params
          );
          const total = (countRow[0] as any)?.count ?? 0;

          const items = mem.rawQuery(
            `SELECT * FROM conversations WHERE ${where}
               ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            ...params,
            limit,
            offset
          );

          return jsonResponse({ items, total });
        } catch (error) {
          console.error("Error in GET /api/conversations:", error);
          return errorResponse("Failed to list conversations");
        }
      }

      const conversationMatch = pathname.match(/^\/api\/conversations\/(.+)$/);
      if (conversationMatch) {
        const id = conversationMatch[1];

        // DELETE /api/conversations/:id - Delete a conversation turn
        if (method === "DELETE") {
          try {
            const mem = getMemoryInstance();
            const result = mem.rawRun(
              "DELETE FROM conversations WHERE id = ?",
              id
            );
            return jsonResponse({
              success: true,
              changes: (result as any)?.changes ?? 0,
            });
          } catch (error) {
            console.error(
              `Error in DELETE /api/conversations/${id}:`,
              error
            );
            return errorResponse("Failed to delete conversation turn");
          }
        }
      }

      // ---------------------------------------------------------------------------
      // API: Memory files
      // ---------------------------------------------------------------------------

      // GET /api/files - List .md memory files
      if (pathname === "/api/files" && method === "GET") {
        try {
          if (!existsSync(MEMORY_FILES_DIR)) {
            return jsonResponse({ files: [] });
          }

          const files = readdirSync(MEMORY_FILES_DIR)
            .filter((f) => f.endsWith(".md"))
            .map((name) => {
              const fullPath = path.join(MEMORY_FILES_DIR, name);
              const stat = statSync(fullPath);
              return {
                name,
                size: stat.size,
                modified: stat.mtimeMs,
              };
            })
            .sort((a, b) => b.modified - a.modified);

          return jsonResponse({ files });
        } catch (error) {
          console.error("Error in GET /api/files:", error);
          return errorResponse("Failed to list memory files");
        }
      }

      const fileMatch = pathname.match(/^\/api\/files\/(.+)$/);
      if (fileMatch) {
        const filename = fileMatch[1];

        if (!isValidFilename(filename)) {
          return errorResponse("Invalid filename", 400);
        }

        const fullPath = path.join(MEMORY_FILES_DIR, filename);

        // GET /api/files/:filename - Read file content
        if (method === "GET") {
          try {
            if (!existsSync(fullPath)) {
              return errorResponse("File not found", 404);
            }

            const content = readFileSync(fullPath, "utf-8");
            const stat = statSync(fullPath);
            return jsonResponse({ name: filename, content, size: stat.size });
          } catch (error) {
            console.error(`Error in GET /api/files/${filename}:`, error);
            return errorResponse("Failed to read file");
          }
        }

        // PUT /api/files/:filename - Save file content
        if (method === "PUT") {
          try {
            const body = await req.json();
            const { content } = body;

            if (typeof content !== "string") {
              return errorResponse("content must be a string", 400);
            }

            writeFileSync(fullPath, content, "utf-8");
            return jsonResponse({ success: true });
          } catch (error) {
            console.error(`Error in PUT /api/files/${filename}:`, error);
            return errorResponse("Failed to write file");
          }
        }
      }

      // ---------------------------------------------------------------------------
      // API: Stats
      // ---------------------------------------------------------------------------

      // GET /api/stats - Memory statistics
      if (pathname === "/api/stats" && method === "GET") {
        try {
          const mem = getMemoryInstance();

          const semanticCount =
            (mem.rawQuery("SELECT COUNT(*) as count FROM semantic")[0] as any)
              ?.count ?? 0;

          const conversationCount =
            (
              mem.rawQuery(
                "SELECT COUNT(*) as count FROM conversations"
              )[0] as any
            )?.count ?? 0;

          const associationCount =
            (
              mem.rawQuery(
                "SELECT COUNT(*) as count FROM associations"
              )[0] as any
            )?.count ?? 0;

          const avgConfidenceRow = mem.rawQuery(
            `SELECT AVG(confidence) as avg FROM semantic`
          )[0] as any;
          const avgConfidence = avgConfidenceRow?.avg ?? 0;

          const topicDistribution = mem.rawQuery(
            `SELECT topic, COUNT(*) as count
               FROM semantic
               GROUP BY topic
               ORDER BY count DESC
               LIMIT 20`
          );

          const topMemories = mem.rawQuery(
            `SELECT * FROM semantic ORDER BY access_count DESC LIMIT 10`
          );

          const recentActivity = mem.rawQuery(
            `SELECT * FROM semantic ORDER BY created_at DESC LIMIT 20`
          );

          // Skill usage: combine structured table + conversation mining
          let skillUsage: any[] = [];
          try {
            // Get from structured table
            const tableSkills = mem.rawQuery(
              `SELECT skill_name, COUNT(*) as invocations,
                      SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) as successes
               FROM skill_invocations
               GROUP BY skill_name
               ORDER BY invocations DESC`
            ) as any[];

            // Also mine conversations for skill mentions
            const minedSkills = mem.rawQuery(
              `WITH skill_mentions AS (
                SELECT
                  CASE
                    WHEN content LIKE '%/fabric%' OR content LIKE '%fabric:%' OR content LIKE '%fabric skill%' THEN 'fabric'
                    WHEN content LIKE '%/retrospective%' OR content LIKE '%retrospective skill%' THEN 'retrospective'
                    WHEN content LIKE '%/playwright%' OR content LIKE '%playwright-testing%' OR content LIKE '%playwright skill%' THEN 'playwright-testing'
                    WHEN content LIKE '%/architect%' OR content LIKE '%architect skill%' THEN 'architect'
                    WHEN content LIKE '%/observability%' OR content LIKE '%observability skill%' OR content LIKE '%observability dashboard%' THEN 'observability'
                    WHEN content LIKE '%/discord-remote%' OR content LIKE '%discord-remote-control%' THEN 'discord-remote-control'
                    WHEN content LIKE '%/content%' AND content LIKE '%skill%' THEN 'content'
                    WHEN content LIKE '%/security-grc%' OR content LIKE '%security-grc skill%' THEN 'security-grc'
                    WHEN content LIKE '%/create-cli%' OR content LIKE '%create-cli skill%' THEN 'create-cli'
                    WHEN content LIKE '%/create-skill%' OR content LIKE '%create-skill skill%' THEN 'create-skill'
                    WHEN content LIKE '%/create-agent%' OR content LIKE '%create-agent skill%' THEN 'create-agent'
                    WHEN content LIKE '%/audit-committer%' OR content LIKE '%audit-committer skill%' THEN 'audit-committer'
                    WHEN content LIKE '%/quick-flow%' OR content LIKE '%quick-flow skill%' THEN 'quick-flow'
                    WHEN content LIKE '%/story-explanation%' OR content LIKE '%story-explanation%' THEN 'story-explanation'
                    WHEN content LIKE '%/phase-checkpoint%' OR content LIKE '%phase-checkpoint%' THEN 'phase-checkpoint'
                    WHEN content LIKE '%/art %' OR content LIKE '%art skill%' THEN 'art'
                    WHEN content LIKE '%/prompting%' OR content LIKE '%prompting skill%' THEN 'prompting'
                    WHEN content LIKE '%/launchd-service%' OR content LIKE '%launchd-service%' THEN 'launchd-service'
                    WHEN content LIKE '%/party-mode%' OR content LIKE '%party-mode%' THEN 'party-mode'
                    WHEN content LIKE '%/jina-download%' OR content LIKE '%jina%download%' THEN 'jina-download'
                    WHEN content LIKE '%/bright-data%' OR content LIKE '%bright-data%' THEN 'bright-data'
                    WHEN content LIKE '%/transcribe-audio%' OR content LIKE '%transcribe-audio%' THEN 'transcribe-audio'
                    WHEN content LIKE '%/aggregate-transcriptions%' OR content LIKE '%aggregate-transcriptions%' THEN 'aggregate-transcriptions'
                    WHEN content LIKE '%/read-aloud%' OR content LIKE '%read-aloud%' OR content LIKE '%read aloud%' THEN 'read-aloud'
                    WHEN content LIKE '%/open-file%' OR content LIKE '%open-file skill%' THEN 'open-file'
                    WHEN content LIKE '%/schedule%' AND content LIKE '%skill%' THEN 'schedule'
                    WHEN content LIKE '%CORE skill%' OR content LIKE '%CORE context%' THEN 'CORE'
                    ELSE NULL
                  END as skill_name
                FROM conversations
                WHERE role = 'assistant'
              )
              SELECT skill_name, COUNT(*) as invocations
              FROM skill_mentions
              WHERE skill_name IS NOT NULL
              GROUP BY skill_name
              ORDER BY invocations DESC`
            ) as any[];

            // Merge: use mined as base, overlay structured table counts
            const merged = new Map<string, { invocations: number; successes: number }>();
            for (const s of minedSkills) {
              merged.set(s.skill_name, { invocations: s.invocations, successes: s.invocations });
            }
            for (const s of tableSkills) {
              const existing = merged.get(s.skill_name);
              if (existing) {
                // Take the higher count (table is authoritative when both exist)
                if (s.invocations > existing.invocations) {
                  merged.set(s.skill_name, { invocations: s.invocations, successes: s.successes });
                }
              } else {
                merged.set(s.skill_name, { invocations: s.invocations, successes: s.successes });
              }
            }

            skillUsage = Array.from(merged.entries())
              .map(([skill_name, data]) => ({ skill_name, ...data }))
              .sort((a, b) => b.invocations - a.invocations);
          } catch {
            // skill_invocations table may not exist yet
          }

          // Agent usage: combine structured table + conversation mining
          let agentUsage: any[] = [];
          try {
            // Get from structured table
            let tableAgents: any[] = [];
            try {
              tableAgents = mem.rawQuery(
                `SELECT agent_name, COUNT(*) as invocations,
                        SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) as successes
                 FROM agent_invocations
                 GROUP BY agent_name
                 ORDER BY invocations DESC`
              ) as any[];
            } catch { /* table may not exist */ }

            // Mine conversations for agent mentions (expanded to cover all known agents)
            const minedAgents = mem.rawQuery(
              `WITH agent_mentions AS (
                SELECT
                  CASE
                    WHEN lower(content) LIKE '%subagent_type%explore%' OR lower(content) LIKE '%explore agent%' OR lower(content) LIKE '%explore%subagent%' THEN 'Explore'
                    WHEN lower(content) LIKE '%subagent_type%developer%' OR lower(content) LIKE '%developer agent%' OR lower(content) LIKE '%developer%subagent%' THEN 'developer'
                    WHEN lower(content) LIKE '%subagent_type%engineer%' OR lower(content) LIKE '%engineer agent%' OR lower(content) LIKE '%engineer%subagent%' THEN 'engineer'
                    WHEN lower(content) LIKE '%subagent_type%researcher%' OR (lower(content) LIKE '%researcher agent%' AND lower(content) NOT LIKE '%claude-researcher%' AND lower(content) NOT LIKE '%gemini-researcher%' AND lower(content) NOT LIKE '%perplexity-researcher%') THEN 'researcher'
                    WHEN lower(content) LIKE '%subagent_type%claude-researcher%' OR lower(content) LIKE '%claude-researcher agent%' THEN 'claude-researcher'
                    WHEN lower(content) LIKE '%subagent_type%gemini-researcher%' OR lower(content) LIKE '%gemini-researcher agent%' THEN 'gemini-researcher'
                    WHEN lower(content) LIKE '%subagent_type%perplexity-researcher%' OR lower(content) LIKE '%perplexity-researcher agent%' THEN 'perplexity-researcher'
                    WHEN lower(content) LIKE '%subagent_type%pentester%' OR lower(content) LIKE '%pentester agent%' OR lower(content) LIKE '%pentester%subagent%' THEN 'pentester'
                    WHEN lower(content) LIKE '%subagent_type%architect%' OR (lower(content) LIKE '%architect agent%' AND lower(content) NOT LIKE '%security-architect%') THEN 'architect'
                    WHEN lower(content) LIKE '%subagent_type%security-architect%' OR lower(content) LIKE '%security-architect agent%' THEN 'security-architect'
                    WHEN lower(content) LIKE '%subagent_type%security-test-analyst%' OR lower(content) LIKE '%security-test-analyst%' THEN 'security-test-analyst'
                    WHEN lower(content) LIKE '%subagent_type%plan%' OR lower(content) LIKE '%plan agent%' OR lower(content) LIKE '%plan%subagent%' THEN 'Plan'
                    WHEN lower(content) LIKE '%subagent_type%test-architect%' OR lower(content) LIKE '%test-architect agent%' THEN 'test-architect'
                    WHEN lower(content) LIKE '%subagent_type%general-purpose%' OR lower(content) LIKE '%general-purpose agent%' THEN 'general-purpose'
                    WHEN lower(content) LIKE '%subagent_type%analyst%' OR lower(content) LIKE '%analyst agent%' THEN 'analyst'
                    WHEN lower(content) LIKE '%subagent_type%designer%' OR (lower(content) LIKE '%designer agent%' AND lower(content) NOT LIKE '%ux-designer%') THEN 'designer'
                    WHEN lower(content) LIKE '%subagent_type%ux-designer%' OR lower(content) LIKE '%ux-designer agent%' THEN 'ux-designer'
                    WHEN lower(content) LIKE '%subagent_type%product-manager%' OR lower(content) LIKE '%product-manager agent%' THEN 'product-manager'
                    WHEN lower(content) LIKE '%subagent_type%scrum-master%' OR lower(content) LIKE '%scrum-master agent%' THEN 'scrum-master'
                    WHEN lower(content) LIKE '%subagent_type%technical-writer%' OR lower(content) LIKE '%technical-writer agent%' THEN 'technical-writer'
                    WHEN lower(content) LIKE '%subagent_type%quick-flow-solo-dev%' OR lower(content) LIKE '%quick-flow-solo-dev%' THEN 'quick-flow-solo-dev'
                    WHEN lower(content) LIKE '%subagent_type%brainstorming-coach%' OR lower(content) LIKE '%brainstorming-coach%' THEN 'brainstorming-coach'
                    WHEN lower(content) LIKE '%subagent_type%master-storyteller%' OR lower(content) LIKE '%master-storyteller%' THEN 'master-storyteller'
                    WHEN lower(content) LIKE '%subagent_type%problem-solver%' OR lower(content) LIKE '%problem-solver agent%' THEN 'problem-solver'
                    WHEN lower(content) LIKE '%subagent_type%innovation-oracle%' OR lower(content) LIKE '%innovation-oracle%' THEN 'innovation-oracle'
                    WHEN lower(content) LIKE '%subagent_type%chief-security-officer%' OR lower(content) LIKE '%chief-security-officer%' THEN 'chief-security-officer'
                    WHEN lower(content) LIKE '%subagent_type%investor%' OR lower(content) LIKE '%investor agent%' THEN 'investor'
                    WHEN lower(content) LIKE '%subagent_type%design-thinking-coach%' OR lower(content) LIKE '%design-thinking-coach%' THEN 'design-thinking-coach'
                    WHEN lower(content) LIKE '%subagent_type%sam%' OR lower(content) LIKE '% sam agent%' THEN 'sam'
                    ELSE NULL
                  END as agent_type
                FROM conversations
                WHERE role = 'assistant'
              )
              SELECT agent_type as agent_name, COUNT(*) as invocations
              FROM agent_mentions
              WHERE agent_type IS NOT NULL
              GROUP BY agent_type
              ORDER BY invocations DESC`
            ) as any[];

            // Merge: mined as base, overlay structured table
            const merged = new Map<string, { invocations: number; successes: number }>();
            for (const a of minedAgents) {
              merged.set(a.agent_name, { invocations: a.invocations, successes: a.invocations });
            }
            for (const a of tableAgents) {
              const existing = merged.get(a.agent_name);
              if (existing) {
                if (a.invocations > existing.invocations) {
                  merged.set(a.agent_name, { invocations: a.invocations, successes: a.successes });
                }
              } else {
                merged.set(a.agent_name, { invocations: a.invocations, successes: a.successes });
              }
            }

            agentUsage = Array.from(merged.entries())
              .map(([agent_name, data]) => ({ agent_name, ...data }))
              .sort((a, b) => b.invocations - a.invocations);
          } catch {
            // Neither source available
          }

          return jsonResponse({
            semanticCount,
            conversationCount,
            associationCount,
            avgConfidence,
            topicDistribution,
            topMemories,
            recentActivity,
            skillUsage,
            agentUsage,
          });
        } catch (error) {
          console.error("Error in GET /api/stats:", error);
          return errorResponse("Failed to fetch stats");
        }
      }

      // ---------------------------------------------------------------------------
      // API: Graph Explorer
      // ---------------------------------------------------------------------------

      // GET /api/graph/data - Full graph (nodes + edges + stats)
      if (pathname === "/api/graph/data" && method === "GET") {
        try {
          const data = getGraphData();
          return jsonResponse(data);
        } catch (error) {
          console.error("Error in GET /api/graph/data:", error);
          return errorResponse("Failed to fetch graph data");
        }
      }

      // GET /api/graph/neighbors/:id - Get neighbors of a node
      const neighborMatch = pathname.match(/^\/api\/graph\/neighbors\/(.+)$/);
      if (neighborMatch && method === "GET") {
        try {
          const id = neighborMatch[1];
          const minWeight = parseFloat(url.searchParams.get("minWeight") ?? "0");
          const data = getNeighbors(id, minWeight);
          return jsonResponse(data);
        } catch (error) {
          console.error("Error in GET /api/graph/neighbors:", error);
          return errorResponse("Failed to fetch neighbors");
        }
      }

      // GET /api/graph/traverse/:id - BFS traversal from a node
      const traverseMatch = pathname.match(/^\/api\/graph\/traverse\/(.+)$/);
      if (traverseMatch && method === "GET") {
        try {
          const id = traverseMatch[1];
          const maxDepth = parseInt(url.searchParams.get("maxDepth") ?? "3", 10);
          const minWeight = parseFloat(url.searchParams.get("minWeight") ?? "0");
          const data = bfsTraversal(id, maxDepth, minWeight);
          return jsonResponse(data);
        } catch (error) {
          console.error("Error in GET /api/graph/traverse:", error);
          return errorResponse("Failed to traverse graph");
        }
      }

      // GET /api/graph/path?from=X&to=Y - Shortest path between two nodes
      if (pathname === "/api/graph/path" && method === "GET") {
        try {
          const fromId = url.searchParams.get("from");
          const toId = url.searchParams.get("to");
          if (!fromId || !toId) {
            return errorResponse("Missing 'from' and 'to' query params", 400);
          }
          const maxDepth = parseInt(url.searchParams.get("maxDepth") ?? "6", 10);
          const data = findPath(fromId, toId, maxDepth);
          if (!data) {
            return jsonResponse({ found: false, message: "No path found" });
          }
          return jsonResponse({ found: true, ...data });
        } catch (error) {
          console.error("Error in GET /api/graph/path:", error);
          return errorResponse("Failed to find path");
        }
      }

      // GET /api/graph/communities - Community detection
      if (pathname === "/api/graph/communities" && method === "GET") {
        try {
          const data = detectCommunities();
          return jsonResponse(data);
        } catch (error) {
          console.error("Error in GET /api/graph/communities:", error);
          return errorResponse("Failed to detect communities");
        }
      }

      // GET /api/graph/centrality - Degree centrality
      if (pathname === "/api/graph/centrality" && method === "GET") {
        try {
          const metric = url.searchParams.get("metric") ?? "degree";
          const data = metric === "weighted" ? weightedCentrality() : degreeCentrality();
          return jsonResponse(data);
        } catch (error) {
          console.error("Error in GET /api/graph/centrality:", error);
          return errorResponse("Failed to compute centrality");
        }
      }

      // ---------------------------------------------------------------------------
      // API: Consolidation
      // ---------------------------------------------------------------------------

      // POST /api/consolidation/run - Run memory consolidation
      if (pathname === "/api/consolidation/run" && method === "POST") {
        try {
          const report = await runConsolidation();
          return jsonResponse({
            success: true,
            report,
            markdown: formatConsolidationReport(report),
          });
        } catch (error) {
          console.error("Error in POST /api/consolidation/run:", error);
          return errorResponse("Consolidation failed");
        }
      }

      // ---------------------------------------------------------------------------
      // API: Daily Journal
      // ---------------------------------------------------------------------------

      // POST /api/journal/generate - Generate and save daily journal
      if (pathname === "/api/journal/generate" && method === "POST") {
        try {
          const filePath = await generateAndSaveDailyJournal();
          return jsonResponse({ success: true, filePath });
        } catch (error) {
          console.error("Error in POST /api/journal/generate:", error);
          return errorResponse("Journal generation failed");
        }
      }

      // GET /api/journal/preview - Preview daily journal without saving
      if (pathname === "/api/journal/preview" && method === "GET") {
        try {
          const markdown = generateDailyJournal();
          return jsonResponse({ success: true, markdown });
        } catch (error) {
          console.error("Error in GET /api/journal/preview:", error);
          return errorResponse("Journal preview failed");
        }
      }

      // GET /api/journal/cross-project - Cross-project review markdown
      if (pathname === "/api/journal/cross-project" && method === "GET") {
        try {
          const markdown = generateCrossProjectReview();
          return jsonResponse({ success: true, markdown });
        } catch (error) {
          console.error("Error in GET /api/journal/cross-project:", error);
          return errorResponse("Cross-project review failed");
        }
      }

      // GET /api/projects/overview - Structured data about all git projects
      if (pathname === "/api/projects/overview" && method === "GET") {
        try {
          const projects = getProjectsOverview();
          return jsonResponse({ success: true, projects });
        } catch (error) {
          console.error("Error in GET /api/projects/overview:", error);
          return errorResponse("Projects overview failed");
        }
      }

      // ---------------------------------------------------------------------------
      // API: Project-scoped queries
      // ---------------------------------------------------------------------------

      // GET /api/projects - List distinct projects in memory
      if (pathname === "/api/projects" && method === "GET") {
        try {
          const mem = getMemoryInstance();
          const rows = mem.rawQuery(
            `SELECT project, COUNT(*) as count
             FROM semantic
             GROUP BY project
             ORDER BY count DESC`
          );
          return jsonResponse({ projects: rows });
        } catch (error) {
          console.error("Error in GET /api/projects:", error);
          return errorResponse("Failed to list projects");
        }
      }

      // GET /api/semantic/by-project/:project - List memories for a specific project
      const projectMatch = pathname.match(/^\/api\/semantic\/by-project\/(.+)$/);
      if (projectMatch && method === "GET") {
        try {
          const project = decodeURIComponent(projectMatch[1]);
          const mem = getMemoryInstance();
          const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
          const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

          const countRow = mem.rawQuery(
            "SELECT COUNT(*) as count FROM semantic WHERE project = ?",
            project
          );
          const total = (countRow[0] as any)?.count ?? 0;

          const items = mem.rawQuery(
            `SELECT * FROM semantic WHERE project = ?
             ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            project,
            limit,
            offset
          );

          return jsonResponse({ items, total, project });
        } catch (error) {
          console.error("Error in GET /api/semantic/by-project:", error);
          return errorResponse("Failed to list project memories");
        }
      }

      // ---------------------------------------------------------------------------
      // 404
      // ---------------------------------------------------------------------------
      return new Response(
        JSON.stringify({ error: "Not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    },
  });

  console.log(`Memory server listening on http://localhost:${PORT}`);
}

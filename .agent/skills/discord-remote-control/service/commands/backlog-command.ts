#!/usr/bin/env bun
// Discord Backlog Command Handler
//
// Provides commands for triaging enhancement backlog via Discord:
//   - backlog status ENH-042
//   - backlog next
//   - backlog pending
//   - backlog done ENH-042 "evidence"
//   - backlog dupe ENH-042 ENH-035
//   - backlog reject ENH-042 "reason"
//   - backlog sources
//   - backlog stats
//
// Formats responses as Discord embeds for readability

import { execSync } from "child_process";
import path from "path";

// ============================================================================
// Types
// ============================================================================

interface BacklogItem {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  description: string;
  effort: "S" | "M" | "L" | "XL";
  engine_compat: string;
  source: string;
  status: "pending" | "in_progress" | "approved" | "completed" | "skipped" | "done" | "duplicate" | "wont-implement";
  created: string;
  completed?: string | null;
  result?: string | null;
  notes?: string | null;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const PAI_DIR = process.env.PAI_DIR || `${process.env.HOME}/.claude`;
const MANAGE_BACKLOG = `${PAI_DIR}/scripts/manage-backlog.sh`;

// Color codes for Discord embeds
const COLORS = {
  success: 0x2ecc71, // green
  info: 0x3498db, // blue
  warning: 0xf39c12, // orange
  error: 0xe74c3c, // red
  p0: 0xe74c3c, // red
  p1: 0xf39c12, // orange
  p2: 0x3498db, // blue
  p3: 0x95a5a6, // gray
};

function getPriorityColor(priority: string): number {
  switch (priority) {
    case "P0":
      return COLORS.p0;
    case "P1":
      return COLORS.p1;
    case "P2":
      return COLORS.p2;
    case "P3":
      return COLORS.p3;
    default:
      return COLORS.info;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function runCommand(cmd: string[]): string {
  try {
    return execSync(`"${MANAGE_BACKLOG}" ${cmd.map((c) => `"${c}"`).join(" ")}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

function parseJsonLines(output: string): BacklogItem[] {
  return output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((item): item is BacklogItem => item !== null);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatItem(item: BacklogItem, showNotes = true): DiscordEmbed {
  const statusEmoji = {
    pending: "⏳",
    in_progress: "🔄",
    approved: "✅",
    completed: "✔️",
    skipped: "⊘",
    done: "✔️",
    duplicate: "🔗",
    "wont-implement": "❌",
  };

  const fields = [
    {
      name: "Priority",
      value: item.priority,
      inline: true,
    },
    {
      name: "Status",
      value: `${statusEmoji[item.status as keyof typeof statusEmoji] || "❓"} ${item.status}`,
      inline: true,
    },
    {
      name: "Effort",
      value: item.effort,
      inline: true,
    },
    {
      name: "Source",
      value: item.source,
      inline: true,
    },
    {
      name: "Engine",
      value: item.engine_compat,
      inline: true,
    },
    {
      name: "Created",
      value: formatDate(item.created),
      inline: true,
    },
  ];

  if (item.completed) {
    fields.push({
      name: "Completed",
      value: formatDate(item.completed),
      inline: true,
    });
  }

  if (item.description) {
    fields.push({
      name: "Description",
      value: item.description.substring(0, 1024),
      inline: false,
    });
  }

  if (showNotes && item.notes) {
    fields.push({
      name: "Notes",
      value: item.notes.substring(0, 512),
      inline: false,
    });
  }

  if (item.result) {
    fields.push({
      name: "Result",
      value: item.result.substring(0, 512),
      inline: false,
    });
  }

  return {
    title: `${item.id} — ${item.title}`,
    color: getPriorityColor(item.priority),
    fields,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Command Handlers
// ============================================================================

export async function handleBacklogStatus(itemId: string): Promise<DiscordEmbed> {
  try {
    const output = runCommand(["list"]);
    const items = parseJsonLines(output);
    const item = items.find((i) => i.id === itemId);

    if (!item) {
      return {
        title: "Not Found",
        description: `No backlog item found with ID: ${itemId}`,
        color: COLORS.error,
        timestamp: new Date().toISOString(),
      };
    }

    return formatItem(item);
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to fetch status: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handleBacklogNext(): Promise<DiscordEmbed> {
  try {
    const output = runCommand(["next"]);
    const items = parseJsonLines(output);

    if (items.length === 0) {
      return {
        title: "No Pending Items",
        description: "All pending backlog items are complete!",
        color: COLORS.success,
        timestamp: new Date().toISOString(),
      };
    }

    return formatItem(items[0]);
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to fetch next item: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handleBacklogPending(limit = 10): Promise<DiscordEmbed> {
  try {
    const output = runCommand(["list", "--status", "pending", "--limit", limit.toString()]);
    const items = parseJsonLines(output);

    if (items.length === 0) {
      return {
        title: "Pending Items",
        description: "No pending items in backlog",
        color: COLORS.success,
        timestamp: new Date().toISOString(),
      };
    }

    const fieldValues = items
      .map((item) => `**${item.id}** (${item.priority}) — ${item.title}`)
      .join("\n");

    return {
      title: `Pending Items (${items.length})`,
      description: fieldValues,
      color: COLORS.warning,
      fields: [
        {
          name: "Summary",
          value: `**P0:** ${items.filter((i) => i.priority === "P0").length} | **P1:** ${items.filter((i) => i.priority === "P1").length} | **P2:** ${items.filter((i) => i.priority === "P2").length} | **P3:** ${items.filter((i) => i.priority === "P3").length}`,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to fetch pending items: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handleBacklogDone(itemId: string, evidence: string): Promise<DiscordEmbed> {
  try {
    runCommand(["mark-done", "--id", itemId, "--evidence", evidence]);

    return {
      title: "Marked Complete",
      description: `✔️ ${itemId} has been marked as done`,
      color: COLORS.success,
      fields: [
        {
          name: "Evidence",
          value: evidence,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to mark as done: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handleBacklogDupe(itemId: string, originalId: string, reason?: string): Promise<DiscordEmbed> {
  try {
    const cmd = ["mark-dupe", "--id", itemId, "--original", originalId];
    if (reason) cmd.push("--reason", reason);
    runCommand(cmd);

    return {
      title: "Marked Duplicate",
      description: `🔗 ${itemId} has been marked as a duplicate of ${originalId}`,
      color: COLORS.info,
      fields: reason
        ? [
            {
              name: "Reason",
              value: reason,
              inline: false,
            },
          ]
        : [],
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to mark as duplicate: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handleBacklogReject(itemId: string, reason: string): Promise<DiscordEmbed> {
  try {
    runCommand(["mark-reject", "--id", itemId, "--reason", reason]);

    return {
      title: "Rejected",
      description: `❌ ${itemId} has been marked as won't-implement`,
      color: COLORS.error,
      fields: [
        {
          name: "Reason",
          value: reason,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to mark as rejected: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handleBacklogSources(): Promise<DiscordEmbed> {
  try {
    const output = runCommand(["list"]);
    const items = parseJsonLines(output);

    const sources = new Map<string, number>();
    items.forEach((item) => {
      sources.set(item.source, (sources.get(item.source) || 0) + 1);
    });

    const sortedSources = Array.from(sources.entries()).sort((a, b) => b[1] - a[1]);

    const fieldValues = sortedSources.map(([source, count]) => `**${source}:** ${count}`).join("\n");

    return {
      title: "Backlog Sources",
      description: fieldValues || "No items in backlog",
      color: COLORS.info,
      fields: [
        {
          name: "Total Items",
          value: items.length.toString(),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to fetch sources: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handleBacklogStats(): Promise<DiscordEmbed> {
  try {
    const output = runCommand(["list"]);
    const items = parseJsonLines(output);

    const statuses = new Map<string, number>();
    const priorities = new Map<string, number>();

    items.forEach((item) => {
      statuses.set(item.status, (statuses.get(item.status) || 0) + 1);
      priorities.set(item.priority, (priorities.get(item.priority) || 0) + 1);
    });

    const fields = [
      {
        name: "Total Items",
        value: items.length.toString(),
        inline: true,
      },
      {
        name: "By Priority",
        value: ["P0", "P1", "P2", "P3"].map((p) => `${p}: ${priorities.get(p) || 0}`).join(" | "),
        inline: false,
      },
      {
        name: "By Status",
        value: Array.from(statuses.entries())
          .map(([status, count]) => `${status}: ${count}`)
          .join(" | "),
        inline: false,
      },
    ];

    // Calculate avg days pending
    const pending = items.filter((i) => i.status === "pending");
    if (pending.length > 0) {
      const now = Date.now();
      const avgDays = pending.reduce((sum, item) => {
        const createdDate = new Date(item.created).getTime();
        return sum + (now - createdDate) / (1000 * 60 * 60 * 24);
      }, 0) / pending.length;

      fields.push({
        name: "Avg Days Pending",
        value: avgDays.toFixed(1),
        inline: true,
      });
    }

    // Calculate completion rate (done + duplicate + wont-implement / total)
    const completed = items.filter((i) =>
      i.status === "done" || i.status === "duplicate" || i.status === "wont-implement"
    ).length;
    const completionRate = items.length > 0 ? ((completed / items.length) * 100).toFixed(1) : "0.0";

    fields.push({
      name: "Completion Rate",
      value: `${completionRate}% (${completed}/${items.length})`,
      inline: true,
    });

    // Add source breakdown if multiple sources exist
    const sources = new Map<string, number>();
    items.forEach((item) => {
      sources.set(item.source, (sources.get(item.source) || 0) + 1);
    });

    if (sources.size > 1) {
      const sourceBreakdown = Array.from(sources.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => `${source}: ${count}`)
        .join(" | ");

      fields.push({
        name: "By Source",
        value: sourceBreakdown,
        inline: false,
      });
    }

    return {
      title: "Backlog Statistics",
      color: COLORS.info,
      fields,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      title: "Error",
      description: `Failed to fetch statistics: ${error.message}`,
      color: COLORS.error,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Main Command Router
// ============================================================================

export async function handleBacklogCommand(parts: string[]): Promise<DiscordEmbed> {
  if (parts.length === 0) {
    return {
      title: "Backlog Commands",
      description: "Usage: `backlog <command> [args]`",
      color: COLORS.info,
      fields: [
        {
          name: "Commands",
          value: `
**status** <ID> — Show item details
**next** — Next pending item
**pending** [limit] — List pending items
**done** <ID> "<evidence>" — Mark as complete
**dupe** <ID> <ORIGINAL> ["reason"] — Mark as duplicate
**reject** <ID> "<reason>" — Mark as won't-implement
**sources** — Breakdown by source
**stats** — Overall statistics
          `,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  const command = parts[0].toLowerCase();

  switch (command) {
    case "status":
      if (parts.length < 2) {
        return {
          title: "Error",
          description: "Usage: `backlog status <ID>`",
          color: COLORS.error,
          timestamp: new Date().toISOString(),
        };
      }
      return handleBacklogStatus(parts[1]);

    case "next":
      return handleBacklogNext();

    case "pending":
      const limit = parts.length > 1 ? parseInt(parts[1]) || 10 : 10;
      return handleBacklogPending(limit);

    case "done":
      if (parts.length < 3) {
        return {
          title: "Error",
          description: 'Usage: `backlog done <ID> "<evidence>"`',
          color: COLORS.error,
          timestamp: new Date().toISOString(),
        };
      }
      return handleBacklogDone(parts[1], parts.slice(2).join(" "));

    case "dupe":
      if (parts.length < 3) {
        return {
          title: "Error",
          description: 'Usage: `backlog dupe <ID> <ORIGINAL> ["reason"]`',
          color: COLORS.error,
          timestamp: new Date().toISOString(),
        };
      }
      const dupeReason = parts.length > 3 ? parts.slice(3).join(" ") : undefined;
      return handleBacklogDupe(parts[1], parts[2], dupeReason);

    case "reject":
      if (parts.length < 3) {
        return {
          title: "Error",
          description: 'Usage: `backlog reject <ID> "<reason>"`',
          color: COLORS.error,
          timestamp: new Date().toISOString(),
        };
      }
      return handleBacklogReject(parts[1], parts.slice(2).join(" "));

    case "sources":
      return handleBacklogSources();

    case "stats":
      return handleBacklogStats();

    default:
      return {
        title: "Unknown Command",
        description: `Unknown backlog command: ${command}`,
        color: COLORS.error,
        timestamp: new Date().toISOString(),
      };
  }
}

// Export for Discord.js bot integration
export const backlogCommands = {
  status: handleBacklogStatus,
  next: handleBacklogNext,
  pending: handleBacklogPending,
  done: handleBacklogDone,
  dupe: handleBacklogDupe,
  reject: handleBacklogReject,
  sources: handleBacklogSources,
  stats: handleBacklogStats,
  router: handleBacklogCommand,
};

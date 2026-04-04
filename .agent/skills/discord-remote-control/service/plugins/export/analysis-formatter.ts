/**
 * Analysis Formatter
 *
 * Formats AnalysisResult into Discord markdown (concise) and full reports
 * (markdown and HTML with dark cyberpunk theme).
 */

import type { AnalysisResult, TopicSummary, SentimentSegment, RankedResponse } from "./analysis.ts";

// ============================================================================
// Helpers
// ============================================================================

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortTs(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sentimentEmoji(s: "positive" | "neutral" | "negative"): string {
  switch (s) {
    case "positive": return "😊";
    case "negative": return "😕";
    default: return "😐";
  }
}

// ============================================================================
// Discord Format (concise, < 2000 chars)
// ============================================================================

/**
 * Format analysis result as a Discord-ready markdown message.
 * Stays well under the 2000-character Discord message limit.
 */
export function formatAnalysisForDiscord(result: AnalysisResult): string {
  const { dateRange, totalTurns, totalSessions, topics, sentiment, helpfulResponses, tokenEfficiency } = result;

  const lines: string[] = [];

  // Header
  lines.push(`## Conversation Analysis`);
  lines.push(`**${shortDate(dateRange.start)}** → **${shortDate(dateRange.end)}**`);
  lines.push(`**${fmt(totalTurns)} turns** across **${fmt(totalSessions)} session${totalSessions !== 1 ? "s" : ""}**`);
  lines.push("");

  // Top topics (up to 5)
  const topTopics = topics.slice(0, 5);
  if (topTopics.length > 0) {
    lines.push("### Top Topics");
    topTopics.forEach((t, i) => {
      lines.push(`${i + 1}. **${t.topic}** — ${pct(t.percentage)} (${t.count} turn${t.count !== 1 ? "s" : ""})`);
    });
    lines.push("");
  }

  // Sentiment
  lines.push(`### Sentiment: ${capitalize(sentiment.overall)} ${sentimentEmoji(sentiment.overall)}`);
  if (sentiment.segments.length > 0) {
    const avgScore = sentiment.segments.reduce((s, seg) => s + seg.score, 0) / sentiment.segments.length;
    lines.push(`Overall score: ${(Math.round(Math.abs(avgScore) * 100) / 100).toFixed(2)}/1.0`);
  }
  lines.push("");

  // Most helpful response
  if (helpfulResponses.length > 0) {
    const top = helpfulResponses[0];
    const snippet = top.content.slice(0, 80) + (top.content.length > 80 ? "..." : "");
    lines.push("### Most Helpful Response");
    lines.push(`> "${snippet}" *(${shortTs(top.timestamp)})*`);
    lines.push("");
  }

  // Token efficiency
  const te = tokenEfficiency;
  if (te.totalInputTokens > 0 || te.totalOutputTokens > 0) {
    lines.push("### Token Efficiency");
    lines.push(`- Total: **${fmt(te.totalInputTokens)}** input / **${fmt(te.totalOutputTokens)}** output`);
    lines.push(`- Avg per turn: ${fmt(te.avgInputPerTurn)} in / ${fmt(te.avgOutputPerTurn)} out`);
    lines.push(`- Efficiency ratio: **${te.efficiency.toFixed(2)}**`);
  } else {
    lines.push("### Token Efficiency");
    lines.push("- No token data available");
  }

  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// Full Markdown Report
// ============================================================================

/**
 * Full detailed markdown report with all data.
 */
export function formatAnalysisAsMarkdown(result: AnalysisResult): string {
  const { dateRange, totalTurns, totalSessions, topics, sentiment, helpfulResponses, tokenEfficiency } = result;

  const lines: string[] = [];

  lines.push("# Conversation Analysis Report");
  lines.push("");
  lines.push(`**Date Range:** ${shortDate(dateRange.start)} — ${shortDate(dateRange.end)}`);
  lines.push(`**Total Turns:** ${fmt(totalTurns)}`);
  lines.push(`**Sessions:** ${fmt(totalSessions)}`);
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Topics
  lines.push("## Topics");
  lines.push("");
  if (topics.length === 0) {
    lines.push("*No topics detected.*");
  } else {
    lines.push("| Topic | Count | % of Messages | Examples |");
    lines.push("|-------|-------|--------------|----------|");
    for (const t of topics) {
      const examples = t.examples.slice(0, 2).map(e => `*${e.replace(/\|/g, "\\|")}*`).join("; ");
      lines.push(`| ${t.topic} | ${t.count} | ${pct(t.percentage)} | ${examples || "—"} |`);
    }
  }
  lines.push("");

  // Sentiment
  lines.push("## Sentiment Analysis");
  lines.push("");
  lines.push(`**Overall Sentiment:** ${capitalize(sentiment.overall)} ${sentimentEmoji(sentiment.overall)}`);
  lines.push("");

  if (sentiment.segments.length > 0) {
    lines.push("### Per-Session Sentiment");
    lines.push("");
    lines.push("| Session | Sentiment | Score | Sample |");
    lines.push("|---------|-----------|-------|--------|");
    for (const seg of sentiment.segments) {
      const sampleSafe = seg.sample.replace(/\|/g, "\\|").slice(0, 60);
      lines.push(
        `| ${seg.sessionId.slice(0, 8)}... | ${capitalize(seg.sentiment)} ${sentimentEmoji(seg.sentiment)} | ${seg.score.toFixed(2)} | *${sampleSafe}* |`
      );
    }
  } else {
    lines.push("*No sentiment data available.*");
  }
  lines.push("");

  // Helpful responses
  lines.push("## Most Helpful Responses");
  lines.push("");
  if (helpfulResponses.length === 0) {
    lines.push("*No responses to rank.*");
  } else {
    helpfulResponses.forEach((r, i) => {
      lines.push(`### ${i + 1}. Score: ${r.score} — ${shortTs(r.timestamp)}`);
      lines.push(`**Reason:** ${r.reason}`);
      lines.push(`**Session:** \`${r.sessionId.slice(0, 8)}...\``);
      lines.push("");
      lines.push(`> ${r.content}`);
      lines.push("");
    });
  }

  // Token efficiency
  lines.push("## Token Efficiency");
  lines.push("");
  const te = tokenEfficiency;
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Input Tokens | ${fmt(te.totalInputTokens)} |`);
  lines.push(`| Total Output Tokens | ${fmt(te.totalOutputTokens)} |`);
  lines.push(`| Avg Input / Turn | ${fmt(te.avgInputPerTurn)} |`);
  lines.push(`| Avg Output / Turn | ${fmt(te.avgOutputPerTurn)} |`);
  lines.push(`| Efficiency Ratio | ${te.efficiency.toFixed(3)} |`);
  lines.push(`| Most Efficient Session | \`${te.mostEfficientSession.sessionId.slice(0, 12)}\` (ratio: ${te.mostEfficientSession.ratio.toFixed(2)}) |`);
  lines.push(`| Least Efficient Session | \`${te.leastEfficientSession.sessionId.slice(0, 12)}\` (ratio: ${te.leastEfficientSession.ratio.toFixed(2)}) |`);
  lines.push("");

  return lines.join("\n");
}

// ============================================================================
// HTML Report (dark cyberpunk theme)
// ============================================================================

const COLORS = {
  bg: "#0a0a1a",
  card: "#0f0f2a",
  accent: "#00ff88",
  secondary: "#ff00ff",
  text: "#e0e0e0",
  muted: "#888888",
  border: "#1a1a3a",
  positive: "#00ff88",
  neutral: "#888888",
  negative: "#ff4466",
};

function cssBarChart(items: Array<{ label: string; value: number; maxValue: number; color?: string }>): string {
  const bars = items.map(({ label, value, maxValue, color }) => {
    const pctWidth = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
    const barColor = color ?? COLORS.accent;
    return `
      <div style="margin:6px 0;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="color:${COLORS.text};font-size:13px;">${escapeHtml(label)}</span>
          <span style="color:${COLORS.muted};font-size:12px;">${value}</span>
        </div>
        <div style="background:${COLORS.border};border-radius:3px;height:10px;overflow:hidden;">
          <div style="background:${barColor};height:100%;width:${pctWidth}%;transition:width 0.3s;border-radius:3px;"></div>
        </div>
      </div>`;
  }).join("");
  return `<div style="padding:0 0 8px 0;">${bars}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sentimentColor(s: "positive" | "neutral" | "negative"): string {
  switch (s) {
    case "positive": return COLORS.positive;
    case "negative": return COLORS.negative;
    default: return COLORS.neutral;
  }
}

/**
 * Styled HTML report with CSS bar charts and dark cyberpunk theme.
 * Uses inline CSS for portability.
 */
export function formatAnalysisAsHTML(result: AnalysisResult): string {
  const { dateRange, totalTurns, totalSessions, topics, sentiment, helpfulResponses, tokenEfficiency } = result;

  const topicMax = topics.length > 0 ? topics[0].count : 1;

  const topicsHtml = topics.length === 0
    ? `<p style="color:${COLORS.muted};">No topics detected.</p>`
    : cssBarChart(
        topics.slice(0, 10).map((t) => ({
          label: `${t.topic} (${pct(t.percentage)})`,
          value: t.count,
          maxValue: topicMax,
        }))
      );

  const sentimentSegmentsHtml = sentiment.segments.length === 0
    ? `<p style="color:${COLORS.muted};">No sentiment data available.</p>`
    : sentiment.segments
        .map((seg) => {
          const barWidth = Math.round(((seg.score + 1) / 2) * 100); // map [-1,1] → [0,100]
          const color = sentimentColor(seg.sentiment);
          return `
          <div style="margin:8px 0;padding:8px 10px;background:${COLORS.border};border-radius:4px;border-left:3px solid ${color};">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="color:${COLORS.muted};font-size:11px;">${escapeHtml(seg.sessionId.slice(0, 12))}...</span>
              <span style="color:${color};font-size:11px;font-weight:bold;">${capitalize(seg.sentiment)} (${seg.score.toFixed(2)})</span>
            </div>
            <div style="background:${COLORS.bg};height:6px;border-radius:3px;overflow:hidden;margin-bottom:4px;">
              <div style="background:${color};height:100%;width:${barWidth}%;border-radius:3px;"></div>
            </div>
            <div style="color:${COLORS.muted};font-size:11px;font-style:italic;">"${escapeHtml(seg.sample.slice(0, 60))}${seg.sample.length > 60 ? "..." : ""}"</div>
          </div>`;
        })
        .join("");

  const responsesHtml = helpfulResponses.length === 0
    ? `<p style="color:${COLORS.muted};">No responses to rank.</p>`
    : helpfulResponses.slice(0, 5).map((r, i) => `
        <div style="margin:10px 0;padding:10px 14px;background:${COLORS.border};border-radius:6px;border-left:3px solid ${COLORS.secondary};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:${COLORS.secondary};font-size:12px;font-weight:bold;">#${i + 1} — Score: ${r.score}</span>
            <span style="color:${COLORS.muted};font-size:11px;">${shortTs(r.timestamp)}</span>
          </div>
          <div style="color:${COLORS.muted};font-size:11px;margin-bottom:4px;">${escapeHtml(r.reason)}</div>
          <div style="color:${COLORS.text};font-size:13px;font-family:monospace;white-space:pre-wrap;">${escapeHtml(r.content)}</div>
        </div>`).join("");

  const te = tokenEfficiency;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversation Analysis Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${COLORS.bg};
      color: ${COLORS.text};
      font-family: 'Segoe UI', -apple-system, sans-serif;
      line-height: 1.6;
      padding: 24px;
    }
    h1 { color: ${COLORS.accent}; font-size: 28px; margin-bottom: 4px; }
    h2 {
      color: ${COLORS.secondary};
      font-size: 18px;
      margin: 28px 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid ${COLORS.border};
    }
    .meta { color: ${COLORS.muted}; font-size: 13px; margin-bottom: 24px; }
    .card {
      background: ${COLORS.card};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .stat-row { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; }
    .stat {
      background: ${COLORS.border};
      border-radius: 6px;
      padding: 12px 16px;
      min-width: 120px;
      text-align: center;
    }
    .stat-value { color: ${COLORS.accent}; font-size: 28px; font-weight: bold; }
    .stat-label { color: ${COLORS.muted}; font-size: 12px; margin-top: 2px; }
    .overall-sentiment {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      color: ${COLORS.muted};
      text-align: left;
      padding: 6px 10px;
      border-bottom: 1px solid ${COLORS.border};
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid ${COLORS.border};
      vertical-align: top;
    }
    .generated { color: ${COLORS.muted}; font-size: 11px; margin-top: 20px; text-align: center; }
  </style>
</head>
<body>
  <h1>Conversation Analysis Report</h1>
  <div class="meta">
    ${escapeHtml(shortDate(dateRange.start))} &mdash; ${escapeHtml(shortDate(dateRange.end))} &nbsp;|&nbsp;
    Generated: ${escapeHtml(new Date().toLocaleString())}
  </div>

  <!-- Summary Stats -->
  <div class="card">
    <div class="stat-row">
      <div class="stat">
        <div class="stat-value">${fmt(totalTurns)}</div>
        <div class="stat-label">Total Turns</div>
      </div>
      <div class="stat">
        <div class="stat-value">${fmt(totalSessions)}</div>
        <div class="stat-label">Sessions</div>
      </div>
      <div class="stat">
        <div class="stat-value">${fmt(te.totalInputTokens)}</div>
        <div class="stat-label">Input Tokens</div>
      </div>
      <div class="stat">
        <div class="stat-value">${fmt(te.totalOutputTokens)}</div>
        <div class="stat-label">Output Tokens</div>
      </div>
    </div>
  </div>

  <!-- Topics -->
  <div class="card">
    <h2>Topics</h2>
    ${topicsHtml}
  </div>

  <!-- Sentiment -->
  <div class="card">
    <h2>Sentiment Analysis</h2>
    <div class="overall-sentiment" style="background:${sentimentColor(sentiment.overall)}22;color:${sentimentColor(sentiment.overall)};border:1px solid ${sentimentColor(sentiment.overall)};">
      Overall: ${capitalize(sentiment.overall)} ${sentimentEmoji(sentiment.overall)}
    </div>
    ${sentimentSegmentsHtml}
  </div>

  <!-- Helpful Responses -->
  <div class="card">
    <h2>Most Helpful Responses</h2>
    ${responsesHtml}
  </div>

  <!-- Token Efficiency -->
  <div class="card">
    <h2>Token Efficiency</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Total Input Tokens</td><td style="color:${COLORS.accent}">${fmt(te.totalInputTokens)}</td></tr>
        <tr><td>Total Output Tokens</td><td style="color:${COLORS.accent}">${fmt(te.totalOutputTokens)}</td></tr>
        <tr><td>Avg Input / Turn</td><td>${fmt(te.avgInputPerTurn)}</td></tr>
        <tr><td>Avg Output / Turn</td><td>${fmt(te.avgOutputPerTurn)}</td></tr>
        <tr><td>Efficiency Ratio</td><td style="color:${COLORS.secondary}">${te.efficiency.toFixed(3)}</td></tr>
        <tr><td>Most Efficient Session</td><td><code>${escapeHtml(te.mostEfficientSession.sessionId.slice(0, 12))}</code> (${te.mostEfficientSession.ratio.toFixed(2)})</td></tr>
        <tr><td>Least Efficient Session</td><td><code>${escapeHtml(te.leastEfficientSession.sessionId.slice(0, 12))}</code> (${te.leastEfficientSession.ratio.toFixed(2)})</td></tr>
      </tbody>
    </table>
  </div>

  <div class="generated">Generated by Sam &mdash; Discord Remote Control Analysis Engine</div>
</body>
</html>`;
}

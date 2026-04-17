#!/usr/bin/env bun

/**
 * load-core-context.ts
 *
 * Automatically loads your CORE skill context at session start by reading and injecting
 * the CORE SKILL.md file contents directly into Claude's context as a system-reminder.
 *
 * Purpose:
 * - Read CORE SKILL.md file content
 * - Output content as system-reminder for Claude to process
 * - Ensure complete context (contacts, preferences, security, identity) available at session start
 * - Bypass skill activation logic by directly injecting context
 *
 * Setup:
 * 1. Customize your ${PAI_DIR}/skills/CORE/SKILL.md with your personal context
 * 2. Add this hook to settings.json SessionStart hooks
 * 3. Ensure PAI_DIR environment variable is set (defaults to $HOME/.claude)
 *
 * How it works:
 * - Runs at the start of every Claude Code session
 * - Skips execution for subagent sessions (they don't need CORE context)
 * - Reads your CORE SKILL.md file
 * - Injects content as <system-reminder> which Claude processes automatically
 * - Gives your AI immediate access to your complete personal context
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PAI_DIR, SKILLS_DIR } from './lib/pai-paths';
import { loadMinimalSkill, formatAsSystemReminder, getLoadingStats } from './lib/progressive-loader';

async function main() {
  try {
    // Check if this is a subagent session - if so, exit silently
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      // Subagent sessions don't need CORE context loading
      console.error('🤖 Subagent session - skipping CORE context loading');
      process.exit(0);
    }

    // Get CORE skill path using PAI paths library
    const coreSkillPath = join(SKILLS_DIR, 'CORE/SKILL.md');

    // Verify CORE skill file exists
    if (!existsSync(coreSkillPath)) {
      console.error(`❌ CORE skill not found at: ${coreSkillPath}`);
      console.error(`💡 Ensure CORE/SKILL.md exists or check PAI_DIR environment variable`);
      process.exit(1);
    }

    console.error('📚 Reading CORE context from skill file (Tier 1 - Minimal Load)...');

    // Read the CORE SKILL.md file content (minimal version - routing + examples only)
    let coreContent = readFileSync(coreSkillPath, 'utf-8');

    // Perform Dynamic Variable Substitution
    // This allows SKILL.md to be generic while the session is personalized
    const daName = process.env.DA || 'PAI';
    const daColor = process.env.DA_COLOR || 'blue';
    const engineerName = process.env.ENGINEER_NAME || 'User';

    // Replace placeholders {{DA}}, {{DA_COLOR}}, {{ENGINEER_NAME}}
    coreContent = coreContent
      .replace(/\{\{DA\}\}/g, daName)
      .replace(/\{\{DA_COLOR\}\}/g, daColor)
      .replace(/\{\{ENGINEER_NAME\}\}/g, engineerName);

    const coreSize = coreContent.length;
    const estimatedTokens = Math.ceil(coreSize / 4); // Rough: 1 token ≈ 4 chars

    console.error(`✅ Read ${coreSize} characters (≈${estimatedTokens} tokens) from CORE SKILL.md`);
    console.error(`   Personalized for ${engineerName} & ${daName}`);

    // Load the three identity memory files (Tier 1.5)
    const paiDir = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
    // Claude Code stores per-project memory under ~/.claude/projects/<path-encoded-project-dir>/memory/
    // The path encoding replaces "/" with "-" and strips the leading slash
    // e.g. /Users/you/Projects/sAIm → -Users-you-Projects-sAIm
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const projectKey = projectDir.replace(/\//g, '-');
    const memoryDir = join(paiDir, 'projects', projectKey, 'memory');

    let identityContent = '';
    let identityStats = '';

    const identityFiles = [
      { name: 'soul.md', label: 'Soul' },
      { name: 'identity.md', label: 'Identity' },
      { name: 'resume.md', label: 'Resume' }
    ];

    for (const file of identityFiles) {
      const filePath = join(memoryDir, file.name);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        identityContent += `\n## ${file.label}\n\n${content}\n`;
        identityStats += `\n   ✅ Loaded ${file.name} (${content.length} chars)`;
      } else {
        console.error(`⚠️  Identity file not found: ${filePath}`);
      }
    }

    console.error(`\n📖 Loading Identity Memory Files (Tier 1.5)...${identityStats}`);
    console.error(`   ℹ️  Extended context available in Reference.md (loaded on-demand - Tier 2/3)`);

    // Attempt to load Memory Briefing from memory-system API (Phase 1)
    let memoryBriefing = '';
    let patternSuggestions = '';
    let recentActivityBriefing = '';
    try {
      const memoryServiceUrl = process.env.MEMORY_SERVICE_URL || 'http://localhost:4242';
      const projectId = process.env.CLAUDE_PROJECT_NAME ||
                       process.env.PROJECT_ID ||
                       extractProjectFromPath(process.env.CLAUDE_PROJECT_DIR || process.cwd());

      // Phase 3: Fetch recent conversations for "What We Just Worked On" section
      try {
        const sessionId = process.env.CLAUDE_SESSION_ID || process.env.SESSION_ID || 'default-session';
        const onehourAgo = Date.now() - (60 * 60 * 1000); // Look back 1 hour

        const conversationUrl = new URL(`${memoryServiceUrl}/memory/conversations`);
        conversationUrl.searchParams.append('session_id', sessionId);
        conversationUrl.searchParams.append('since', onehourAgo.toString());
        conversationUrl.searchParams.append('limit', '50');

        const recentResponse = await fetch(conversationUrl.toString(), {
          signal: AbortSignal.timeout(2000)
        });

        if (recentResponse.ok) {
          const recentData = await recentResponse.json();
          if (recentData.success && recentData.conversations && recentData.conversations.length > 0) {
            // Format recent activity briefing directly (avoiding dynamic import)
            recentActivityBriefing = formatRecentActivityBriefing(recentData.conversations);
            console.error(`✅ Recent Activity Briefing loaded (${recentData.conversations.length} recent interactions)`);
          } else {
            console.error(`⚠️  Recent Activity Briefing: no recent conversations`);
          }
        } else {
          console.error(`⚠️  Recent Activity Briefing: API returned ${recentResponse.status}`);
        }
      } catch (error) {
        // Silently skip recent activity if unavailable - Phase 3 is optional
        if (!(error instanceof Error && error.message.includes('timeout'))) {
          console.error(`⚠️  Recent Activity Briefing: not available (${error instanceof Error ? error.message : 'unknown error'})`);
        }
      }

      const briefingResponse = await fetch(`${memoryServiceUrl}/memory/query/briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          maxFacts: 15,
          confidenceThreshold: 0.7,
          lookbackDays: 7
        })
      });

      if (briefingResponse.ok) {
        const briefingData = await briefingResponse.json();
        if (briefingData.success && briefingData.data.facts && briefingData.data.facts.length > 0) {
          // Format briefing directly (avoiding dynamic import)
          memoryBriefing = formatBriefingForPrompt(briefingData.data);
          console.error(`✅ Memory Briefing loaded (${briefingData.data.facts.length} facts for ${projectId || 'all projects'})`);
        } else {
          console.error(`⚠️  Memory Briefing: no facts returned from API`);
        }
      } else {
        console.error(`⚠️  Memory Briefing: API returned ${briefingResponse.status}`);
      }

      // Phase 3: Try to load pattern suggestions
      try {
        const patternsResponse = await fetch(`${memoryServiceUrl}/memory/patterns/suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            limit: 5
          }),
          signal: AbortSignal.timeout(2000)
        });

        if (patternsResponse.ok) {
          const patternsData = await patternsResponse.json();
          if (patternsData.success && patternsData.suggestions && patternsData.suggestions.length > 0) {
            patternSuggestions = formatPatternSuggestions(patternsData.suggestions);
            console.error(`💡 Pattern suggestions loaded (${patternsData.suggestions.length} patterns)`);
          }
        }
      } catch (error) {
        // Silently skip patterns if unavailable - Phase 3 is optional
        if (!(error instanceof Error && error.message.includes('timeout'))) {
          console.error(`⚠️  Pattern suggestions: not available`);
        }
      }
    } catch (error) {
      console.error(`⚠️  Memory Briefing: failed to load (service unavailable or error). Continuing without briefing.`);
      // Graceful degradation: continue without briefing
    }

    // Output the CORE content + identity files + recent activity + memory briefing + pattern suggestions as a system-reminder
    // This will be injected into Claude's context at session start
    const message = `<system-reminder>
PAI CORE CONTEXT (Auto-loaded at Session Start)

📅 CURRENT DATE/TIME: ${new Date().toLocaleString('en-US', { timeZone: process.env.TIME_ZONE || 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' })}

The following context has been loaded from ${coreSkillPath}:

---
${coreContent}
---

# IDENTITY MEMORY (Tier 1.5 - Living Documents)

These are persistent, evolving records of Sam's identity. They guide every session and update naturally as the system evolves.
${identityContent}

---

${recentActivityBriefing ? `# WHAT WE JUST WORKED ON (Phase 3 - Recent Activity)

${recentActivityBriefing}

---

` : ''}

${memoryBriefing ? `# EPISODIC MEMORY BRIEFING (Tier 1.6 - Auto-loaded from memory-system)

${memoryBriefing}

---

` : ''}

${patternSuggestions ? `# PATTERN SUGGESTIONS (Phase 3 - Smart Discovery)

Based on your recent session patterns, here are proactive suggestions:

${patternSuggestions}

---

` : ''}

This context is now active for this session. Follow all instructions, preferences, and guidelines contained above.
</system-reminder>`;

    // Write to stdout (will be captured by Claude Code)
    console.log(message);

    console.error('✅ CORE context injected into session');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in load-core-context hook:', error);
    process.exit(1);
  }
}

/**
 * Extract project name from CLAUDE_PROJECT_DIR path
 * Example: /Users/user/Projects/memory-system → memory-system
 */
function extractProjectFromPath(path: string): string {
  if (!path) return '';
  const parts = path.split('/');
  // Find the part after 'Projects/' directory
  const projectsIdx = parts.indexOf('Projects');
  if (projectsIdx >= 0 && projectsIdx + 1 < parts.length) {
    return parts[projectsIdx + 1];
  }
  return '';
}

/**
 * Format briefing query result for injection into system prompt
 * Matches the formatting in briefing-ranked-retrieval.ts
 */
function formatBriefingForPrompt(result: {
  facts: Array<{ topic: string; summary: string; confidence: number; recencyDays: number }>;
  totalCount: number;
  retrievalTimeMs: number;
  project?: string;
  confidenceThreshold?: number;
  maxFacts?: number;
}): string {
  if (!result.facts || result.facts.length === 0) {
    return `## 🧠 Memory Briefing\n**No recent memories found** (confidence threshold: ${Math.round((result.confidenceThreshold || 0.7) * 100)}%+)\n`;
  }

  const factLines = result.facts
    .map(fact => {
      const confidenceBadge = Math.round(fact.confidence * 100);
      const recencyIndicator = fact.recencyDays === 0 ? "today" : `${fact.recencyDays}d ago`;
      return `- **[${confidenceBadge}%]** ${fact.topic} — ${fact.summary} *(${recencyIndicator})*`;
    })
    .join('\n');

  const projectContext = result.project ? ` for **${result.project}**` : '';

  return `## 🧠 Memory Briefing${projectContext}
**Retrieved:** ${result.facts.length}/${result.maxFacts || 15} | **Confidence:** ${Math.round((result.confidenceThreshold || 0.7) * 100)}%+ | **Retrieval:** ${result.retrievalTimeMs}ms

### Recent Learnings
${factLines}
`;
}

/**
 * Format pattern suggestions for injection into system prompt (Phase 3)
 */
function formatPatternSuggestions(patterns: Array<{
  description?: string;
  type?: string;
  confidence?: number;
  suggestion?: string;
}>): string {
  if (!patterns || patterns.length === 0) {
    return '';
  }

  const suggestionLines = patterns
    .map(pattern => {
      const confidence = pattern.confidence ? Math.round(pattern.confidence * 100) : '?';
      const description = pattern.suggestion || pattern.description || 'See pattern analysis';
      return `- **[${confidence}%]** ${description}`;
    })
    .join('\n');

  return `### 🎯 Smart Suggestions
You've detected working patterns! These suggestions are based on your recent session history:

${suggestionLines}

**Tip:** Run \`/accept-suggestion <pattern-id>\` to lock in a pattern for future sessions.
`;
}

/**
 * Format recent activity briefing for injection into system prompt (Phase 3)
 * Converts episodic conversations into a readable "What We Just Worked On" section
 */
function formatRecentActivityBriefing(conversations: Array<{
  id?: string;
  timestamp: number;
  source: string;
  grouping?: string;
  userInput?: string;
  assistantResponse?: string;
  metadata?: Record<string, any>;
}>): string {
  if (!conversations || conversations.length === 0) {
    return `🔄 What We Just Worked On\n\nNo recent activity captured.`;
  }

  // Group conversations by project/context
  const groups: Record<string, typeof conversations> = {};

  for (const conv of conversations) {
    // Extract context (project or source)
    let context = 'General';
    if (conv.metadata?.project) {
      context = `Project: ${conv.metadata.project}`;
    } else if (conv.source === 'discord') {
      context = `Discord: ${conv.metadata?.channel_name || conv.metadata?.channel_id || 'general'}`;
    }

    if (!groups[context]) {
      groups[context] = [];
    }
    groups[context].push(conv);
  }

  // Format groups
  let output = `🔄 What We Just Worked On (Last 1 Hour)\n\n`;

  for (const [context, convs] of Object.entries(groups)) {
    output += `**${context}**\n`;

    for (const conv of convs) {
      const time = new Date(conv.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const userInputPreview = conv.userInput && conv.userInput.length > 50
        ? conv.userInput.substring(0, 50) + '...'
        : conv.userInput || '(message)';

      const responsePreview = conv.assistantResponse && conv.assistantResponse.length > 70
        ? conv.assistantResponse.substring(0, 70) + '...'
        : conv.assistantResponse || '(response)';

      output += `  - [${time}] You: "${userInputPreview}"\n`;
      output += `    Sam: "${responsePreview}"\n`;
    }
    output += '\n';
  }

  // Add summary
  const uniqueProjects = new Set(
    conversations
      .filter(c => c.metadata?.project)
      .map(c => c.metadata!.project)
  ).size;

  output += `**Summary:** ${conversations.length} interaction${conversations.length === 1 ? '' : 's'}`;
  if (uniqueProjects > 0) {
    output += `, ${uniqueProjects} project${uniqueProjects === 1 ? '' : 's'}`;
  }

  return output;
}

main();

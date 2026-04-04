/**
 * Semantic Memory Extraction
 * Automatically extracts key facts, decisions, and learnings from conversation turns
 * and persists them as semantic memories for cross-session retrieval.
 */

import { saveSemanticMemory, findSimilarMemories } from "./db.ts";
import { recordSkillInvocation, recordAgentInvocation } from "./retrospective.ts";
import { appendFileSync, readdirSync, statSync, existsSync, unlinkSync } from "fs";
import path from "path";
import { promisify } from "util";

/**
 * File-level locking for concurrent database access prevention
 * Prevents heartbeat, weekly-strategy, and discord-remote-control from
 * writing to the database simultaneously.
 */
const LOCK_FILE = path.join(process.env.PAI_DIR || `${process.env.HOME}/.claude`, "discord-remote-control", ".memory-lock");
const LOCK_TIMEOUT_MS = 30000; // 30 second timeout

async function acquireLock(maxWaitMs: number = LOCK_TIMEOUT_MS): Promise<void> {
  const startTime = Date.now();
  const lockCheckInterval = 50; // Check every 50ms

  while (existsSync(LOCK_FILE)) {
    if (Date.now() - startTime > maxWaitMs) {
      console.warn(`⚠️ Lock timeout after ${maxWaitMs}ms — forced lock release (stale lock detected)`);
      try {
        unlinkSync(LOCK_FILE);
      } catch (e) {
        // Race condition: another process released it
      }
      break;
    }
    await new Promise(resolve => setTimeout(resolve, lockCheckInterval));
  }

  // Atomic lock creation: write unique content to prevent false releases
  const lockContent = `${Date.now()}-${Math.random()}`;
  Bun.write(LOCK_FILE, lockContent).catch(() => {
    // Ignore write errors; another process may have created it
  });
}

async function releaseLock(): Promise<void> {
  try {
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Project detection patterns — maps keywords/paths to project identifiers.
 * Used to tag memories with the project they belong to.
 */
const PROJECT_INDICATORS: { pattern: RegExp; project: string }[] = [
  { pattern: /discord[-_]?remote[-_]?control|memory\.db|memory[-_]?server|semantic[-_]?memor/i, project: "sam" },
  { pattern: /observability[-_]?dashboard|agent[-_]?monitor/i, project: "sam" },
  { pattern: /awareness[-_]?dashboard/i, project: "sam" },
  { pattern: /cyber[-_\s]?alert/i, project: "cyber-alert-mgr" },
  { pattern: /rot\b|realms[-_]?of[-_]?tomorrow/i, project: "rot" },
  { pattern: /frontmatter\.studio/i, project: "frontmatter-studio" },
];

/**
 * Patterns that indicate actionable facts worth remembering.
 * Each pattern extracts a topic, surrounding context, and confidence level.
 */
interface ExtractionPattern {
  pattern: RegExp;
  topicPrefix: string;
  confidence: number; // ACT-R base confidence score
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // High confidence (explicit completion): 0.80-0.85
  { pattern: /(?:fixed|resolved|remediated|completed|implemented|added|created|built|deployed)\s+(.{10,300})/i, topicPrefix: "Completed", confidence: 0.85 },
  // Medium-High confidence (decision): 0.75
  { pattern: /(?:decided|chose|selected|going with|will use|switched to)\s+(.{10,300})/i, topicPrefix: "Decision", confidence: 0.75 },
  // Medium confidence (architecture/design): 0.70
  { pattern: /(?:architecture|design|pattern|approach|strategy|refactored)\s*:?\s*(.{10,300})/i, topicPrefix: "Architecture", confidence: 0.70 },
  // Medium confidence (security): 0.70
  { pattern: /(?:security|vulnerability|CVE|exploit|injection|sanitiz|validat)\s*:?\s*(.{10,300})/i, topicPrefix: "Security", confidence: 0.70 },
  // Medium-Low confidence (configuration): 0.65
  { pattern: /(?:configured|set up|installed|enabled|disabled|updated config)\s+(.{10,300})/i, topicPrefix: "Configuration", confidence: 0.65 },
  // Medium-High confidence (debugging): 0.75
  { pattern: /(?:root cause|the issue was|problem was|bug was|caused by)\s+(.{10,300})/i, topicPrefix: "Debugging", confidence: 0.75 },
  // Medium-Low confidence (analysis): 0.60
  { pattern: /(?:summary|findings?|analysis|assessment|review|status update)\s*:?\s*(.{10,300})/i, topicPrefix: "Analysis", confidence: 0.60 },
  // Low-Medium confidence (recommendation): 0.55
  { pattern: /(?:recommend|suggest|should|next steps?|action items?)\s*:?\s*(.{10,300})/i, topicPrefix: "Recommendation", confidence: 0.55 },
  // Medium confidence (informational/conversational): 0.65
  { pattern: /(?:known for|famous for|best known for)\s+(.{10,300})/i, topicPrefix: "Fact", confidence: 0.65 },
  { pattern: /(?:refers to|most commonly refers to)\s+(.{10,300})/i, topicPrefix: "Definition", confidence: 0.65 },
  { pattern: /(?:is (?:a|an|the)\s+(?:star|famous|notable|well-known|legendary|iconic))\s+(.{10,300})/i, topicPrefix: "Fact", confidence: 0.60 },
  // User preference/personal info: 0.80
  { pattern: /(?:i (?:like|love|prefer|enjoy|hate|dislike|always|never|usually))\s+(.{10,300})/i, topicPrefix: "Preference", confidence: 0.80 },
];

/**
 * Status markers that indicate completed work (high-value for memory)
 */
const COMPLETION_MARKERS = [
  /\b(?:done|complete|fixed|resolved|remediated|shipped|merged)\b/i,
  /✅|☑️|✔️/,
  /status:\s*(?:done|complete|fixed)/i,
  /\|\s*(?:Fixed|Done|Complete|Already fixed)\s*\|/i,
];

/**
 * Substantive response markers — responses worth extracting from even without
 * explicit completion markers (e.g. analysis, summaries, gap reports, informational answers)
 */
const SUBSTANTIVE_MARKERS = [
  /##\s+.{5,}/,                     // Markdown headers indicate structured response
  /\|.*\|.*\|/,                     // Table rows indicate data-rich responses
  /(?:found|identified|discovered)\s+\d+/i,  // Quantified findings
  /here's what/i,                   // "Here's what I found" pattern
  /\d+\s+(?:of|out of)\s+\d+/i,    // Progress fractions like "28 of 35"
  /\*\*[^*]{3,}\*\*/,              // Bold text sections indicate key info
  /^[-*]\s+.{10,}/m,              // Bullet list items with substantive content
  /(?:known for|famous for|best known)/i,  // Biographical/factual info
  /(?:refers to|most commonly|also known as)/i,  // Definitional answers
  /(?:fun fact|interesting|notably)/i,  // Notable information
];

/**
 * Truncate text at a sentence boundary, falling back to word boundary.
 * Prefers ending at ". ", "! ", "? ", or "— " within maxLen.
 */
function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const truncated = text.substring(0, maxLen);
  // Find last sentence boundary
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("— "),
  );

  if (lastSentenceEnd > maxLen * 0.4) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }

  // Fall back to last word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.5) {
    return truncated.substring(0, lastSpace).trim();
  }

  return truncated.trim();
}

/**
 * Generate a specific topic from a generic prefix and the extracted content.
 * E.g. "Completed" + "memory deduplication logic for the SQLite database" → "Completed: memory-deduplication-logic"
 */
function makeSpecificTopic(prefix: string, summary: string): string {
  // Extract first few meaningful words (skip articles, prepositions)
  const stopWords = new Set(["the", "a", "an", "to", "for", "of", "in", "on", "at", "by", "with", "and", "or", "that", "this", "is", "was", "are", "were", "been", "be"]);
  const words = summary
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()))
    .slice(0, 4)
    .map(w => w.toLowerCase());

  if (words.length === 0) return prefix;
  return `${prefix}: ${words.join("-")}`;
}

/**
 * Quality gate: determines if an extracted summary is coherent and useful.
 * Rejects fragments that are nonsensical out of context.
 */
function isCoherentSummary(summary: string): boolean {
  // Must have at least 3 real words (not just stop words or punctuation)
  const stopWords = new Set(["the", "a", "an", "to", "for", "of", "in", "on", "at", "by", "with", "and", "or", "that", "this", "is", "was", "are", "were", "been", "be", "it", "its"]);
  const meaningfulWords = summary
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

  if (meaningfulWords.length < 3) return false;

  // Reject if it's mostly code/symbols (>40% non-alpha characters)
  const alphaRatio = (summary.match(/[a-zA-Z]/g)?.length ?? 0) / summary.length;
  if (alphaRatio < 0.4) return false;

  // Reject if it starts mid-sentence with a very short word that's clearly a fragment
  // But allow common starts like "to use", "a new", "the old"
  const trimmed = summary.trim();
  const commonStarts = ["to ", "the ", "a ", "an ", "we ", "it ", "is ", "by ", "no ", "so "];
  if (/^[a-z]{1,2}\s/.test(trimmed) && !commonStarts.some(s => trimmed.startsWith(s))) return false;

  // Reject fragments that are just trailing text from a regex over-match
  // e.g. "ity gate even with short assistant responses."
  if (trimmed.length < 30 && !trimmed.includes(" ") ) return false;

  return true;
}

/**
 * Detect which project a conversation is about based on content signals.
 * Returns the project identifier or 'sam' as default.
 */
export function detectProject(userMessage: string, assistantResponse: string): string {
  const combined = userMessage + " " + assistantResponse;
  for (const { pattern, project } of PROJECT_INDICATORS) {
    if (pattern.test(combined)) return project;
  }
  return "sam";
}

/**
 * Jaccard similarity between two text strings
 * Measures set similarity of words: intersection / union
 * Returns value from 0 to 1, where 1 = identical word sets
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Extract key facts from a conversation exchange (user message + assistant response)
 * Returns semantic memory entries to be saved with confidence scores.
 */
/**
 * Map topic prefixes to semantic tags for retrospective analysis.
 * A fact can have multiple tags based on its topic and content.
 */
function inferTags(topicPrefix: string, summary: string): string[] {
  const tags: string[] = [];

  // Primary tag from topic
  const topicTagMap: Record<string, string> = {
    "Completed": "completion",
    "Decision": "architectural-decision",
    "Architecture": "architectural-decision",
    "Security": "security",
    "Configuration": "configuration",
    "Debugging": "pain-point",
    "Analysis": "insight",
    "Recommendation": "recommendation",
    "Fact": "fact",
    "Definition": "fact",
    "Preference": "preference",
  };
  const primaryTag = topicTagMap[topicPrefix];
  if (primaryTag) tags.push(primaryTag);

  // Secondary tags from content analysis
  if (/(?:bug|issue|error|broken|fail|crash|wrong)/i.test(summary)) {
    if (!tags.includes("pain-point")) tags.push("pain-point");
  }
  if (/(?:workaround|hack|temporary|quick fix)/i.test(summary)) {
    tags.push("anti-pattern");
  }
  if (/(?:should|could|might want to|consider)/i.test(summary)) {
    if (!tags.includes("recommendation")) tags.push("recommendation");
  }

  return tags;
}

export function extractSemanticFacts(
  userMessage: string,
  assistantResponse: string,
  sessionId: string
): { topic: string; summary: string; confidence: number; tags: string[]; project: string }[] {
  const facts: { topic: string; summary: string; confidence: number; tags: string[]; project: string }[] = [];
  const project = detectProject(userMessage, assistantResponse);

  // Check if this exchange contains completion markers (highest value)
  const hasCompletionMarker = COMPLETION_MARKERS.some((marker) =>
    marker.test(assistantResponse)
  );

  // Also check for substantive responses worth extracting from
  const hasSubstantiveContent = SUBSTANTIVE_MARKERS.some((marker) =>
    marker.test(assistantResponse)
  );

  // Length-based substantive check: longer responses likely contain useful info
  const isLongResponse = assistantResponse.length > 300;

  // Check if user message contains preference/personal info worth capturing
  const hasUserPreference = /(?:i (?:like|love|prefer|enjoy|hate|dislike|always|never|usually))\s+.{5,}/i.test(userMessage);

  if (!hasCompletionMarker && !hasSubstantiveContent && !isLongResponse && !hasUserPreference) {
    // Skip casual conversation, short answers, etc.
    return facts;
  }

  // Require minimum response length to avoid extracting from trivial responses
  if (assistantResponse.length < 50) {
    return facts;
  }

  // Extract table-formatted status updates FIRST (most specific, highest priority)
  const tableRows = assistantResponse.matchAll(
    /\|\s*\*\*([^*]+)\*\*\s*\|\s*(?:Fixed|Done|Complete|Already fixed|Remediated|Working|Stale)[^|]*\|\s*([^|]+)\|/gi
  );
  for (const row of tableRows) {
    const finding = row[1]?.trim();
    const description = row[2]?.trim();
    if (finding && description) {
      const cleanDesc = description.replace(/[*_`]/g, "").substring(0, 400);
      if (isCoherentSummary(cleanDesc)) {
        facts.push({
          topic: `Remediated: ${finding}`,
          summary: cleanDesc,
          confidence: 0.85,
          tags: ["completion", "security"],
          project,
        });
      }
    }
  }

  // Extract facts using patterns
  for (const { pattern, topicPrefix, confidence: baseConfidence } of EXTRACTION_PATTERNS) {
    const matches = assistantResponse.matchAll(new RegExp(pattern, "gi"));
    for (const match of matches) {
      const detail = match[1]?.trim();
      if (detail && detail.length > 10) {
        // Clean up the detail - remove trailing punctuation artifacts
        const cleanDetail = detail
          .replace(/[|*_`]/g, "")
          .replace(/\s+/g, " ")
          .trim();

        if (cleanDetail.length > 10) {
          const summary = truncateAtSentence(cleanDetail, 400);

          // Quality gate: reject incoherent fragments
          if (!isCoherentSummary(summary)) continue;

          // Boost confidence if completion markers present
          let confidence = baseConfidence;
          if (hasCompletionMarker) {
            confidence = Math.min(0.95, confidence * 1.2);
          }

          facts.push({
            topic: makeSpecificTopic(topicPrefix, cleanDetail),
            summary,
            confidence,
            tags: inferTags(topicPrefix, cleanDetail),
            project,
          });
        }
      }
    }
  }

  // Extract user preferences from the USER message (not assistant response)
  for (const match of userMessage.matchAll(
    /(?:i (?:like|love|prefer|enjoy|hate|dislike|always|never|usually))\s+(.{5,120})/gi
  )) {
    const detail = match[1]?.trim().replace(/[|*_`]/g, "").replace(/\s+/g, " ").trim();
    if (detail && detail.length > 5) {
      const summary = truncateAtSentence(detail, 400);
      if (isCoherentSummary(summary)) {
        facts.push({
          topic: makeSpecificTopic("Preference", detail),
          summary,
          confidence: 0.80,
          tags: ["preference"],
          project,
        });
      }
    }
  }

  // Deduplicate by summary similarity (using Jaccard)
  return deduplicateFacts(facts);
}

/**
 * Remove duplicate or near-duplicate facts within the extracted set.
 * Uses Jaccard similarity (>0.6 threshold) for fuzzy matching.
 */
function deduplicateFacts(
  facts: { topic: string; summary: string; confidence: number; tags: string[]; project: string }[]
): { topic: string; summary: string; confidence: number; tags: string[]; project: string }[] {
  const kept: typeof facts = [];
  for (const fact of facts) {
    const isDuplicate = kept.some(
      (existing) => jaccardSimilarity(existing.summary, fact.summary) > 0.6
    );
    if (!isDuplicate) {
      kept.push(fact);
    }
  }
  return kept;
}

/**
 * Process a conversation exchange and save extracted facts as semantic memories.
 * Uses Jaccard similarity to detect corroborating evidence and strengthen existing engrams.
 */
export async function extractAndSaveMemories(
  userMessage: string,
  assistantResponse: string,
  sessionId: string,
  source: string = 'discord',
  projectOverride?: string
): Promise<number> {
  // Acquire exclusive lock before accessing database
  await acquireLock();

  try {
    const facts = extractSemanticFacts(userMessage, assistantResponse, sessionId);

    if (facts.length === 0) {
      return 0;
    }

    let savedCount = 0;

    for (const fact of facts) {
      // Check GLOBALLY for duplicates using Jaccard similarity (undefined = all sessions)
      const existing = await findSimilarMemories(fact.topic, undefined, 5);

      // Find if any existing memory is similar enough (Jaccard > 0.6)
      const duplicateMatch = existing.find(
        (mem) => jaccardSimilarity(mem.summary, fact.summary) > 0.6
      );

      if (duplicateMatch && duplicateMatch.id) {
        // Strengthen existing engram instead of skipping
        const newConfidence = duplicateMatch.confidence + (1 - duplicateMatch.confidence) * 0.15;
        const { getMemoryInstance: getMemInst } = await import('./db.ts');
        getMemInst().update("semantic", duplicateMatch.id, {
          confidence: newConfidence,
          accessCount: duplicateMatch.accessCount + 1,
          lastAccess: Date.now(),
        });
        console.log(
          `🧠 Strengthened memory [${fact.topic}] (confidence: ${(newConfidence * 100).toFixed(1)}%)`
        );
      } else {
        // Save new fact with project context
        await saveSemanticMemory({
          sessionId,
          topic: fact.topic,
          summary: fact.summary,
          relevanceScore: 1.0,
          createdAt: Date.now(),
          sourceMessageIds: [],
          accessCount: 0,
          lastAccess: Date.now(),
          confidence: fact.confidence,
          source,
          tags: fact.tags,
          project: projectOverride || fact.project,
        });
        savedCount++;
        console.log(`🧠 Extracted memory: [${fact.topic}] ${fact.summary.substring(0, 60)}...`);
      }
    }

    if (savedCount > 0) {
      console.log(`🧠 Saved ${savedCount} new semantic memories from conversation`);
      // Sync high-value facts to persistent memory file
      syncToMemoryFile(facts.slice(0, savedCount));
    }

    // Detect and record skill + agent invocations from the conversation
    detectAndRecordSkills(userMessage, assistantResponse);
    detectAndRecordAgents(userMessage, assistantResponse);

    return savedCount;
  } catch (error) {
    console.error("Error extracting semantic memories:", error);
    return 0;
  } finally {
    // Always release lock, even on error
    await releaseLock();
  }
}

/**
 * Minimum length for a valid skill/agent name.
 * Prevents false positives from single-character matches.
 */
const MIN_NAME_LENGTH = 3;

/**
 * Common words that match patterns but aren't skills or agents.
 * Prevents false positives from conversational text.
 */
const DENY_LIST = new Set([
  "the", "this", "that", "them", "then", "they", "their",
  "using", "used", "user", "users", "use",
  "skill", "skills", "skillname", "agent", "agents",
  "running", "executed", "invoked", "invoke",
  "new", "old", "all", "any", "some", "none",
  "was", "were", "has", "had", "have", "been",
  "not", "yes", "can", "will", "but", "and", "for",
]);

/**
 * Dynamically load the set of valid skill names from the ~/.claude/skills/ directory.
 * Returns lowercase skill names. Cached for 5 minutes to avoid excessive filesystem reads.
 */
let _validSkillsCache: Set<string> | null = null;
let _validSkillsCacheTime = 0;
const SKILL_CACHE_TTL_MS = 5 * 60 * 1000;

function getValidSkillNames(): Set<string> {
  const now = Date.now();
  if (_validSkillsCache && now - _validSkillsCacheTime < SKILL_CACHE_TTL_MS) {
    return _validSkillsCache;
  }

  const skills = new Set<string>();
  const home = process.env.HOME || "";
  const skillsDir = path.join(home, ".claude", "skills");

  try {
    const entries = readdirSync(skillsDir);
    for (const entry of entries) {
      const fullPath = path.join(skillsDir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          skills.add(entry.toLowerCase());
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch (e) {
    console.warn("Could not read skills directory:", e);
  }

  // Native Claude Code built-in skills (from binary at /opt/homebrew/Caskroom/claude-code)
  const nativeSkills = [
    "batch", "claude-api", "claude-in-chrome", "debug",
    "keybindings-help", "loop", "schedule", "simplify",
    "update-config",
  ];
  for (const s of nativeSkills) {
    skills.add(s);
  }

  _validSkillsCache = skills;
  _validSkillsCacheTime = now;
  return skills;
}

/**
 * Dynamically load the set of valid agent names from the ~/.claude/agents/ directory.
 * Returns lowercase agent names. Cached for 5 minutes.
 */
let _validAgentsCache: Set<string> | null = null;
let _validAgentsCacheTime = 0;

function getValidAgentNames(): Set<string> {
  const now = Date.now();
  if (_validAgentsCache && now - _validAgentsCacheTime < SKILL_CACHE_TTL_MS) {
    return _validAgentsCache;
  }

  const agents = new Set<string>();
  const home = process.env.HOME || "";
  const agentsDir = path.join(home, ".claude", "agents");

  try {
    const entries = readdirSync(agentsDir);
    for (const entry of entries) {
      const fullPath = path.join(agentsDir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          agents.add(entry.toLowerCase());
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch (e) {
    console.warn("Could not read agents directory:", e);
  }

  // Built-in Claude Code agent types (not in ~/.claude/agents/)
  const builtinAgents = [
    "general-purpose", "explore", "plan",
  ];
  for (const a of builtinAgents) {
    agents.add(a);
  }

  _validAgentsCache = agents;
  _validAgentsCacheTime = now;
  return agents;
}

/**
 * Validate a candidate name against minimum length, deny list, and known names.
 */
function isValidName(name: string, validSet: Set<string>): boolean {
  if (name.length < MIN_NAME_LENGTH) return false;
  if (DENY_LIST.has(name)) return false;
  return validSet.has(name);
}

/**
 * Detect skill invocations from conversation content and record them.
 * Only records skills that exist in ~/.claude/skills/ or are native Claude Code skills.
 * Looks for patterns like "Running the X workflow from the Y skill",
 * "/skillname" triggers, "Skill(skillname)" tool calls, and mid-sentence slash commands.
 */
export function detectAndRecordSkills(userMessage: string, assistantResponse: string): void {
  try {
    const validSkills = getValidSkillNames();
    const combined = userMessage + "\n" + assistantResponse;
    const detectedSkills = new Map<string, string>(); // name -> trigger context

    // Pattern 1: "Running the X workflow from the Y skill"
    const workflowMatches = combined.matchAll(
      /Running the \*\*(\w+)\*\* workflow from the \*\*(\w[\w-]*)\*\* skill/gi
    );
    for (const match of workflowMatches) {
      detectedSkills.set(match[2].toLowerCase(), `workflow:${match[1]}`);
    }

    // Pattern 2: Slash command "/skillname" anywhere in user message (not just start of line)
    const slashMatches = userMessage.matchAll(/(?:^|\s)\/(\w[\w-]{2,})/gm);
    for (const match of slashMatches) {
      detectedSkills.set(match[1].toLowerCase(), "slash-command");
    }

    // Pattern 3: Skill tool invocation "Skill(skillname)" or skill: "skillname" in response
    const skillToolMatches = assistantResponse.matchAll(
      /(?:Skill|skill)\s*(?:\(|:\s*)\s*["']?([\w-]{3,})["']?\s*\)?/g
    );
    for (const match of skillToolMatches) {
      detectedSkills.set(match[1].toLowerCase(), "tool-invocation");
    }

    // Pattern 4: "Using the X skill" or "invoked the X skill"
    const usingSkillMatches = combined.matchAll(
      /(?:using|invoked|invok(?:e|ing)|running|executed?|leverage)\s+(?:the\s+)?[`*]*(\w[\w-]{2,})[`*]*\s+skill/gi
    );
    for (const match of usingSkillMatches) {
      detectedSkills.set(match[1].toLowerCase(), "natural-language");
    }

    // Pattern 5: "the **skillname** skill" (bold name reference)
    const boldSkillMatches = combined.matchAll(
      /(?:the\s+)\*\*(\w[\w-]{2,})\*\*\s+skill/gi
    );
    for (const match of boldSkillMatches) {
      detectedSkills.set(match[1].toLowerCase(), "reference");
    }

    // Pattern 6: fabric:[pattern] — track both fabric skill and the specific pattern
    const fabricPatternMatches = combined.matchAll(
      /fabric[:\s]+(\w[\w_-]{2,})/gi
    );
    for (const match of fabricPatternMatches) {
      const pattern = match[1].toLowerCase();
      // Skip if pattern is a generic word that isn't a real fabric pattern
      if (!["the", "skill", "native", "pattern", "patterns", "cli"].includes(pattern)) {
        detectedSkills.set("fabric", `fabric-pattern:${pattern}`);
      }
    }

    // Record only validated skills
    for (const [skillName, triggerContext] of detectedSkills) {
      if (!isValidName(skillName, validSkills)) {
        if (skillName.length >= MIN_NAME_LENGTH && !DENY_LIST.has(skillName)) {
          console.log(`⏭️ Skipping unrecognized skill: "${skillName}" (not in ~/.claude/skills/ or native)`);
        }
        continue;
      }
      const hasError = new RegExp(`${skillName}.*(?:failed|error|couldn't|cannot)`, "i").test(assistantResponse);
      recordSkillInvocation(skillName, !hasError, undefined, "discord", false, undefined, triggerContext);
      console.log(`📊 Recorded skill invocation: ${skillName} (trigger: ${triggerContext}, success: ${!hasError})`);
    }
  } catch (e) {
    console.warn("Skill detection failed (non-critical):", e);
  }
}

/**
 * Detect agent invocations from conversation content and record them.
 * Looks for patterns like "Agent(type: engineer)", "launching the researcher agent",
 * and subagent_type references.
 */
export function detectAndRecordAgents(userMessage: string, assistantResponse: string): void {
  try {
    const validAgents = getValidAgentNames();
    const combined = userMessage + "\n" + assistantResponse;
    const detectedAgents = new Map<string, string>(); // name -> trigger context

    // Pattern 1: Agent tool with subagent_type: "agent-name"
    const subagentMatches = assistantResponse.matchAll(
      /subagent_type\s*[:=]\s*["']?([\w-]{3,})["']?/gi
    );
    for (const match of subagentMatches) {
      detectedAgents.set(match[1].toLowerCase(), "subagent-type");
    }

    // Pattern 2: "launching/spawning/using the X agent"
    const launchMatches = combined.matchAll(
      /(?:launch(?:ing|ed)?|spawn(?:ing|ed)?|using|delegat(?:e|ing|ed)\s+to)\s+(?:the\s+)?(?:a\s+)?[`*]*([\w-]{3,})[`*]*\s+agent/gi
    );
    for (const match of launchMatches) {
      detectedAgents.set(match[1].toLowerCase(), "natural-language");
    }

    // Pattern 3: "Agent(description, type: agent-name)" pattern
    const agentToolMatches = assistantResponse.matchAll(
      /Agent\s*\([^)]*(?:type|subagent_type)\s*[:=]\s*["']?([\w-]{3,})["']?/gi
    );
    for (const match of agentToolMatches) {
      detectedAgents.set(match[1].toLowerCase(), "tool-invocation");
    }

    // Pattern 4: "the **agent-name** agent" (bold reference)
    const boldAgentMatches = combined.matchAll(
      /(?:the\s+)\*\*([\w-]{3,})\*\*\s+agent/gi
    );
    for (const match of boldAgentMatches) {
      detectedAgents.set(match[1].toLowerCase(), "reference");
    }

    // Record only validated agents
    for (const [agentName, triggerContext] of detectedAgents) {
      if (!isValidName(agentName, validAgents)) {
        if (agentName.length >= MIN_NAME_LENGTH && !DENY_LIST.has(agentName)) {
          console.log(`⏭️ Skipping unrecognized agent: "${agentName}" (not in ~/.claude/agents/ or builtin)`);
        }
        continue;
      }
      const hasError = new RegExp(`${agentName}.*(?:failed|error|couldn't|cannot)`, "i").test(assistantResponse);
      recordAgentInvocation(agentName, !hasError, undefined, triggerContext);
      console.log(`📊 Recorded agent invocation: ${agentName} (trigger: ${triggerContext}, success: ${!hasError})`);
    }
  } catch (e) {
    console.warn("Agent detection failed (non-critical):", e);
  }
}

/** Exported for testing — reset the caches */
export function _resetDetectionCaches(): void {
  _validSkillsCache = null;
  _validSkillsCacheTime = 0;
  _validAgentsCache = null;
  _validAgentsCacheTime = 0;
}

/**
 * Append high-value extracted facts to the persistent memory file.
 * This ensures facts survive DB rebuilds and are visible to the
 * auto-memory system loaded at session start.
 */
function syncToMemoryFile(
  facts: { topic: string; summary: string; confidence: number }[]
): void {
  try {
    // Dynamically resolve the memory directory based on current user and project path
    const home = process.env.HOME || "";
    // Derive slug from actual home path (works on both /home/user and /Users/user)
    const homeSlug = home.replace(/^\//, "").replace(/\//g, "-");
    const memoryDir = path.join(
      home,
      `.claude/projects/-${homeSlug}-Projects-sam/memory`
    );
    const syncFile = path.join(memoryDir, "extracted-facts.md");

    const lines = facts.map(
      (f) => `- **${f.topic}** (${(f.confidence * 100).toFixed(0)}%): ${f.summary}`
    );

    const timestamp = new Date().toISOString().split("T")[0];
    const block = `\n### ${timestamp}\n${lines.join("\n")}\n`;

    appendFileSync(syncFile, block);
  } catch (error) {
    // Non-critical — log but don't fail extraction
    console.error("Memory file sync failed (non-critical):", error);
  }
}

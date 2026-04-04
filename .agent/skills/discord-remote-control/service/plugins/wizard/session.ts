/**
 * Wizard Session Manager
 *
 * Tracks per-user wizard sessions with state machine progression.
 * Each user can have one active wizard session at a time.
 */

import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

// ============================================================================
// Types
// ============================================================================

export interface ProductBrief {
  title: string;
  description: string;
  goals: string[];
  projectType: string;
  planningTrack?: "quick-flow" | "agile-standard" | "enterprise";
}

export interface WizardMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
  thinking?: string;
  phase?: string;
}

export type WizardPhase =
  | "setup"              // Gathering project name, description, goals
  | "analyst_interview"  // Carson brainstorming
  | "analyst_gen"        // Generating product-brief.md
  | "pm_interview"       // Maya requirements
  | "pm_gen"             // Generating PRD.md
  | "architect_interview" // Quinn tech spec
  | "architect_gen"      // Generating tech-spec.md
  | "security_interview" // Victor security
  | "security_gen"       // Generating BDD.md
  | "completed"          // All docs generated
  | "cancelled";

export interface WizardSession {
  userId: string;
  channelId: string;
  workflowId: string;
  phase: WizardPhase;
  brief: Partial<ProductBrief>;
  createdAt: string;
  updatedAt: string;
  // Generated document contents
  briefContent?: string;
  prdContent?: string;
  techSpecContent?: string;
  bddContent?: string;
  // Phase interview histories
  phaseHistories: Record<string, WizardMessage[]>;
  // LLM config
  backend?: string;
  model?: string;
  outputDir?: string;
}

// ============================================================================
// Phase progression
// ============================================================================

const PHASE_ORDER: WizardPhase[] = [
  "setup",
  "analyst_interview",
  "analyst_gen",
  "pm_interview",
  "pm_gen",
  "architect_interview",
  "architect_gen",
  "security_interview",
  "security_gen",
  "completed",
];

const INTERVIEW_PHASES: WizardPhase[] = [
  "analyst_interview",
  "pm_interview",
  "architect_interview",
  "security_interview",
];

export function isInterviewPhase(phase: WizardPhase): boolean {
  return INTERVIEW_PHASES.includes(phase);
}

export function nextPhase(current: WizardPhase): WizardPhase {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return "completed";
  return PHASE_ORDER[idx + 1];
}

export function phasePersona(phase: WizardPhase): string {
  switch (phase) {
    case "analyst_interview":
    case "analyst_gen":
      return "Carson (Analyst)";
    case "pm_interview":
    case "pm_gen":
      return "Maya (Product Manager)";
    case "architect_interview":
    case "architect_gen":
      return "Quinn (Architect)";
    case "security_interview":
    case "security_gen":
      return "Victor (Security)";
    default:
      return "Sam";
  }
}

export function phaseEmoji(phase: WizardPhase): string {
  switch (phase) {
    case "setup": return "📋";
    case "analyst_interview": return "🧠";
    case "analyst_gen": return "📝";
    case "pm_interview": return "📊";
    case "pm_gen": return "📝";
    case "architect_interview": return "🏗️";
    case "architect_gen": return "📝";
    case "security_interview": return "🔒";
    case "security_gen": return "📝";
    case "completed": return "✅";
    case "cancelled": return "❌";
    default: return "📌";
  }
}

// ============================================================================
// Session Store
// ============================================================================

/** In-memory session store, keyed by userId */
const sessions = new Map<string, WizardSession>();

/** Data directory for persisting wizard state */
let dataDir = "";

export function initWizardDataDir(dir: string): void {
  dataDir = dir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function sessionFile(userId: string): string {
  return join(dataDir, `wizard_${userId}.json`);
}

function persistSession(session: WizardSession): void {
  if (!dataDir) return;
  session.updatedAt = new Date().toISOString();
  writeFileSync(sessionFile(session.userId), JSON.stringify(session, null, 2));
}

function loadSession(userId: string): WizardSession | null {
  const file = sessionFile(userId);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as WizardSession;
  } catch {
    return null;
  }
}

// ============================================================================
// Public API
// ============================================================================

export function getSession(userId: string): WizardSession | null {
  // Check memory first, then disk
  let session = sessions.get(userId) ?? null;
  if (!session) {
    session = loadSession(userId);
    if (session && session.phase !== "completed" && session.phase !== "cancelled") {
      sessions.set(userId, session);
    }
  }
  return session;
}

export function hasActiveSession(userId: string): boolean {
  const session = getSession(userId);
  return session !== null && session.phase !== "completed" && session.phase !== "cancelled";
}

export function createSession(userId: string, channelId: string): WizardSession {
  const session: WizardSession = {
    userId,
    channelId,
    workflowId: `wiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phase: "setup",
    brief: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phaseHistories: {},
    backend: "claude",
    model: "claude-sonnet-4-20250514",
  };

  sessions.set(userId, session);
  persistSession(session);
  return session;
}

export function updateSession(userId: string, updates: Partial<WizardSession>): WizardSession | null {
  const session = getSession(userId);
  if (!session) return null;

  Object.assign(session, updates);
  sessions.set(userId, session);
  persistSession(session);
  return session;
}

export function appendPhaseMessage(userId: string, phase: string, message: WizardMessage): void {
  const session = getSession(userId);
  if (!session) return;

  if (!session.phaseHistories[phase]) {
    session.phaseHistories[phase] = [];
  }
  session.phaseHistories[phase].push(message);
  persistSession(session);
}

export function getPhaseHistory(userId: string, phase: string): WizardMessage[] {
  const session = getSession(userId);
  if (!session) return [];
  return session.phaseHistories[phase] || [];
}

export function endSession(userId: string, status: "completed" | "cancelled"): void {
  const session = getSession(userId);
  if (!session) return;

  session.phase = status;
  persistSession(session);
  sessions.delete(userId);
}

export function clearSession(userId: string): void {
  sessions.delete(userId);
  const file = sessionFile(userId);
  if (existsSync(file)) {
    try {
      writeFileSync(file, ""); // Clear but don't delete
    } catch { /* ignore */ }
  }
}

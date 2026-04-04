/**
 * Wizard Plugin for Discord Remote Control
 *
 * Provides a conversational project planning wizard through Discord.
 * Users interact with four personas (Carson, Maya, Quinn, Victor) who conduct
 * interviews and generate planning documents (product-brief.md, PRD.md,
 * tech-spec.md, BDD.md).
 *
 * Commands:
 *   !wizard                  - Start a new wizard session
 *   !wizard status            - Show current session status
 *   !wizard cancel            - Cancel current session
 *   !wizard done / !wizard next - Complete current interview phase
 *   !wizard skip              - Skip current phase
 *   !wizard backend <name>    - Switch LLM backend (claude/ollama/gemini)
 *
 * During an active session, all regular messages are routed to the current
 * interview persona instead of the default Claude subprocess handler.
 */

import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { mkdir, writeFile } from "node:fs/promises";
import type { Message } from "discord.js";
import type { Plugin, PluginResult, DiscordConfig, MessageContext } from "../types.ts";
import {
  type WizardSession,
  type WizardPhase,
  type WizardMessage,
  getSession,
  hasActiveSession,
  createSession,
  updateSession,
  appendPhaseMessage,
  getPhaseHistory,
  endSession,
  clearSession,
  initWizardDataDir,
  isInterviewPhase,
  nextPhase,
  phasePersona,
  phaseEmoji,
} from "./session.ts";
import {
  callLLM,
  getInterviewSystemPrompt,
  getDocGenerationPrompt,
  getInitialGreeting,
} from "./llm.ts";
import { sendVoiceResponse } from "../../response/voice.ts";

// ============================================================================
// Constants
// ============================================================================

const WIZARD_TRIGGER = /^!wizard\b/i;
const DONE_PHRASES = /^(!wizard\s+)?(done|next|finish|complete|move\s*on)\s*$/i;
const SKIP_PHRASES = /^(!wizard\s+)?skip\s*$/i;

// ============================================================================
// Plugin Implementation
// ============================================================================

const wizardPlugin: Plugin = {
  name: "wizard",
  description: "Conversational project planning wizard with 4 persona interviews",
  version: "1.0.0",
  priority: 10,

  canHandle(message: Message, context: MessageContext): boolean {
    // Only handle text messages
    if (context.messageType !== "text") return false;

    const content = message.content.trim();

    // Handle wizard commands
    if (WIZARD_TRIGGER.test(content)) return true;

    // Handle messages during active wizard sessions
    if (hasActiveSession(message.author.id)) return true;

    return false;
  },

  async handle(
    message: Message,
    config: DiscordConfig,
    context: MessageContext
  ): Promise<PluginResult> {
    const content = message.content.trim();
    const userId = message.author.id;

    // ====== Command routing ======
    if (WIZARD_TRIGGER.test(content)) {
      const subcommand = content.replace(WIZARD_TRIGGER, "").trim().toLowerCase();

      switch (subcommand) {
        case "":
        case "start":
          return await startWizard(message, config);

        case "status":
          return await showStatus(message);

        case "cancel":
        case "quit":
          return await cancelWizard(message);

        case "done":
        case "next":
        case "finish":
          return await advancePhase(message, config);

        case "skip":
          return await skipPhase(message, config);

        case "help":
          return await showHelp(message);

        default:
          // Check for backend command
          if (subcommand.startsWith("backend ")) {
            return await setBackend(message, subcommand.replace("backend ", "").trim());
          }
          // Check for output dir command
          if (subcommand.startsWith("output ")) {
            return await setOutputDir(message, subcommand.replace("output ", "").trim());
          }
          // Unknown subcommand but wizard is active — treat as chat
          if (hasActiveSession(userId)) {
            return await handleInterviewMessage(message, config);
          }
          await message.reply(`Unknown wizard command: \`${subcommand}\`. Try \`!wizard help\`.`);
          return { handled: true, responseSent: true };
      }
    }

    // ====== Active session message routing ======
    if (hasActiveSession(userId)) {
      // Check for done/skip phrases
      if (DONE_PHRASES.test(content)) {
        return await advancePhase(message, config);
      }
      if (SKIP_PHRASES.test(content)) {
        return await skipPhase(message, config);
      }

      return await handleInterviewMessage(message, config);
    }

    return { handled: false };
  },

  async onLoad(): Promise<void> {
    const dataDir = join(
      process.env.PAI_DIR || join(process.env.HOME || "", "Projects", "sam"),
      ".agent",
      "skills",
      "discord-remote-control",
      "service",
      "data",
      "wizard"
    );
    initWizardDataDir(dataDir);
    console.log(`[WizardPlugin] Data directory: ${dataDir}`);
  },

  async onUnload(): Promise<void> {
    console.log("[WizardPlugin] Unloaded");
  },
};

// ============================================================================
// Command Handlers
// ============================================================================

async function startWizard(message: Message, config: DiscordConfig): Promise<PluginResult> {
  const userId = message.author.id;

  // Check for existing session
  if (hasActiveSession(userId)) {
    const session = getSession(userId)!;
    await message.reply(
      `You already have an active wizard session (${phaseEmoji(session.phase)} **${phasePersona(session.phase)}** phase).\n` +
      `Use \`!wizard cancel\` to start over, or continue chatting.`
    );
    return { handled: true, responseSent: true };
  }

  // Create new session
  const session = createSession(userId, message.channelId);

  await message.reply(
    `${phaseEmoji("setup")} **Project Planning Wizard Started!**\n\n` +
    `I'll guide you through 4 expert interviews to create your project documents:\n` +
    `1. 🧠 **Carson** (Analyst) → product-brief.md\n` +
    `2. 📊 **Maya** (Product Manager) → PRD.md\n` +
    `3. 🏗️ **Quinn** (Architect) → tech-spec.md\n` +
    `4. 🔒 **Victor** (Security) → BDD.md\n\n` +
    `First, tell me about your project. What's the **name** and a **brief description**?`
  );

  return { handled: true, responseSent: true };
}

async function showStatus(message: Message): Promise<PluginResult> {
  const session = getSession(message.author.id);

  if (!session) {
    await message.reply("No active wizard session. Use `!wizard` to start one.");
    return { handled: true, responseSent: true };
  }

  const phases: Array<[string, WizardPhase, string]> = [
    ["Carson (Analyst)", "analyst_interview", "product-brief.md"],
    ["Maya (Product Manager)", "pm_interview", "PRD.md"],
    ["Quinn (Architect)", "architect_interview", "tech-spec.md"],
    ["Victor (Security)", "security_interview", "BDD.md"],
  ];

  const phaseOrder: WizardPhase[] = [
    "analyst_interview", "analyst_gen",
    "pm_interview", "pm_gen",
    "architect_interview", "architect_gen",
    "security_interview", "security_gen",
    "completed",
  ];

  const currentIdx = phaseOrder.indexOf(session.phase);

  const statusLines = phases.map(([name, phase, doc], i) => {
    const phaseIdx = phaseOrder.indexOf(phase);
    let icon: string;
    if (currentIdx > phaseIdx + 1) icon = "✅";
    else if (session.phase === phase) icon = "▶️";
    else icon = "⬜";
    return `${icon} ${name} → ${doc}`;
  });

  await message.reply(
    `**Wizard Status** — ${session.brief.title || "Unnamed Project"}\n` +
    `Phase: ${phaseEmoji(session.phase)} ${phasePersona(session.phase)}\n\n` +
    statusLines.join("\n") +
    `\n\nBackend: \`${session.backend || "claude"}\` | Output: \`${session.outputDir || "not set"}\``
  );

  return { handled: true, responseSent: true };
}

async function cancelWizard(message: Message): Promise<PluginResult> {
  const userId = message.author.id;

  if (!hasActiveSession(userId)) {
    await message.reply("No active wizard session to cancel.");
    return { handled: true, responseSent: true };
  }

  endSession(userId, "cancelled");
  await message.reply("❌ Wizard session cancelled. Use `!wizard` to start a new one.");
  return { handled: true, responseSent: true };
}

async function showHelp(message: Message): Promise<PluginResult> {
  await message.reply(
    `**Wizard Commands:**\n` +
    `\`!wizard\` — Start a new planning session\n` +
    `\`!wizard status\` — Show current progress\n` +
    `\`!wizard done\` / \`!wizard next\` — Finish current interview, generate doc\n` +
    `\`!wizard skip\` — Skip current phase\n` +
    `\`!wizard cancel\` — Cancel session\n` +
    `\`!wizard backend <claude|ollama|gemini>\` — Switch LLM\n` +
    `\`!wizard output <path>\` — Set output directory\n` +
    `\`!wizard help\` — This message\n\n` +
    `During an interview, just chat naturally. Say "done" or "next" when ready to move on.`
  );
  return { handled: true, responseSent: true };
}

async function setBackend(message: Message, backend: string): Promise<PluginResult> {
  const valid = ["claude", "ollama", "gemini"];
  if (!valid.includes(backend)) {
    await message.reply(`Invalid backend. Choose: ${valid.join(", ")}`);
    return { handled: true, responseSent: true };
  }

  const session = getSession(message.author.id);
  if (!session) {
    await message.reply("No active session. Start one with `!wizard`.");
    return { handled: true, responseSent: true };
  }

  updateSession(message.author.id, { backend });
  await message.reply(`LLM backend switched to **${backend}**.`);
  return { handled: true, responseSent: true };
}

async function setOutputDir(message: Message, dir: string): Promise<PluginResult> {
  const session = getSession(message.author.id);
  if (!session) {
    await message.reply("No active session. Start one with `!wizard`.");
    return { handled: true, responseSent: true };
  }

  updateSession(message.author.id, { outputDir: dir });
  await message.reply(`Output directory set to \`${dir}\`.`);
  return { handled: true, responseSent: true };
}

// ============================================================================
// Interview Message Handling
// ============================================================================

async function handleInterviewMessage(
  message: Message,
  config: DiscordConfig
): Promise<PluginResult> {
  const userId = message.author.id;
  const session = getSession(userId);
  if (!session) return { handled: false };

  const content = message.content.trim();

  // ====== Setup phase: collect project info ======
  if (session.phase === "setup") {
    return await handleSetupMessage(message, session, content);
  }

  // ====== Interview phases: route to persona LLM ======
  if (isInterviewPhase(session.phase)) {
    return await handlePersonaMessage(message, session, content, config);
  }

  // ====== Generation phases: shouldn't receive messages, but handle gracefully ======
  await message.reply(
    `${phaseEmoji(session.phase)} Generating documents... Please wait.`
  );
  return { handled: true, responseSent: true };
}

async function handleSetupMessage(
  message: Message,
  session: WizardSession,
  content: string
): Promise<PluginResult> {
  const userId = message.author.id;

  if (!session.brief.title) {
    // Parse: "ProjectName - description" or just "ProjectName"
    const parts = content.split(/\s*[-–—:]\s*/);
    const title = parts[0].trim();
    const description = parts.slice(1).join(" - ").trim() || "";

    updateSession(userId, {
      brief: { ...session.brief, title, description, projectType: "software", goals: [] },
    });

    if (description) {
      await message.reply(
        `Got it! **${title}** — ${description}\n\n` +
        `What are the main **goals** for this project? (List them, or say "done" to use the description as the goal)`
      );
    } else {
      await message.reply(
        `Project: **${title}**\n\nGive me a brief **description** and **goals** for this project:`
      );
    }
    return { handled: true, responseSent: true };
  }

  if (!session.brief.goals || session.brief.goals.length === 0) {
    if (DONE_PHRASES.test(content)) {
      updateSession(userId, {
        brief: { ...session.brief, goals: [session.brief.description || "Build the project"] },
      });
    } else {
      // Parse goals from comma/newline separated list
      const goals = content
        .split(/[,\n]/)
        .map((g) => g.trim())
        .filter(Boolean);
      updateSession(userId, { brief: { ...session.brief, goals, description: session.brief.description || content } });
    }

    // Transition to analyst interview
    const updated = getSession(userId)!;
    updateSession(userId, { phase: "analyst_interview" });

    const greeting = getInitialGreeting("analyst_interview", updated);

    // Save greeting as assistant message
    appendPhaseMessage(userId, "analyst_interview", {
      id: `msg_${Date.now()}_init`,
      role: "assistant",
      content: greeting,
      timestamp: new Date().toISOString(),
      phase: "analyst_interview",
    });

    await message.reply(
      `${phaseEmoji("analyst_interview")} **Phase 1/4 — Analyst Interview**\n\n${greeting}`
    );
    return { handled: true, responseSent: true };
  }

  // Fallback: transition to first interview
  updateSession(userId, { phase: "analyst_interview" });
  const greeting = getInitialGreeting("analyst_interview", session);
  await message.reply(`${phaseEmoji("analyst_interview")} **Phase 1/4 — Analyst Interview**\n\n${greeting}`);
  return { handled: true, responseSent: true };
}

async function handlePersonaMessage(
  message: Message,
  session: WizardSession,
  content: string,
  config: DiscordConfig
): Promise<PluginResult> {
  const userId = message.author.id;

  // Show typing while LLM processes
  try {
    await message.channel.sendTyping();
  } catch { /* ignore */ }

  // Save user message
  appendPhaseMessage(userId, session.phase, {
    id: `msg_${Date.now()}_user`,
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    phase: session.phase,
  });

  // Build conversation history for LLM
  const history = getPhaseHistory(userId, session.phase);
  const llmMessages = history
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Get persona system prompt
  const systemPrompt = getInterviewSystemPrompt(session);

  // Call LLM
  const response = await callLLM(
    systemPrompt,
    llmMessages,
    (session.backend as "claude" | "ollama" | "gemini") || "claude",
    session.model
  );

  // Save assistant response
  appendPhaseMessage(userId, session.phase, {
    id: `msg_${Date.now()}_assistant`,
    role: "assistant",
    content: response.content,
    timestamp: new Date().toISOString(),
    phase: session.phase,
  });

  // Send response with persona context
  const persona = phasePersona(session.phase);
  const responseText = `**${persona}:** ${response.content}`;

  await sendVoiceResponse(message, responseText, "text", {
    voiceId: "Jessica",
    includeTranscript: false,
  });

  return { handled: true, responseSent: true };
}

// ============================================================================
// Phase Advancement
// ============================================================================

async function advancePhase(message: Message, config: DiscordConfig): Promise<PluginResult> {
  const userId = message.author.id;
  const session = getSession(userId);

  if (!session) {
    await message.reply("No active wizard session.");
    return { handled: true, responseSent: true };
  }

  if (session.phase === "setup") {
    await message.reply("Please provide your project name and description first.");
    return { handled: true, responseSent: true };
  }

  if (!isInterviewPhase(session.phase)) {
    await message.reply("Not currently in an interview phase.");
    return { handled: true, responseSent: true };
  }

  // Move to generation phase
  const genPhase = nextPhase(session.phase);
  await message.reply(
    `${phaseEmoji(genPhase)} Generating document from ${phasePersona(session.phase)} interview... This may take a moment.`
  );

  try {
    await message.channel.sendTyping();
  } catch { /* ignore */ }

  // Summarize interview
  const history = getPhaseHistory(userId, session.phase);
  const summary = summarizeHistory(history);

  // Update session phase to generation
  updateSession(userId, { phase: genPhase });
  const updatedSession = getSession(userId)!;

  // Generate document
  const prompt = getDocGenerationPrompt(genPhase, updatedSession, summary);
  const response = await callLLM(
    prompt,
    [],
    (session.backend as "claude" | "ollama" | "gemini") || "claude",
    session.model
  );

  const docContent = response.content;

  // Save generated document to session
  const docUpdates: Partial<WizardSession> = {};
  switch (genPhase) {
    case "analyst_gen":
      docUpdates.briefContent = docContent;
      break;
    case "pm_gen":
      docUpdates.prdContent = docContent;
      break;
    case "architect_gen":
      docUpdates.techSpecContent = docContent;
      break;
    case "security_gen":
      docUpdates.bddContent = docContent;
      break;
  }

  // Advance to next interview or complete
  const nextInterviewPhase = nextPhase(genPhase);
  docUpdates.phase = nextInterviewPhase;
  updateSession(userId, docUpdates);

  if (nextInterviewPhase === "completed") {
    // All done! Save documents and notify
    await saveDocuments(getSession(userId)!);
    endSession(userId, "completed");

    const phaseNum = "4/4";
    await message.reply(
      `✅ **Wizard Complete!**\n\n` +
      `All documents generated:\n` +
      `- 📄 product-brief.md\n` +
      `- 📄 PRD.md\n` +
      `- 📄 tech-spec.md\n` +
      `- 📄 BDD.md\n\n` +
      (updatedSession.outputDir
        ? `Documents saved to: \`${updatedSession.outputDir}/docs/\``
        : `Set output dir with \`!wizard output <path>\` before completion to auto-save.`)
    );
    return { handled: true, responseSent: true };
  }

  // Start next interview
  const freshSession = getSession(userId)!;
  const greeting = getInitialGreeting(nextInterviewPhase, freshSession);

  appendPhaseMessage(userId, nextInterviewPhase, {
    id: `msg_${Date.now()}_init`,
    role: "assistant",
    content: greeting,
    timestamp: new Date().toISOString(),
    phase: nextInterviewPhase,
  });

  const phaseNumber = {
    analyst_interview: "1/4",
    pm_interview: "2/4",
    architect_interview: "3/4",
    security_interview: "4/4",
  }[nextInterviewPhase] || "";

  await message.reply(
    `✅ Document generated!\n\n` +
    `${phaseEmoji(nextInterviewPhase)} **Phase ${phaseNumber} — ${phasePersona(nextInterviewPhase)} Interview**\n\n${greeting}`
  );

  return { handled: true, responseSent: true };
}

async function skipPhase(message: Message, config: DiscordConfig): Promise<PluginResult> {
  const userId = message.author.id;
  const session = getSession(userId);

  if (!session || !isInterviewPhase(session.phase)) {
    await message.reply("Nothing to skip.");
    return { handled: true, responseSent: true };
  }

  // Skip both interview and generation, go straight to next interview
  const genPhase = nextPhase(session.phase);
  const nextInterviewOrComplete = nextPhase(genPhase);

  updateSession(userId, { phase: nextInterviewOrComplete });

  if (nextInterviewOrComplete === "completed") {
    await saveDocuments(getSession(userId)!);
    endSession(userId, "completed");
    await message.reply("⏭️ Phase skipped. Wizard complete (some documents may be empty).");
    return { handled: true, responseSent: true };
  }

  const freshSession = getSession(userId)!;
  const greeting = getInitialGreeting(nextInterviewOrComplete, freshSession);

  appendPhaseMessage(userId, nextInterviewOrComplete, {
    id: `msg_${Date.now()}_init`,
    role: "assistant",
    content: greeting,
    timestamp: new Date().toISOString(),
    phase: nextInterviewOrComplete,
  });

  await message.reply(
    `⏭️ Phase skipped.\n\n` +
    `${phaseEmoji(nextInterviewOrComplete)} **${phasePersona(nextInterviewOrComplete)} Interview**\n\n${greeting}`
  );

  return { handled: true, responseSent: true };
}

// ============================================================================
// Utilities
// ============================================================================

function summarizeHistory(history: WizardMessage[]): string {
  const userMessages = history.filter((m) => m.role === "user").map((m) => m.content);
  const assistantMessages = history.filter((m) => m.role === "assistant").map((m) => m.content);

  return `## Interview Transcript

**User Inputs:**
${userMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}

**Key Discussion Points:**
${assistantMessages.slice(-3).join("\n\n")}

**Full Conversation (${history.length} messages):**
${history.map((m) => `[${m.role}]: ${m.content}`).join("\n\n")}`;
}

async function saveDocuments(session: WizardSession): Promise<void> {
  if (!session.outputDir) {
    console.log("[WizardPlugin] No output directory set, skipping file save");
    return;
  }

  const docsDir = join(session.outputDir, "docs");
  await mkdir(docsDir, { recursive: true });

  const writes = [
    { file: "product-brief.md", content: session.briefContent },
    { file: "PRD.md", content: session.prdContent },
    { file: "tech-spec.md", content: session.techSpecContent },
    { file: "BDD.md", content: session.bddContent },
  ];

  for (const { file, content } of writes) {
    if (content) {
      await writeFile(join(docsDir, file), content, "utf-8");
      console.log(`[WizardPlugin] Wrote ${join(docsDir, file)}`);
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default wizardPlugin;

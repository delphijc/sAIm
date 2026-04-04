/**
 * LLM Client for Wizard Plugin
 *
 * Multi-backend support: ollama, gemini, claude
 * Adapted from standalone-wizard's llm_client.ts for Discord plugin use.
 */

import { join } from "path";
import { existsSync, readFileSync } from "fs";
import type { WizardSession, WizardPhase } from "./session.ts";

// ============================================================================
// Configuration
// ============================================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

function loadApiKeys(): void {
  const envFiles = [
    join(process.env.HOME || "", ".claude", ".env"),
    join(process.env.PAI_DIR || "", ".env"),
  ];

  for (const p of envFiles) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, "utf-8");
        for (const line of content.split("\n")) {
          const match = line.match(/^([^#=][^=]*)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const val = match[2].trim().replace(/^["']|["']$/g, "");
            if (!process.env[key]) process.env[key] = val;
          }
        }
      } catch { /* ignore */ }
    }
  }
}

loadApiKeys();

// ============================================================================
// Types
// ============================================================================

interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

interface LLMResponse {
  content: string;
  thinking?: string;
}

type BackendType = "ollama" | "gemini" | "claude";

// ============================================================================
// Backend implementations
// ============================================================================

async function callOllama(
  systemPrompt: string,
  messages: LLMMessage[],
  model: string
): Promise<LLMResponse> {
  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
      options: { temperature: 0.7, num_predict: 4096 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return { content: data.message?.content || "" };
}

async function callGemini(
  systemPrompt: string,
  messages: LLMMessage[],
  model: string
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      system_instruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
}

async function callClaude(
  systemPrompt: string,
  messages: LLMMessage[],
  model: string
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return { content: data.content?.[0]?.text || "" };
}

// ============================================================================
// Dispatcher
// ============================================================================

export async function callLLM(
  systemPrompt: string,
  messages: LLMMessage[],
  backend: BackendType = "claude",
  model?: string
): Promise<LLMResponse> {
  const resolvedModel = model || (backend === "claude" ? "claude-sonnet-4-20250514" : "qwen2.5-coder:14b");

  console.log(`[WizardLLM] Calling ${backend} (${resolvedModel}) with ${messages.length} messages`);

  try {
    switch (backend) {
      case "gemini":
        return await callGemini(systemPrompt, messages, resolvedModel);
      case "claude":
        return await callClaude(systemPrompt, messages, resolvedModel);
      case "ollama":
      default:
        return await callOllama(systemPrompt, messages, resolvedModel);
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[WizardLLM] ${backend} call failed: ${errMsg}`);
    return { content: `Error connecting to ${backend}: ${errMsg}. Please try again.` };
  }
}

// ============================================================================
// Persona System Prompts
// ============================================================================

const PERSONAS = {
  analyst: {
    name: "Carson",
    role: "Reflective Coach & Brainstormer",
    skills: [
      "Facilitate brainstorming using structured methodologies",
      "Help users articulate fuzzy ideas into clear problem statements",
      "Identify stakeholders, constraints, and success criteria",
      "Explore risks and opportunities from multiple perspectives",
    ],
    goal: `Help the user refine their core concept. Understand:
1. The core problem or opportunity
2. Who experiences this problem
3. What success looks like
4. Key constraints
5. Risks or concerns`,
    output: "Project Brief (product-brief.md)",
  },
  product_manager: {
    name: "Maya",
    role: "Scale-Adaptive Planner",
    skills: [
      "Convert project briefs into structured requirements",
      "Define user personas and their needs",
      "Prioritize features for MVP vs future phases",
      "Establish measurable success metrics",
    ],
    goal: `Define product scope and requirements. Understand:
1. Primary users and their specific needs
2. Must-have features for MVP
3. Nice-to-have features for future phases
4. Success metrics
5. Dependencies and risks`,
    output: "Product Requirements Document (PRD.md)",
  },
  architect: {
    name: "Quinn",
    role: "Technical Blueprint Designer",
    skills: [
      "Design system architecture patterns",
      "Select appropriate technology stacks",
      "Define API contracts and data models",
      "Plan for scalability and performance",
    ],
    goal: `Design the technical architecture. Understand:
1. Technology stack preferences and constraints
2. System architecture patterns
3. Integration requirements
4. Data storage needs
5. Deployment preferences`,
    output: "Technical Specification (tech-spec.md)",
  },
  security: {
    name: "Victor",
    role: "Enterprise Security Designer",
    skills: [
      "Perform threat modeling using STRIDE",
      "Design authentication and authorization controls",
      "Identify compliance requirements",
      "Create BDD security test stories",
    ],
    goal: `Identify security requirements. Understand:
1. Data sensitivity
2. Auth requirements
3. Compliance frameworks
4. Threat model
5. Security controls needed`,
    output: "Security BDD Stories (BDD.md)",
  },
};

type PersonaKey = keyof typeof PERSONAS;

function phaseToPersona(phase: WizardPhase): PersonaKey {
  switch (phase) {
    case "analyst_interview": return "analyst";
    case "pm_interview": return "product_manager";
    case "architect_interview": return "architect";
    case "security_interview": return "security";
    default: return "analyst";
  }
}

export function getInterviewSystemPrompt(session: WizardSession): string {
  const personaKey = phaseToPersona(session.phase);
  const persona = PERSONAS[personaKey];
  const projectTitle = session.brief.title || "the project";
  const projectDesc = session.brief.description || "";
  const projectGoals = session.brief.goals?.join(", ") || "";

  let previousContext = "";

  if (personaKey === "product_manager" && session.briefContent) {
    previousContext = `\nCONTEXT FROM PREVIOUS PHASE (Carson's Analysis):\n${session.briefContent.substring(0, 2000)}`;
  } else if (personaKey === "architect") {
    if (session.briefContent) previousContext += `\n--- Project Brief ---\n${session.briefContent.substring(0, 1500)}`;
    if (session.prdContent) previousContext += `\n--- PRD ---\n${session.prdContent.substring(0, 1500)}`;
  } else if (personaKey === "security") {
    if (session.briefContent) previousContext += `\n--- Project Brief ---\n${session.briefContent.substring(0, 1000)}`;
    if (session.prdContent) previousContext += `\n--- PRD ---\n${session.prdContent.substring(0, 1000)}`;
    if (session.techSpecContent) previousContext += `\n--- Tech Spec ---\n${session.techSpecContent.substring(0, 1000)}`;
  }

  return `You are conducting an interview as part of a software development planning workflow via Discord chat.

PROJECT CONTEXT:
- Title: ${projectTitle}
${projectDesc ? `- Description: ${projectDesc}` : ""}
${projectGoals ? `- Goals: ${projectGoals}` : ""}

PERSONA: ${persona.name}, the ${persona.role}

YOUR EXPERTISE:
${persona.skills.map((s) => `- ${s}`).join("\n")}

YOUR GOAL:
${persona.goal}

OUTPUT: Your interview will inform: ${persona.output}
${previousContext ? `\nPREVIOUS PHASE CONTEXT:${previousContext}` : ""}

INTERVIEW GUIDELINES:
- Keep responses concise (2-4 sentences) — this is Discord chat, not a document
- Ask ONE focused question at a time
- Build on their answers to go deeper
- Be friendly and encouraging
- When you've gathered enough info, say "I think I have everything I need" and provide a brief summary
- If the user says "done", "next", "skip", or "move on", wrap up with a summary`;
}

export function getDocGenerationPrompt(
  phase: WizardPhase,
  session: WizardSession,
  interviewSummary: string
): string {
  const projectTitle = session.brief.title || "the project";

  switch (phase) {
    case "analyst_gen":
      return `Based on the following interview, create a Project Brief for "${projectTitle}".

INTERVIEW:
${interviewSummary}

Generate markdown with: Executive Summary, Problem Statement, Target Users, Proposed Solution, Key Insights, Constraints & Requirements, Next Steps.
Be specific — use actual content from the interview.`;

    case "pm_gen":
      return `Based on the interview and project brief, create a PRD for "${projectTitle}".

BRIEF:
${session.briefContent?.substring(0, 1500) || ""}

INTERVIEW:
${interviewSummary}

Generate markdown with: Executive Summary, Goals (measurable), User Personas, User Stories/Epics, Functional Requirements, Non-Functional Requirements, Out of Scope, Risks.`;

    case "architect_gen":
      return `Create a Technical Specification for "${projectTitle}".

BRIEF: ${session.briefContent?.substring(0, 1000) || ""}
PRD: ${session.prdContent?.substring(0, 1000) || ""}

INTERVIEW:
${interviewSummary}

Generate markdown with: Overview, Technology Stack, System Architecture, Data Architecture, API Design, Security Architecture, Deployment Strategy, Coding Standards.`;

    case "security_gen":
      return `Create Security BDD Stories for "${projectTitle}".

BRIEF: ${session.briefContent?.substring(0, 800) || ""}
PRD: ${session.prdContent?.substring(0, 800) || ""}
TECH SPEC: ${session.techSpecContent?.substring(0, 800) || ""}

INTERVIEW:
${interviewSummary}

Generate markdown with: Security Requirements Summary, Threat Model (STRIDE), Compliance Mapping, BDD Security Stories (Auth, Data Protection, App Security, Network Security, Monitoring).`;

    default:
      return `Summarize the following interview:\n${interviewSummary}`;
  }
}

export function getInitialGreeting(phase: WizardPhase, session: WizardSession): string {
  const title = session.brief.title || "your project";

  switch (phase) {
    case "analyst_interview":
      return `Hey! I'm **Carson**, your Analyst. I'm here to help brainstorm and refine the core concept for **${title}**.\n\nWhat's the main challenge or opportunity that inspired this project?`;

    case "pm_interview":
      return `Hello! I'm **Maya**, the Product Manager. I've reviewed the project brief for **${title}**.\n\nNow let's define scope and requirements. Who are the primary users you're building for, and what problems will it solve for them?`;

    case "architect_interview":
      return `Hi! I'm **Quinn**, the Technical Architect. I've reviewed the brief and PRD for **${title}**.\n\nLet's design the technical foundation. What technology stack are you considering, and are there any technical constraints I should know about?`;

    case "security_interview":
      return `Hello! I'm **Victor**, the Security Architect. I've reviewed all previous documents for **${title}**.\n\nLet's make sure it's built securely. Are there specific compliance frameworks (HIPAA, SOC2, PCI-DSS) or security concerns we need to address?`;

    default:
      return `Let's continue working on **${title}**.`;
  }
}

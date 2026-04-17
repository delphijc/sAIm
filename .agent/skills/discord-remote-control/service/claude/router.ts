/**
 * Claude Router - Backend selection for AI invocation
 *
 * Reads environment variables to choose which backend to use:
 *   - PAI_USE_JAY_GENTIC=true: jay-gentic (Ollama-backed local CLI)
 *   - PAI_USE_SKILLS_API=true: Skills API via @anthropic-ai/sdk
 *   - Default (unset or "false"): Claude Code subprocess (existing behavior, no API key needed)
 *
 * Falls back to Claude Code subprocess if the selected backend fails.
 */

import { callClaudeSubprocess } from "./subprocess.ts";
import { callSkillsAPI } from "./api.ts";
import { callJayGenticSubprocess } from "./jg-subprocess.ts";
import type { SubprocessRequest, SubprocessResponse } from "./subprocess.ts";

/**
 * Determine which backend is enabled
 */
function isJayGenticEnabled(): boolean {
  return process.env.PAI_USE_JAY_GENTIC === "true";
}

function isSkillsApiEnabled(): boolean {
  return process.env.PAI_USE_SKILLS_API === "true";
}

/**
 * Route the AI invocation to the appropriate backend.
 *
 * Priority order:
 * 1. jay-gentic (if PAI_USE_JAY_GENTIC=true)
 * 2. Skills API (if PAI_USE_SKILLS_API=true)
 * 3. Claude Code subprocess (default)
 *
 * Falls back to Claude Code subprocess on failure.
 */
export async function callClaude(
  request: SubprocessRequest
): Promise<SubprocessResponse> {
  // Try jay-gentic first if enabled
  if (isJayGenticEnabled()) {
    console.log(`[JayGentic] Using jay-gentic backend for session ${request.sessionId}`);
    const jayGenticResult = await callJayGenticSubprocess(request);

    if (jayGenticResult.success) {
      return jayGenticResult;
    }

    console.warn(
      `[JayGentic] Failed (${jayGenticResult.error}), falling back to Claude subprocess`
    );
    return callClaudeSubprocess(request);
  }

  // Try Skills API next if enabled
  if (isSkillsApiEnabled()) {
    console.log(`[Claude Router] Using Skills API backend for session ${request.sessionId}`);
    const apiResult = await callSkillsAPI(request);

    if (!apiResult.success) {
      console.warn(
        `[Claude Router] Skills API failed (${apiResult.error}), falling back to subprocess`
      );
      return callClaudeSubprocess(request);
    }

    return apiResult;
  }

  // Default: Claude Code subprocess
  return callClaudeSubprocess(request);
}

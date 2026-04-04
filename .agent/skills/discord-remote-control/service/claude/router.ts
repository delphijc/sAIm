/**
 * Claude Router - Backend selection for Claude invocation
 *
 * Reads PAI_USE_SKILLS_API environment variable to choose which backend to use:
 *   - Default (unset or "false"): subprocess (existing behavior, no API key needed)
 *   - PAI_USE_SKILLS_API=true: Skills API via @anthropic-ai/sdk
 *
 * Falls back to subprocess if the Skills API call fails.
 */

import { callClaudeSubprocess } from "./subprocess.ts";
import { callSkillsAPI } from "./api.ts";
import type { SubprocessRequest, SubprocessResponse } from "./subprocess.ts";

/**
 * Determine whether the Skills API backend is enabled
 */
function isSkillsApiEnabled(): boolean {
  return process.env.PAI_USE_SKILLS_API === "true";
}

/**
 * Route the Claude invocation to the appropriate backend.
 *
 * When Skills API is enabled:
 *   1. Attempts callSkillsAPI
 *   2. On failure, logs a warning and falls back to callClaudeSubprocess
 *
 * When Skills API is disabled (default):
 *   - Calls callClaudeSubprocess directly
 */
export async function callClaude(
  request: SubprocessRequest
): Promise<SubprocessResponse> {
  if (!isSkillsApiEnabled()) {
    return callClaudeSubprocess(request);
  }

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

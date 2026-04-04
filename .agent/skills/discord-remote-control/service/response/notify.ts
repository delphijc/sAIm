/**
 * Voice Server Notification - Audible Feedback
 * Calls the local voice server (localhost:8888) to provide audible TTS feedback
 * after Discord responses are sent.
 *
 * Previously the Claude subprocess did this via curl, but --disallowedTools Bash
 * blocks that path. Moving it to the service layer is more reliable anyway.
 */

const VOICE_SERVER_URL = "http://localhost:8888/notify";

/**
 * Notify the local voice server for audible feedback (fire-and-forget).
 * Summarizes the response to a short phrase for TTS.
 */
export async function notifyVoiceServer(responseText: string): Promise<void> {
  const summary = responseText.length > 200
    ? responseText.substring(0, 200).replace(/\n/g, " ").trim() + "..."
    : responseText.replace(/\n/g, " ").trim();

  const res = await fetch(VOICE_SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: summary, voice_enabled: true }),
  });

  if (!res.ok) {
    throw new Error(`Voice server returned ${res.status}`);
  }
}

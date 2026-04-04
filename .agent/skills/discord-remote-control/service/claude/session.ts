/**
 * Claude Session Manager - Phase 4
 * Manages session state and maps Discord conversations to Claude subprocess sessions
 */

interface SessionState {
  sessionId: string;
  discordUserId: string;
  discordChannelId: string;
  createdAt: number;
  lastAccessedAt: number;
  messageCount: number;
  isActive: boolean;
}

// In-memory session store (tracks active Discord sessions)
const sessionMap = new Map<string, SessionState>();

/**
 * Generate session key from Discord IDs
 * Format: userId:channelId (or userId:dm for DMs)
 */
export function getSessionKey(
  userId: string,
  channelId: string,
  isDM: boolean = false
): string {
  return `${userId}:${isDM ? "dm" : channelId}`;
}

/**
 * Get or create a session
 */
export function getOrCreateSession(
  sessionKey: string,
  userId: string,
  channelId: string
): SessionState {
  let session = sessionMap.get(sessionKey);

  if (!session) {
    session = {
      sessionId: sessionKey,
      discordUserId: userId,
      discordChannelId: channelId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      messageCount: 0,
      isActive: true,
    };

    sessionMap.set(sessionKey, session);
    console.log(`🔑 Created new session: ${sessionKey}`);
  } else {
    // Update last accessed
    session.lastAccessedAt = Date.now();
  }

  return session;
}

/**
 * Increment message count for a session
 */
export function incrementMessageCount(sessionKey: string): number {
  const session = sessionMap.get(sessionKey);
  if (!session) {
    return 0;
  }

  session.messageCount++;
  session.lastAccessedAt = Date.now();
  return session.messageCount;
}

/**
 * Get session state
 */
export function getSession(sessionKey: string): SessionState | undefined {
  return sessionMap.get(sessionKey);
}

/**
 * List all active sessions
 */
export function listActiveSessions(): SessionState[] {
  return Array.from(sessionMap.values()).filter((s) => s.isActive);
}

/**
 * Get session statistics
 */
export function getSessionStats(sessionKey: string): {
  messageCount: number;
  duration: number; // milliseconds
  isActive: boolean;
} | null {
  const session = sessionMap.get(sessionKey);
  if (!session) return null;

  return {
    messageCount: session.messageCount,
    duration: Date.now() - session.createdAt,
    isActive: session.isActive,
  };
}

/**
 * Clear old sessions (inactive for >24 hours)
 */
export function clearOldSessions(maxAgeMsecs: number = 24 * 60 * 60 * 1000): number {
  const cutoffTime = Date.now() - maxAgeMsecs;
  let clearedCount = 0;

  for (const [key, session] of sessionMap.entries()) {
    if (session.lastAccessedAt < cutoffTime) {
      sessionMap.delete(key);
      clearedCount++;
    }
  }

  if (clearedCount > 0) {
    console.log(`🧹 Cleared ${clearedCount} old sessions`);
  }

  return clearedCount;
}

/**
 * Close a session explicitly
 */
export function closeSession(sessionKey: string): boolean {
  const session = sessionMap.get(sessionKey);
  if (!session) return false;

  session.isActive = false;
  console.log(`❌ Closed session: ${sessionKey}`);
  return true;
}

/**
 * Get total active session count
 */
export function getActiveSessionCount(): number {
  return Array.from(sessionMap.values()).filter((s) => s.isActive).length;
}

/**
 * Start periodic session cleanup timer
 * Cleans up sessions inactive for >24 hours every hour
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startSessionCleanupTimer(
  intervalMs: number = 60 * 60 * 1000 // 1 hour
): void {
  if (cleanupInterval) return; // Already running
  cleanupInterval = setInterval(() => {
    clearOldSessions();
  }, intervalMs);
  console.log("Session cleanup timer started (1h interval)");
}

export function stopSessionCleanupTimer(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

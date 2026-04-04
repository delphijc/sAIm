#!/usr/bin/env bun

import { execSync } from 'child_process';

export interface NotificationConfig {
  message: string;
  title?: string;
  voiceId?: string;
  voiceName?: string;
  rate?: number;
  agentType?: string;
}

export interface NotificationResult {
  success: boolean;
  method: 'voice' | 'system' | 'none';
  message: string;
}

/**
 * Check if voice server is running
 */
export async function isVoiceServerRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8888/health', {
      signal: AbortSignal.timeout(500)
    });
    return response.ok;
  } catch (e) {
    // Silent failure - fallback logic handles it
    return false;
  }
}

/**
 * Send macOS system notification
 */
export function sendSystemNotification(title: string, message: string): boolean {
  try {
    // Use proper AppleScript syntax with quoted form
    // This avoids issues with special characters
    const script = `
      display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"
    `.trim();

    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      stdio: 'pipe',
      timeout: 2000
    });

    return true;
  } catch (e) {
    console.error(`⚠️ Failed to send system notification: ${e}`);
    return false;
  }
}

/**
 * Send voice notification to voice server
 */
export async function sendVoiceNotification(config: NotificationConfig): Promise<boolean> {
  try {
    const payload = {
      title: config.title || 'Notification',
      message: config.message,
      voice_enabled: true,
      voice_id: config.voiceId,
      voice_name: config.voiceName,
      rate: config.rate,
      agent_type: config.agentType,
      // IMPORTANT: Suppress system notification from voice server since our handler
      // manages the fallback logic (we'll show system notifications only if server is down)
      suppress_system_notification: true
    };

    const response = await fetch('http://localhost:8888/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1000)
    });

    return response.ok;
  } catch (e) {
    // Silent failure - fallback logic handles it
    return false;
  }
}

/**
 * Intelligent notification handler with fallback
 *
 * Priority:
 * 1. If voice server running → send voice notification
 * 2. If voice server NOT running → send system notification
 * 3. If both fail → silent fallback (logged to stderr only for debugging)
 */
export async function sendNotification(config: NotificationConfig): Promise<NotificationResult> {
  const voiceServerRunning = await isVoiceServerRunning();

  if (voiceServerRunning) {
    // Voice server is available - use voice notification
    const success = await sendVoiceNotification(config);

    if (success) {
      console.error(`🔊 Voice: ${config.message}`);
      return {
        success: true,
        method: 'voice',
        message: `Voice: ${config.message}`
      };
    } else {
      // Voice server available but request failed - try system notification as fallback
      const systemSuccess = sendSystemNotification(
        config.title || 'Notification',
        config.message
      );

      if (systemSuccess) {
        console.error(`📢 System: ${config.message}`);
        return {
          success: true,
          method: 'system',
          message: `System: ${config.message}`
        };
      } else {
        console.error(`⚠️ Failed to send notification: ${config.message}`);
        return {
          success: false,
          method: 'none',
          message: `Failed: ${config.message}`
        };
      }
    }
  } else {
    // Voice server is not running - use system notification
    const success = sendSystemNotification(
      config.title || 'Notification',
      config.message
    );

    if (success) {
      console.error(`📢 System: ${config.message}`);
      return {
        success: true,
        method: 'system',
        message: `System: ${config.message}`
      };
    } else {
      console.error(`⚠️ Failed to send notification: ${config.message}`);
      return {
        success: false,
        method: 'none',
        message: `Failed: ${config.message}`
      };
    }
  }
}

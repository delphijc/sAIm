/**
 * Voice Message Queue - Sequential Playback
 * Ensures voice messages play one at a time instead of overlapping
 *
 * How it works:
 * 1. Each message is queued with estimated duration
 * 2. First message plays immediately
 * 3. Subsequent messages wait for current playback to finish
 * 4. Uses estimated TTS duration to calculate wait time
 */

interface QueuedMessage {
  id: string;
  message: string;
  estimatedDuration: number; // in ms
  timestamp: number;
}

interface VoiceQueueConfig {
  voiceServerUrl: string;
  durationMultiplier: number; // Factor to adjust duration (default 1.0)
  debugLogging: boolean;
}

export class VoiceMessageQueue {
  private queue: QueuedMessage[] = [];
  private isPlaying = false;
  private currentMessageId: string | null = null;
  private config: VoiceQueueConfig;

  constructor(config?: Partial<VoiceQueueConfig>) {
    this.config = {
      voiceServerUrl: config?.voiceServerUrl || "http://localhost:8888/notify",
      durationMultiplier: config?.durationMultiplier || 1.0,
      debugLogging: config?.debugLogging || false,
    };
  }

  /**
   * Estimate TTS duration based on text length
   * Typical speech rate: 150 words per minute = 2.5 words/second
   * Average word length: 5 characters
   */
  private estimateDuration(text: string): number {
    const wordCount = text.split(/\s+/).length;
    const wordsPerSecond = 2.5;
    const secondsNeeded = wordCount / wordsPerSecond;
    const milliseconds = secondsNeeded * 1000;

    // Add buffer for synthesis time (typically 0.5-2 seconds)
    const withBuffer = milliseconds + 1000;

    // Apply multiplier for margin of safety
    return Math.ceil(withBuffer * this.config.durationMultiplier);
  }

  /**
   * Enqueue a voice notification for sequential playback
   */
  async enqueue(message: string, messageId?: string): Promise<void> {
    const id = messageId || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = this.estimateDuration(message);

    const queued: QueuedMessage = {
      id,
      message,
      estimatedDuration: duration,
      timestamp: Date.now(),
    };

    this.queue.push(queued);

    if (this.config.debugLogging) {
      console.log(
        `📨 Queued voice message (${this.queue.length} in queue, estimated ${duration}ms)`
      );
    }

    // If not currently playing, start processing
    if (!this.isPlaying) {
      this.processQueue().catch((err) =>
        console.error("Voice queue processing error:", err)
      );
    }
  }

  /**
   * Process queue sequentially
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      this.isPlaying = true;
      const message = this.queue.shift()!;
      this.currentMessageId = message.id;

      try {
        if (this.config.debugLogging) {
          console.log(`🔊 Sending voice message to server...`);
        }

        // Send to voice server
        await this.sendToVoiceServer(message.message);

        if (this.config.debugLogging) {
          console.log(
            `⏳ Waiting ${message.estimatedDuration}ms for playback to finish...`
          );
        }

        // Wait for estimated playback duration
        await this.sleep(message.estimatedDuration);

        if (this.config.debugLogging) {
          console.log(`✅ Playback complete for message ${message.id}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process voice message ${message.id}:`, error);
        // Continue with next message instead of blocking queue
      }

      this.currentMessageId = null;
    }

    this.isPlaying = false;
  }

  /**
   * Send message to voice server
   */
  private async sendToVoiceServer(responseText: string): Promise<void> {
    const summary = responseText.length > 200
      ? responseText.substring(0, 200).replace(/\n/g, " ").trim() + "..."
      : responseText.replace(/\n/g, " ").trim();

    const res = await fetch(this.config.voiceServerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: summary, voice_enabled: true }),
    });

    if (!res.ok) {
      throw new Error(`Voice server returned ${res.status}`);
    }
  }

  /**
   * Simple sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getStatus(): {
    isPlaying: boolean;
    queueLength: number;
    currentMessageId: string | null;
  } {
    return {
      isPlaying: this.isPlaying,
      queueLength: this.queue.length,
      currentMessageId: this.currentMessageId,
    };
  }

  /**
   * Clear the queue (useful for testing or emergency stops)
   */
  clear(): void {
    this.queue = [];
    if (this.config.debugLogging) {
      console.log("🗑️  Voice queue cleared");
    }
  }
}

// Global singleton instance
let globalQueue: VoiceMessageQueue | null = null;

/**
 * Get or create the global voice queue instance
 */
export function getVoiceQueue(config?: Partial<VoiceQueueConfig>): VoiceMessageQueue {
  if (!globalQueue) {
    globalQueue = new VoiceMessageQueue(config);
  }
  return globalQueue;
}

/**
 * Enqueue a voice notification using the global queue
 * This is the main API for the rest of the service to use
 */
export async function enqueueVoiceNotification(
  message: string,
  messageId?: string
): Promise<void> {
  const queue = getVoiceQueue();
  await queue.enqueue(message, messageId);
}

/**
 * Get the current queue status
 */
export function getVoiceQueueStatus() {
  const queue = getVoiceQueue();
  return queue.getStatus();
}

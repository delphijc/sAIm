#!/usr/bin/env bun

/**
 * Voice Server Health Check Hook
 *
 * Triggered at session start to verify voice server is running
 * and ready to accept notifications. If voice server is not ready,
 * logs a warning so user knows notifications will fall back to system.
 */

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'timeout';
  port: number;
  provider?: string;
  message: string;
}

async function checkVoiceServer(): Promise<HealthCheckResult> {
  try {
    const response = await fetch('http://localhost:8888/health', {
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    });

    if (response.ok) {
      try {
        const data = await response.json();
        return {
          status: 'healthy',
          port: 8888,
          provider: data.primary_provider || 'unknown',
          message: `✅ Voice server healthy (${data.primary_provider || 'chatterbox'})`
        };
      } catch {
        return {
          status: 'healthy',
          port: 8888,
          message: '✅ Voice server responding (health check OK)'
        };
      }
    } else {
      return {
        status: 'unhealthy',
        port: 8888,
        message: `⚠️ Voice server returned status ${response.status}`
      };
    }
  } catch (error) {
    const errorMsg = String(error);
    if (errorMsg.includes('timeout') || errorMsg.includes('TimeoutError')) {
      return {
        status: 'timeout',
        port: 8888,
        message: '⚠️ Voice server health check timeout (1000ms)'
      };
    } else if (errorMsg.includes('ECONNREFUSED')) {
      return {
        status: 'unhealthy',
        port: 8888,
        message: '⚠️ Voice server not running on port 8888'
      };
    } else {
      return {
        status: 'unhealthy',
        port: 8888,
        message: `⚠️ Voice server unreachable: ${error}`
      };
    }
  }
}

async function main() {
  console.error('\n🔊 Checking voice server status...');

  const result = await checkVoiceServer();

  console.error(`   ${result.message}`);

  if (result.status === 'healthy') {
    console.error(`   Notifications will use voice with fallback to system notifications`);
  } else {
    console.error(`\n   ⚠️  FALLBACK: Notifications will use macOS system notifications`);
    console.error(`   To enable voice notifications, start the voice server:`);
    console.error(`   ~/.claude/voice-server/start.sh`);
  }

  console.error('');

  process.exit(0);
}

main().catch((error) => {
  console.error(`❌ Health check error: ${error}`);
  process.exit(0);
});

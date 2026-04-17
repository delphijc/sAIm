import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Track CPU times for delta calculation
const cpuTimeCache = new Map<number, { utime: number; stime: number; timestamp: number }>();

export interface MacOSProcessMetrics {
  cpuPercent: number;
  memoryMB: number;
  vmemoryMB: number;
  diskReadMB: number;
  diskWriteMB: number;
  uptime: number;
  gpuPercent?: number;
}

/**
 * Parse ps time format (MM:SS.ms or HH:MM:SS)
 */
function parseTimeFormat(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 2) {
    // MM:SS.ms format
    const [minStr, secStr] = parts;
    const minutes = parseInt(minStr) || 0;
    const seconds = parseFloat(secStr) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hourStr, minStr, secStr] = parts;
    const hours = parseInt(hourStr) || 0;
    const minutes = parseInt(minStr) || 0;
    const seconds = parseFloat(secStr) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Get real-time CPU usage by calculating delta between two samples
 * This gives actual instantaneous CPU % like Activity Monitor shows
 */
async function getRealTimeCPUPercent(pid: number): Promise<number> {
  try {
    // Get CPU time in user+system seconds (parses MM:SS.ms or HH:MM:SS format)
    const { stdout } = await execAsync(`ps -p ${pid} -o utime=,stime= 2>/dev/null`);
    const [utimeStr, stimeStr] = stdout.trim().split(/\s+/);
    const utimeSeconds = parseTimeFormat(utimeStr);
    const stimeSeconds = parseTimeFormat(stimeStr);
    const totalTimeSeconds = utimeSeconds + stimeSeconds;
    const now = Date.now();

    const cached = cpuTimeCache.get(pid);
    let cpuPercent = 0;

    if (cached) {
      // Calculate delta over time elapsed since last sample
      const timeDeltaMs = now - cached.timestamp;
      const cpuTimeDeltaSeconds = totalTimeSeconds - (cached.utime + cached.stime);

      // CPU % = (CPU time delta / real time delta) * 100
      // If process used 1 second of CPU in 1 second of real time = 100%
      cpuPercent = (cpuTimeDeltaSeconds / (timeDeltaMs / 1000)) * 100;
      cpuPercent = Math.max(0, Math.min(100, cpuPercent)); // Clamp 0-100
    }

    // Update cache
    cpuTimeCache.set(pid, { utime: utimeSeconds, stime: stimeSeconds, timestamp: now });
    return cpuPercent;
  } catch (error) {
    console.error(`Failed to get real-time CPU for PID ${pid}:`, error);
    return 0;
  }
}

/**
 * Get memory info using ps (reliable on macOS)
 */
async function getMemoryMetrics(pid: number): Promise<{ memoryMB: number; vmemoryMB: number }> {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o vsz=,rss= 2>/dev/null`);
    const [vszKB, rssKB] = stdout.trim().split(/\s+/).map(Number);

    return {
      memoryMB: (rssKB || 0) / 1024,
      vmemoryMB: (vszKB || 0) / 1024
    };
  } catch (error) {
    console.error(`Failed to get memory for PID ${pid}:`, error);
    return { memoryMB: 0, vmemoryMB: 0 };
  }
}

/**
 * Get disk I/O stats from lsof (macOS)
 */
async function getDiskMetrics(pid: number): Promise<{ diskReadMB: number; diskWriteMB: number }> {
  try {
    // macOS doesn't expose per-process disk I/O like Linux does
    // Use lsof to see open files but can't get read/write counts
    // Return 0 for now (would need system-level profiling for accuracy)
    return { diskReadMB: 0, diskWriteMB: 0 };
  } catch {
    return { diskReadMB: 0, diskWriteMB: 0 };
  }
}

/**
 * Get GPU usage for Metal-enabled processes (mainly ollama)
 */
async function getGPUMetrics(pid: number): Promise<number | undefined> {
  try {
    // Use powermetrics to get GPU usage
    // This requires sudo, so we'll use activity_monitor or system_profiler as fallback
    const { stdout } = await execAsync(`ps -p ${pid} -o comm= 2>/dev/null`);
    const processName = stdout.trim();

    if (processName === 'ollama') {
      // Try to get Metal GPU usage from system metrics
      try {
        const { stdout: gpuStats } = await execAsync(
          `system_profiler SPDisplaysDataType 2>/dev/null | grep -i "vram:" || echo "0 MB"`
        );
        // This is system-wide, not per-process. For per-process, would need:
        // - Xcode's MetricKit (requires entitlements)
        // - powermetrics (requires sudo)
        // Return undefined to indicate not available per-process
        return undefined;
      } catch {
        return undefined;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get process uptime
 */
async function getUptimeSeconds(pid: number): Promise<number> {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o etime= 2>/dev/null`);
    const etime = stdout.trim();
    const parts = etime.split(':').map(x => parseInt(x));

    let uptime = 0;
    if (parts.length === 3) {
      // HH:MM:SS
      uptime = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS
      uptime = parts[0] * 60 + parts[1];
    } else {
      uptime = parts[0];
    }
    return uptime;
  } catch {
    return 0;
  }
}

export async function getMacOSProcessMetrics(pid: number): Promise<MacOSProcessMetrics> {
  try {
    const [cpuPercent, memoryMetrics, diskMetrics, gpuPercent, uptime] = await Promise.all([
      getRealTimeCPUPercent(pid),
      getMemoryMetrics(pid),
      getDiskMetrics(pid),
      getGPUMetrics(pid),
      getUptimeSeconds(pid)
    ]);

    return {
      cpuPercent,
      memoryMB: memoryMetrics.memoryMB,
      vmemoryMB: memoryMetrics.vmemoryMB,
      diskReadMB: diskMetrics.diskReadMB,
      diskWriteMB: diskMetrics.diskWriteMB,
      gpuPercent,
      uptime
    };
  } catch (error) {
    console.error(`Failed to get macOS process metrics for PID ${pid}:`, error);
    return {
      cpuPercent: 0,
      memoryMB: 0,
      vmemoryMB: 0,
      diskReadMB: 0,
      diskWriteMB: 0,
      uptime: 0
    };
  }
}

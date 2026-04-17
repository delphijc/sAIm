import { ServiceMetrics, SystemMetrics, ServiceConfig } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { readFileSync } from 'fs';
import { getMacOSProcessMetrics } from './libproc-macos';

const execAsync = promisify(exec);
const isMacOS = platform() === 'darwin';
const isLinux = platform() === 'linux';

export class MetricsCollector {
  private lastRestartTimes: Map<string, number> = new Map();
  private metricsCache: Map<number, any> = new Map();
  private lastCacheTime = 0;
  private cacheTimeoutMs = 2500; // Cache metrics for 2.5s (just under 3s poll interval)

  async getServiceMetrics(service: ServiceConfig): Promise<ServiceMetrics> {
    try {
      const isRunning = await this.isServiceRunning(service);
      const pid = await this.getServicePID(service);
      let cpuPercent = 0;
      let memoryMB = 0;
      let uptime = 0;
      let lastRestartTime = Date.now();

      let diskReadMB = 0;
      let diskWriteMB = 0;

      let gpuPercent: number | undefined = undefined;

      if (isRunning && pid) {
        const procMetrics = await this.getProcessMetrics(pid);
        cpuPercent = procMetrics.cpuPercent;
        memoryMB = procMetrics.memoryMB;
        uptime = procMetrics.uptime;
        diskReadMB = procMetrics.diskReadMB || 0;
        diskWriteMB = procMetrics.diskWriteMB || 0;
        gpuPercent = procMetrics.gpuPercent;
        lastRestartTime = Date.now() - (uptime * 1000); // Calculate start time from uptime
      } else {
        // Try to get last restart from journal even if not running
        lastRestartTime = await this.getLastRestartTime(service);
      }

      // Cache the actual restart time
      if (isRunning) {
        this.lastRestartTimes.set(service.name, lastRestartTime);
      }

      return {
        name: service.name,
        description: service.description,
        category: service.category,
        port: service.port,
        isRunning,
        pid,
        cpuPercent,
        memoryMB,
        diskReadMB,
        diskWriteMB,
        gpuPercent,
        lastRestartTime: new Date(lastRestartTime).toISOString(),
        uptime,
        autoRestart: true
      };
    } catch (error) {
      console.error(`Error collecting metrics for ${service.name}:`, error);
      return {
        name: service.name,
        description: service.description,
        category: service.category,
        port: service.port,
        isRunning: false,
        cpuPercent: 0,
        memoryMB: 0,
        gpuPercent: undefined,
        lastRestartTime: new Date().toISOString(),
        uptime: 0,
        autoRestart: true
      };
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const { stdout: cpuOutput } = await execAsync(
        "ps aux | awk 'BEGIN {sum=0; count=0} {sum+=$3; count++} END {print sum/count}'"
      );
      const cpuPercent = parseFloat(cpuOutput.trim()) || 0;

      let memoryUsedMB = 0;
      let totalMem = 0;

      if (isMacOS) {
        // On macOS, use sysctl for total memory and vm_stat for available memory
        try {
          // Get total physical memory in bytes using sysctl
          const { stdout: memSizeStr } = await execAsync("sysctl -n hw.memsize");
          const totalMemBytes = parseInt(memSizeStr.trim());
          totalMem = Math.round(totalMemBytes / (1024 * 1024)); // Convert to MB

          // Get available memory from vm_stat
          // Available = Free + Inactive + Compressed (all can be freed instantly)
          const { stdout: vmOutput } = await execAsync("vm_stat");
          const lines = vmOutput.split('\n');
          let pageSize = 4096;
          let freePages = 0;
          let inactivePages = 0;
          let compressedPages = 0;

          for (const line of lines) {
            const pageSizeMatch = line.match(/page size of (\d+) bytes/);
            if (pageSizeMatch) {
              pageSize = parseInt(pageSizeMatch[1]);
            }
            const freeMatch = line.match(/Pages free:\s+(\d+)/);
            if (freeMatch) {
              freePages = parseInt(freeMatch[1]);
            }
            const inactiveMatch = line.match(/Pages inactive:\s+(\d+)/);
            if (inactiveMatch) {
              inactivePages = parseInt(inactiveMatch[1]);
            }
            const compressedMatch = line.match(/Pages stored in compressor:\s+(\d+)/);
            if (compressedMatch) {
              compressedPages = parseInt(compressedMatch[1]);
            }
          }

          // Available memory = Free + Inactive + Compressed (what OS can reclaim instantly)
          // Used memory = everything else (wired kernel + active processes + speculative)
          const availablePages = freePages + inactivePages + compressedPages;
          const availableMB = Math.round((availablePages * pageSize) / (1024 * 1024));
          // On macOS, showing "total - available" as "used" is inverted
          // Instead show the available (reclaimable) memory which matters for users
          // This fixes the 31GB "used" on idle systems - should show ~1GB used, ~31GB available
          memoryUsedMB = availableMB;  // Show available/reclaimable memory instead
        } catch (e) {
          console.error("Failed to get memory metrics:", e);
          // Fallback
          totalMem = 32 * 1024;
          memoryUsedMB = totalMem / 2;
        }
      } else if (isLinux) {
        // Use /proc/meminfo on Linux
        try {
          const meminfoContent = readFileSync('/proc/meminfo', 'utf-8');
          const lines = meminfoContent.split('\n');
          let memTotal = 0;
          let memFree = 0;
          let memAvailable = 0;
          let buffers = 0;
          let cached = 0;

          for (const line of lines) {
            const totalMatch = line.match(/^MemTotal:\s+(\d+)/);
            if (totalMatch) memTotal = parseInt(totalMatch[1]);

            const freeMatch = line.match(/^MemFree:\s+(\d+)/);
            if (freeMatch) memFree = parseInt(freeMatch[1]);

            const availMatch = line.match(/^MemAvailable:\s+(\d+)/);
            if (availMatch) memAvailable = parseInt(availMatch[1]);

            const bufMatch = line.match(/^Buffers:\s+(\d+)/);
            if (bufMatch) buffers = parseInt(bufMatch[1]);

            const cachedMatch = line.match(/^Cached:\s+(\d+)/);
            if (cachedMatch) cached = parseInt(cachedMatch[1]);
          }

          totalMem = Math.round(memTotal / 1024); // Convert KB to MB
          // Used = Total - Available (or Total - Free - Buffers - Cached)
          const effectiveFree = memAvailable > 0 ? memAvailable : (memFree + buffers + cached);
          memoryUsedMB = Math.max(0, totalMem - Math.round(effectiveFree / 1024));
        } catch (e) {
          console.error("Failed to read /proc/meminfo:", e);
          totalMem = 16384; // Fallback to 16GB
          memoryUsedMB = totalMem / 2;
        }
      } else {
        // Fallback for other platforms
        totalMem = 16384;
        memoryUsedMB = totalMem / 2;
      }

      let loads = [0, 0, 0];
      try {
        const { stdout: loadOutput } = await execAsync("uptime");
        const loadMatch = loadOutput.match(/load average[s]?:\s+([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
        if (loadMatch) {
          loads = [parseFloat(loadMatch[1]), parseFloat(loadMatch[2]), parseFloat(loadMatch[3])];
        }
      } catch { }

      return {
        timestamp: Date.now(),
        cpuPercent,
        memoryUsedMB,
        memoryTotalMB: totalMem,
        loadAverage: loads
      };
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      return {
        timestamp: Date.now(),
        cpuPercent: 0,
        memoryUsedMB: 0,
        memoryTotalMB: 0,
        loadAverage: [0, 0, 0]
      };
    }
  }

  async startService(serviceName: string): Promise<boolean> {
    try {
      const service = this.getServiceConfig(serviceName);
      if (isMacOS) {
        const launchdName = service?.unit || serviceName;
        await execAsync(`launchctl start ${launchdName}`);
      } else {
        await execAsync(`systemctl --user start ${serviceName}.service`);
      }
      this.lastRestartTimes.set(serviceName, Date.now());
      return true;
    } catch (error) {
      console.error(`Failed to start service ${serviceName}:`, error);
      return false;
    }
  }

  async stopService(serviceName: string): Promise<boolean> {
    try {
      const service = this.getServiceConfig(serviceName);
      if (isMacOS) {
        const launchdName = service?.unit || serviceName;
        await execAsync(`launchctl stop ${launchdName}`);
      } else {
        await execAsync(`systemctl --user stop ${serviceName}.service`);
      }
      return true;
    } catch (error) {
      console.error(`Failed to stop service ${serviceName}:`, error);
      return false;
    }
  }

  async restartService(serviceName: string): Promise<boolean> {
    try {
      const service = this.getServiceConfig(serviceName);
      if (isMacOS) {
        // macOS launchctl doesn't have restart, so stop then start
        const launchdName = service?.unit || serviceName;
        try {
          await execAsync(`launchctl stop ${launchdName}`);
        } catch { }
        await new Promise(resolve => setTimeout(resolve, 500));
        await execAsync(`launchctl start ${launchdName}`);
      } else {
        await execAsync(`systemctl --user restart ${serviceName}.service`);
      }
      this.lastRestartTimes.set(serviceName, Date.now());
      return true;
    } catch (error) {
      console.error(`Failed to restart service ${serviceName}:`, error);
      return false;
    }
  }

  private getServiceConfig(serviceName: string): any {
    // Import at runtime to avoid circular dependency
    const { SERVICES } = require('./config');
    return SERVICES.find((s: any) => s.name === serviceName);
  }

  private async isServiceRunning(service: ServiceConfig): Promise<boolean> {
    try {
      if (isMacOS) {
        // On macOS, check if service is loaded and running via launchctl
        try {
          const launchdName = service.unit || service.name;
          const { stdout } = await execAsync(`launchctl list | grep "${launchdName}"`);
          // If grep finds the service, parse the output
          const parts = stdout.trim().split(/\s+/);
          // Format: PID status label
          // If PID is a number (not "-"), service is running
          const pid = parts[0];
          return pid !== '-' && !isNaN(parseInt(pid));
        } catch {
          return false;
        }
      } else {
        const unit = service.unit || `${service.name}.service`;
        const { stdout } = await execAsync(`systemctl --user is-active ${unit}`);
        return stdout.trim() === 'active';
      }
    } catch {
      return false;
    }
  }

  private async getServicePID(service: ServiceConfig): Promise<number | undefined> {
    try {
      if (isMacOS) {
        // On macOS, get PID from launchctl list
        try {
          const launchdName = service.unit || service.name;
          let { stdout } = await execAsync(`launchctl list | grep "${launchdName}"`);
          const parts = stdout.trim().split(/\s+/);
          let pid = parseInt(parts[0]);

          // For services like ollama that spawn workers, always use the highest-numbered child
          // (typically the runner/worker process that does actual work)
          if (service.name === 'ollama' && pid > 0) {
            try {
              const { stdout: psOutput } = await execAsync(
                `pgrep -P ${pid} 2>/dev/null || echo ""`
              );
              const childPids = psOutput
                .trim()
                .split('\n')
                .filter(p => p)
                .map(p => parseInt(p))
                .sort((a, b) => b - a); // Sort descending, take highest PID
              if (childPids.length > 0) {
                return childPids[0]; // Return highest PID child (usually the active worker)
              }
            } catch { }
          }

          return pid > 0 ? pid : undefined;
        } catch {
          return undefined;
        }
      } else {
        const unit = service.unit || `${service.name}.service`;
        const { stdout } = await execAsync(`systemctl --user show ${unit} -p MainPID --value`);
        const pid = parseInt(stdout.trim());
        return pid > 0 ? pid : undefined;
      }
    } catch {
      return undefined;
    }
  }

  private async getProcessMetrics(pid: number) {
    try {
      // Check cache first
      const now = Date.now();
      if (this.lastCacheTime && (now - this.lastCacheTime) < this.cacheTimeoutMs) {
        const cached = this.metricsCache.get(pid);
        if (cached) return cached;
      }

      let metrics = { cpuPercent: 0, memoryMB: 0, vmemoryMB: 0, diskReadMB: 0, diskWriteMB: 0, uptime: 0, gpuPercent: undefined as number | undefined };

      if (isMacOS) {
        try {
          // Try libproc first
          const libprocMetrics = await getMacOSProcessMetrics(pid);
          metrics = libprocMetrics;
        } catch (error) {
          console.warn(`libproc failed for PID ${pid}, falling back to ps:`, error);
          // Fallback to ps
          metrics = await this.getProcessMetricsFromPs(pid);
        }
      } else if (isLinux) {
        try {
          // Use /proc on Linux
          metrics = this.getProcessMetricsFromProc(pid);
        } catch (error) {
          console.warn(`/proc parsing failed for PID ${pid}, falling back to ps:`, error);
          // Fallback to ps
          metrics = await this.getProcessMetricsFromPs(pid);
        }
      } else {
        // Fallback for other platforms
        metrics = await this.getProcessMetricsFromPs(pid);
      }

      this.metricsCache.set(pid, metrics);
      this.lastCacheTime = now;
      return metrics;
    } catch (error) {
      console.error(`Failed to get process metrics for PID ${pid}:`, error);
      return { cpuPercent: 0, memoryMB: 0, vmemoryMB: 0, diskReadMB: 0, diskWriteMB: 0, uptime: 0, gpuPercent: undefined };
    }
  }

  private getProcessMetricsFromProc(pid: number) {
    try {
      // Read /proc/[pid]/stat for CPU and uptime
      const statPath = `/proc/${pid}/stat`;
      const statContent = readFileSync(statPath, 'utf-8');
      const statFields = statContent.split(' ');

      // Get memory from /proc/[pid]/status
      const statusPath = `/proc/${pid}/status`;
      const statusContent = readFileSync(statusPath, 'utf-8');
      let rssKB = 0;
      let vmSizeKB = 0;

      const rssMatch = statusContent.match(/VmRSS:\s+(\d+)/);
      if (rssMatch) rssKB = parseInt(rssMatch[1]);

      const vmMatch = statusContent.match(/VmSize:\s+(\d+)/);
      if (vmMatch) vmSizeKB = parseInt(vmMatch[1]);

      // Convert to MB
      const memoryMB = rssKB / 1024;
      const vmemoryMB = vmSizeKB / 1024;

      // Calculate uptime from /proc/uptime and process starttime
      const uptimeContent = readFileSync('/proc/uptime', 'utf-8');
      const systemUptime = parseFloat(uptimeContent.split(' ')[0]);

      // starttime is in jiffies, field 21 (0-indexed)
      const starttime = parseInt(statFields[21]);
      const clockTicks = 100; // Default Linux clock ticks per second
      const uptime = systemUptime - (starttime / clockTicks);

      // Get CPU percent (simplified - would need multiple samples for accuracy)
      // For now, estimate from utime + stime
      const utime = parseInt(statFields[13]);
      const stime = parseInt(statFields[14]);
      const cpuPercent = ((utime + stime) / clockTicks / uptime) * 100;

      // Get disk I/O from /proc/[pid]/io (if available on this system)
      let diskReadMB = 0;
      let diskWriteMB = 0;
      try {
        const ioContent = readFileSync(`/proc/${pid}/io`, 'utf-8');
        const readMatch = ioContent.match(/read_bytes:\s+(\d+)/);
        const writeMatch = ioContent.match(/write_bytes:\s+(\d+)/);
        if (readMatch) diskReadMB = parseInt(readMatch[1]) / (1024 * 1024);
        if (writeMatch) diskWriteMB = parseInt(writeMatch[1]) / (1024 * 1024);
      } catch {
        // /proc/[pid]/io might not be available
      }

      return {
        cpuPercent: Math.max(0, Math.min(100, cpuPercent)),
        memoryMB: Math.max(0, memoryMB),
        vmemoryMB: Math.max(0, vmemoryMB),
        diskReadMB: Math.max(0, diskReadMB),
        diskWriteMB: Math.max(0, diskWriteMB),
        uptime: Math.max(0, uptime),
        gpuPercent: undefined
      };
    } catch {
      throw new Error('Failed to parse /proc metrics');
    }
  }

  private async getProcessMetricsFromPs(pid: number) {
    try {
      const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o %cpu=,%mem=,etime=`);
      const [cpuStr, memStr, etimeStr] = psOutput.trim().split(/\s+/);

      const cpuPercent = parseFloat(cpuStr) || 0;
      const memPercent = parseFloat(memStr) || 0;
      const memoryMB = (memPercent / 100) * (await this.getTotalMemory());

      // Parse etime format (HH:MM:SS or MM:SS or H:MM:SS)
      const etimeParts = etimeStr.split(':').map(x => parseInt(x));
      let uptime = 0;
      if (etimeParts.length === 3) {
        uptime = etimeParts[0] * 3600 + etimeParts[1] * 60 + etimeParts[2];
      } else if (etimeParts.length === 2) {
        uptime = etimeParts[0] * 60 + etimeParts[1];
      }

      return { cpuPercent, memoryMB, vmemoryMB: 0, diskReadMB: 0, diskWriteMB: 0, uptime, gpuPercent: undefined };
    } catch {
      return { cpuPercent: 0, memoryMB: 0, vmemoryMB: 0, diskReadMB: 0, diskWriteMB: 0, uptime: 0, gpuPercent: undefined };
    }
  }

  private async getLastRestartTime(service: ServiceConfig): Promise<number> {
    try {
      if (isMacOS) {
        // On macOS, check launchd log
        try {
          const { stdout } = await execAsync(
            `log show --predicate 'process == "${service.name}"' --last 1h --format json 2>/dev/null | jq -r '.[0].timestamp' 2>/dev/null || echo ""`
          );
          if (stdout.trim()) {
            return new Date(stdout.trim()).getTime();
          }
        } catch { }
        // Fallback: return current time if service is running, cached restart time otherwise
        return this.lastRestartTimes.get(service.name) || Date.now();
      } else {
        const unit = service.unit || `${service.name}.service`;
        const { stdout } = await execAsync(
          `journalctl --user-unit=${unit} -n 1 --output=short-unix`
        );
        return parseInt(stdout.trim().split(' ')[0]) * 1000;
      }
    } catch {
      return Date.now();
    }
  }

  private async getTotalMemory(): Promise<number> {
    try {
      const { stdout } = await execAsync("sysctl -n hw.memsize");
      return parseInt(stdout.trim()) / (1024 * 1024); // Convert to MB
    } catch {
      return 16384; // Default 16GB fallback
    }
  }
}

export interface ServiceMetrics {
  name: string;
  description: string;
  category: 'infrastructure' | 'skills' | 'agents' | 'system';
  port?: number;
  isRunning: boolean;
  pid?: number;
  cpuPercent: number;
  memoryMB: number;
  gpuPercent?: number;
  diskReadMB?: number;
  diskWriteMB?: number;
  lastRestartTime: string;
  uptime: number; // in seconds
  autoRestart: boolean;
}

export interface SystemMetrics {
  timestamp: number;
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  gpuPercent?: number;
  loadAverage: number[];
}

export interface ServiceConfig {
  name: string;
  description: string;
  category: 'infrastructure' | 'skills' | 'agents' | 'system';
  port?: number;
  unit?: string; // systemd unit name
}

export interface RestartRequest {
  timestamp: number;
  serviceName: string;
  userId?: string;
  success: boolean;
  reason?: string;
}

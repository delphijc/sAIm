<template>
  <div class="w-full h-full flex flex-col bg-slate-950">
    <!-- Header -->
    <div class="bg-slate-900 border-b border-slate-700 px-6 py-4">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-green-400">⚙️ Service Monitor</h1>
          <p class="text-sm text-slate-400 mt-1">PAI Infrastructure Services</p>
        </div>
        <div class="flex items-center gap-4">
          <div v-if="systemMetrics" class="text-right text-sm font-mono">
            <div class="text-slate-300">
              CPU: <span :class="getMetricClass(systemMetrics.cpuPercent)">{{ systemMetrics.cpuPercent.toFixed(1) }}%</span>
            </div>
            <div class="text-slate-300">
              Mem: <span :class="getMetricClass((systemMetrics.memoryUsedMB / systemMetrics.memoryTotalMB) * 100)">
                {{ (systemMetrics.memoryUsedMB / 1024).toFixed(1) }}GB / {{ (systemMetrics.memoryTotalMB / 1024).toFixed(1) }}GB
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Services Grid -->
    <div class="flex-1 overflow-auto p-6">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="animate-spin">⟳</div>
          <p class="mt-4 text-slate-400">Loading services...</p>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="service in services"
          :key="service.name"
          :class="[
            'bg-slate-900 border rounded-lg p-4 transition-all duration-200',
            service.isRunning ? 'border-green-500/30 glow-green' : 'border-slate-700'
          ]"
        >
          <!-- Service Header -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div
                  :class="[
                    'status-indicator',
                    service.isRunning ? 'status-running' : 'status-stopped'
                  ]"
                ></div>
                <button
                  v-if="service.port"
                  @click="openService(service.name, service.port)"
                  :title="`Open ${service.name} at http://${servicesDomain}:${service.port}`"
                  class="font-semibold text-green-400 hover:text-green-300 hover:underline cursor-pointer transition-colors"
                >
                  {{ service.name }}
                </button>
                <h3 v-else class="font-semibold text-green-400">{{ service.name }}</h3>
              </div>

              <!-- Control Icons (Top Right) -->
              <div class="flex gap-1">
                <button
                  v-if="!service.isRunning"
                  :disabled="actionInProgress === `${service.name}-start`"
                  @click="startService(service.name)"
                  class="icon-btn hover:text-green-300"
                  title="Start service"
                >
                  {{ actionInProgress === `${service.name}-start` ? '⟳' : '▶' }}
                </button>
                <button
                  v-if="service.isRunning"
                  :disabled="actionInProgress === `${service.name}-stop`"
                  @click="stopService(service.name)"
                  class="icon-btn hover:text-red-300"
                  title="Stop service"
                >
                  {{ actionInProgress === `${service.name}-stop` ? '⟳' : '⏹' }}
                </button>
                <button
                  v-if="service.isRunning"
                  :disabled="actionInProgress === `${service.name}-restart`"
                  @click="restartService(service.name)"
                  class="icon-btn hover:text-cyan-300"
                  title="Restart service"
                >
                  {{ actionInProgress === `${service.name}-restart` ? '⟳' : '↻' }}
                </button>
              </div>
            </div>
            <p class="text-xs text-slate-400">{{ service.description }}</p>
          </div>

          <!-- Service Details -->
          <div class="space-y-3 text-sm border-t border-slate-700 pt-3">
            <!-- Status -->
            <div class="flex justify-between">
              <span class="text-slate-400">Status</span>
              <span :class="[
                'font-medium',
                service.isRunning ? 'text-green-400' : 'text-red-400'
              ]">
                {{ service.isRunning ? '✓ Running' : '✗ Stopped' }}
              </span>
            </div>

            <!-- PID -->
            <div v-if="service.pid" class="flex justify-between">
              <span class="text-slate-400">PID</span>
              <span class="text-slate-300">{{ service.pid }}</span>
            </div>

            <!-- Uptime -->
            <div v-if="service.isRunning" class="flex justify-between">
              <span class="text-slate-400">Uptime</span>
              <span class="text-slate-300 font-mono">{{ formatDetailedUptime(service.uptime) }}</span>
            </div>

            <!-- Last Restart -->
            <div class="flex justify-between">
              <span class="text-slate-400">Last Restart</span>
              <span class="text-slate-300 text-xs">{{ formatTime(service.lastRestartTime) }}</span>
            </div>

            <!-- CPU -->
            <div class="flex justify-between">
              <span class="text-slate-400">CPU</span>
              <span :class="['text-sm font-mono', getMetricClass(service.cpuPercent)]">
                {{ service.cpuPercent.toFixed(1) }}%
              </span>
            </div>

            <!-- Disk I/O -->
            <div v-if="service.diskReadMB !== undefined || service.diskWriteMB !== undefined" class="flex justify-between">
              <span class="text-slate-400">Disk R/W</span>
              <span class="text-sm font-mono text-cyan-400">
                {{ (service.diskReadMB || 0).toFixed(1) }}M↓ / {{ (service.diskWriteMB || 0).toFixed(1) }}M↑
              </span>
            </div>

            <!-- Memory -->
            <div class="flex justify-between">
              <span class="text-slate-400">Memory</span>
              <span :class="['text-sm font-mono', getMemoryMetricClass(service.memoryMB)]">
                {{ (service.memoryMB / 1024).toFixed(1) }}GB
              </span>
            </div>

            <!-- Port -->
            <div v-if="service.port" class="flex justify-between">
              <span class="text-slate-400">Port</span>
              <span class="text-slate-300">{{ service.port }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && services.length === 0" class="flex items-center justify-center h-full">
        <p class="text-slate-400">No services available</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="bg-slate-900 border-t border-slate-700 px-6 py-3 text-xs text-slate-500">
      <div class="flex justify-between items-center">
        <div>Last updated: {{ lastUpdated }}</div>
        <div v-if="wsConnected" class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          Live
        </div>
        <div v-else class="text-red-400">Disconnected</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

interface ServiceMetrics {
  name: string
  description: string
  category: string
  port?: number
  isRunning: boolean
  pid?: number
  cpuPercent: number
  memoryMB: number
  diskReadMB?: number
  diskWriteMB?: number
  gpuPercent?: number
  lastRestartTime: string
  uptime: number
  autoRestart: boolean
}

interface SystemMetrics {
  timestamp: number
  cpuPercent: number
  memoryUsedMB: number
  memoryTotalMB: number
  gpuPercent?: number
  loadAverage: number[]
}

const services = ref<ServiceMetrics[]>([])
const systemMetrics = ref<SystemMetrics | null>(null)
const loading = ref(true)
const lastUpdated = ref(new Date().toLocaleTimeString())
const actionInProgress = ref<string | null>(null)
const wsConnected = ref(false)
const servicesDomain = ref<string>('localhost')
let ws: WebSocket | null = null
let updateTimer: NodeJS.Timeout | null = null

const getServiceUrl = (serviceName: string, port?: number): string | null => {
  if (!port) return null
  return `http://${servicesDomain.value}:${port}`
}

const openService = (serviceName: string, port?: number) => {
  const url = getServiceUrl(serviceName, port)
  if (url) {
    window.open(url, '_blank')
  }
}

const formatDetailedUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

const formatTime = (isoString: string): string => {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getMetricClass = (value: number): string => {
  if (value < 50) return 'text-green-400'
  if (value < 80) return 'text-yellow-400'
  return 'text-red-400'
}

const getMetricBarClass = (value: number): string => {
  if (value < 50) return 'metric-bar-low'
  if (value < 80) return 'metric-bar-medium'
  return 'metric-bar-high'
}

const getCpuGradColor = (value: number): string => {
  if (value < 50) return '#4ade80' // green
  if (value < 80) return '#facc15' // yellow
  return '#ef4444' // red
}

const getMemoryMetricClass = (valueMB: number): string => {
  // Classify based on 8GB chart scale: < 4GB green, < 6.4GB yellow, >= 6.4GB red
  if (valueMB < 4096) return 'text-green-400'
  if (valueMB < 6553.6) return 'text-yellow-400'
  return 'text-red-400'
}

const getMemoryGradColor = (valueMB: number): string => {
  // Classify based on 8GB chart scale: < 4GB green, < 6.4GB yellow, >= 6.4GB red
  if (valueMB < 4096) return '#4ade80' // green
  if (valueMB < 6553.6) return '#facc15' // yellow
  return '#ef4444' // red
}

const startService = async (serviceName: string) => {
  actionInProgress.value = `${serviceName}-start`
  try {
    await axios.post(`/api/services/${serviceName}/start`)
    await fetchData()
  } catch (error) {
    console.error('Failed to start service:', error)
  } finally {
    actionInProgress.value = null
  }
}

const stopService = async (serviceName: string) => {
  actionInProgress.value = `${serviceName}-stop`
  try {
    await axios.post(`/api/services/${serviceName}/stop`)
    await fetchData()
  } catch (error) {
    console.error('Failed to stop service:', error)
  } finally {
    actionInProgress.value = null
  }
}

const restartService = async (serviceName: string) => {
  actionInProgress.value = `${serviceName}-restart`
  try {
    await axios.post(`/api/services/${serviceName}/restart`)
    await fetchData()
  } catch (error) {
    console.error('Failed to restart service:', error)
  } finally {
    actionInProgress.value = null
  }
}

const fetchConfig = async () => {
  try {
    const configRes = await axios.get('/api/config')
    servicesDomain.value = configRes.data.servicesDomain
  } catch (error) {
    console.error('Failed to fetch config:', error)
  }
}

const fetchData = async () => {
  try {
    const [servicesRes, systemRes] = await Promise.all([
      axios.get('/api/services'),
      axios.get('/api/system')
    ])
    services.value = servicesRes.data.services
    systemMetrics.value = systemRes.data.system
    lastUpdated.value = new Date().toLocaleTimeString()
  } catch (error) {
    console.error('Failed to fetch data:', error)
  } finally {
    loading.value = false
  }
}

const connectWebSocket = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host // Includes port if not default

  // Connect through the same host/port as the client (Vite dev server will proxy to backend)
  const wsUrl = `${protocol}//${host}/api/metrics/stream`

  try {
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      wsConnected.value = true
      console.log('✓ WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'metrics') {
          services.value = message.data.services
          systemMetrics.value = message.data.system
          lastUpdated.value = new Date().toLocaleTimeString()
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      wsConnected.value = false
      console.error('✗ WebSocket error:', error)
    }

    ws.onclose = () => {
      wsConnected.value = false
      console.log('WebSocket closed, reconnecting in 3s...')
      // Try to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000)
    }
  } catch (error) {
    console.error('Failed to create WebSocket:', error)
    wsConnected.value = false
    setTimeout(connectWebSocket, 3000)
  }
}

onMounted(() => {
  fetchConfig()
  fetchData()
  connectWebSocket()

  // Fallback polling if WebSocket fails
  updateTimer = setInterval(() => {
    if (!wsConnected.value) {
      fetchData()
    }
  }, 5000)
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
  if (updateTimer) {
    clearInterval(updateTimer)
  }
})
</script>

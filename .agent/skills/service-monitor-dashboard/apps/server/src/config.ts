import { ServiceConfig } from './types';

export const SERVICES: ServiceConfig[] = [
  {
    name: 'voice-server',
    description: 'Text-to-speech service',
    category: 'infrastructure',
    port: 8888,
    unit: 'com.pai.voice-server'
  },
  {
    name: 'python-sidecar',
    description: 'Python voice processing sidecar',
    category: 'infrastructure',
    port: 8889,
    unit: 'com.pai.python-sidecar'
  },
  {
    name: 'observability-server',
    description: 'Real-time agent activity backend',
    category: 'infrastructure',
    port: 4000,
    unit: 'com.pai.observability-server'
  },
  {
    name: 'observability-client',
    description: 'Real-time agent monitoring frontend',
    category: 'infrastructure',
    port: 5172,
    unit: 'com.pai.observability-client'
  },
  {
    name: 'service-monitor-server',
    description: 'PAI service monitoring backend',
    category: 'infrastructure',
    port: 6000,
    unit: 'com.pai.service-monitor-server'
  },
  {
    name: 'service-monitor-client',
    description: 'PAI service monitoring frontend',
    category: 'infrastructure',
    port: 5175,
    unit: 'com.pai.service-monitor-client'
  },
  {
    name: 'discord-remote-control',
    description: 'Discord bot remote interface',
    category: 'infrastructure',
    port: undefined, // No local HTTP port — uses Discord WebSocket API
    unit: 'com.pai.discord-remote-control'
  },
  {
    name: 'memory-system',
    description: 'Semantic memory database and HTTP API',
    category: 'infrastructure',
    port: 4242,
    unit: 'com.pai.memory-system'
  },
  {
    name: 'awareness-server',
    description: 'Awareness backend API',
    category: 'infrastructure',
    port: 4100,
    unit: 'com.pai.awareness-server'
  },
  {
    name: 'awareness-client',
    description: 'Awareness frontend (Vue/Vite)',
    category: 'infrastructure',
    port: 5173,
    unit: 'com.pai.awareness-client'
  },
  {
    name: 'markdown-editor',
    description: 'Web-based PAI markdown viewer',
    category: 'infrastructure',
    port: 4444,
    unit: 'com.pai.markdown-editor'
  },
  {
    name: 'cyber-alert-server',
    description: 'Cyber Alert Manager backend',
    category: 'infrastructure',
    port: 4200,
    unit: 'com.pai.cyber-alert-server'
  },
  {
    name: 'cyber-alert-client',
    description: 'Cyber Alert Manager frontend',
    category: 'infrastructure',
    port: 5174,
    unit: 'com.pai.cyber-alert-client'
  },
  {
    name: 'ollama',
    description: 'Local LLM inference (jay-gentic backend)',
    category: 'infrastructure',
    port: 11434,
    unit: 'homebrew.mxcl.ollama'
  }
];

export const POLL_INTERVAL_MS = 3000; // Update metrics every 3 seconds (libproc/proc capable)
export const RESTART_RATE_LIMIT = {
  maxRestarts: 5,
  windowMs: 3600000 // 1 hour
};

export const PORT = parseInt(process.env.PORT || '6000');
export const CLIENT_PORT = parseInt(process.env.CLIENT_PORT || '5175');
export const SERVICES_DOMAIN = process.env.SERVICES_DOMAIN || 'localhost';

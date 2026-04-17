import { Elysia, t } from 'elysia';
import { MetricsCollector } from './metrics';
import { SERVICES, POLL_INTERVAL_MS, PORT, CLIENT_PORT, SERVICES_DOMAIN } from './config';

const app = new Elysia();

const metricsCollector = new MetricsCollector();
const lastRestartTimestamps = new Map<string, number[]>();

// Initialize restart tracking
SERVICES.forEach(service => {
  lastRestartTimestamps.set(service.name, []);
});

// Get all service metrics
app.get('/api/services', async () => {
  const metrics = await Promise.all(
    SERVICES.map(service => metricsCollector.getServiceMetrics(service))
  );
  return { services: metrics };
});

// Get specific service metrics
app.get('/api/services/:name', async ({ params }) => {
  const service = SERVICES.find(s => s.name === params.name);
  if (!service) {
    return { error: 'Service not found' };
  }
  const metrics = await metricsCollector.getServiceMetrics(service);
  return { service: metrics };
});

// Get system-wide metrics
app.get('/api/system', async () => {
  const systemMetrics = await metricsCollector.getSystemMetrics();
  return { system: systemMetrics };
});

// Get configuration (includes SERVICES_DOMAIN)
app.get('/api/config', () => {
  return {
    servicesDomain: SERVICES_DOMAIN,
    services: SERVICES.map(s => ({ name: s.name, port: s.port }))
  };
});

// Start a service
app.post(
  '/api/services/:name/start',
  async ({ params, error }) => {
    const service = SERVICES.find(s => s.name === params.name);
    if (!service) {
      return error(404, { error: 'Service not found' });
    }

    const success = await metricsCollector.startService(service.name);
    if (success) {
      return {
        success: true,
        message: `Service ${service.name} started successfully`
      };
    } else {
      return error(500, {
        error: `Failed to start service ${service.name}`
      });
    }
  }
);

// Stop a service
app.post(
  '/api/services/:name/stop',
  async ({ params, error }) => {
    const service = SERVICES.find(s => s.name === params.name);
    if (!service) {
      return error(404, { error: 'Service not found' });
    }

    const success = await metricsCollector.stopService(service.name);
    if (success) {
      return {
        success: true,
        message: `Service ${service.name} stopped successfully`
      };
    } else {
      return error(500, {
        error: `Failed to stop service ${service.name}`
      });
    }
  }
);

// Restart a service (with rate limiting)
app.post(
  '/api/services/:name/restart',
  async ({ params, body, error }) => {
    const service = SERVICES.find(s => s.name === params.name);
    if (!service) {
      return error(404, { error: 'Service not found' });
    }

    // Rate limiting: max 5 restarts per service per hour
    const now = Date.now();
    const hourAgo = now - 3600000;
    let timestamps = lastRestartTimestamps.get(service.name) || [];
    timestamps = timestamps.filter(t => t > hourAgo);

    if (timestamps.length >= 5) {
      return error(429, {
        error: 'Too many restart attempts. Max 5 per hour per service.'
      });
    }

    const success = await metricsCollector.restartService(service.name);
    if (success) {
      timestamps.push(now);
      lastRestartTimestamps.set(service.name, timestamps);
      return {
        success: true,
        message: `Service ${service.name} restarted successfully`
      };
    } else {
      return error(500, {
        error: `Failed to restart service ${service.name}`
      });
    }
  },
  {
    body: t.Optional(t.Object({ token: t.Optional(t.String()) }))
  }
);

// WebSocket endpoint for real-time metrics
app.ws('/api/metrics/stream', {
  open(ws) {
    const interval = setInterval(async () => {
      try {
        const metrics = await Promise.all(
          SERVICES.map(service => metricsCollector.getServiceMetrics(service))
        );
        const systemMetrics = await metricsCollector.getSystemMetrics();
        ws.send(JSON.stringify({
          type: 'metrics',
          data: { services: metrics, system: systemMetrics }
        }));
      } catch (error) {
        console.error('Error in metrics stream:', error);
      }
    }, POLL_INTERVAL_MS);

    ws.data.interval = interval;
  },
  close(ws) {
    if (ws.data.interval) {
      clearInterval(ws.data.interval as NodeJS.Timeout);
    }
  }
});

// Health check endpoint
app.get('/health', () => {
  return { status: 'ok', timestamp: Date.now() };
});

const server = app.listen(PORT);
console.log(`Service Monitor Server running on port ${PORT}`);
console.log(`WebSocket endpoint: ws://localhost:${PORT}/api/metrics/stream`);

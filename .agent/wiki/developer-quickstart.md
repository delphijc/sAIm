# sAIm Developer Quick Start

**Purpose:** Get up to speed fast with code examples and working patterns  
**Level:** Intermediate (assume familiarity with HTTP APIs, JSON, TypeScript)  
**Time:** 15-30 minutes to first working integration

---

## 5-Minute Setup

### 1. Verify Services Running

```bash
# Check all services
systemctl --user status pai-infrastructure.target

# Should show: Main PID: XXXX
#             Status: "running"
```

### 2. Health Check Each Service

```bash
# Voice Server
curl http://localhost:8888/health

# Memory System
curl http://localhost:4242/health

# Awareness Dashboard
curl http://localhost:4100/health

# Observability Dashboard
curl http://localhost:5172/health

# Service Monitor
curl http://localhost:6000/health
```

All should return: `{"status":"ok", ...}`

### 3. Set Environment Variables

```bash
# Add to ~/.zshrc or ~/.bashrc
export PAI_DIR=~/.claude
export MEMORY_SERVICE_URL=http://localhost:4242
export VOICE_SERVICE_URL=http://localhost:8888
export AWARENESS_SERVICE_URL=http://localhost:4100
export OBSERVABILITY_SERVICE_URL=http://localhost:5172

# Source immediately
source ~/.zshrc
```

---

## Working Code Examples

### Example 1: Call Voice API

**File:** `voice-api-example.ts`

```typescript
// Text-to-speech example
async function speakNotification(text: string): Promise<void> {
  const voiceServiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:8888';
  
  const response = await fetch(`${voiceServiceUrl}/api/speak`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceId: 'Jessica',
      rate: 1.0,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Voice API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log(`Audio created: ${result.audioUrl}, Duration: ${result.duration}s`);
}

// Usage
await speakNotification('Build completed successfully');
```

**Run it:**
```bash
bun voice-api-example.ts
```

### Example 2: Extract Facts from Text

**File:** `memory-extraction-example.ts`

```typescript
// Extract facts from transcript
async function extractFacts(transcript: string): Promise<void> {
  const memoryServiceUrl = process.env.MEMORY_SERVICE_URL || 'http://localhost:4242';
  
  const response = await fetch(`${memoryServiceUrl}/memory/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: `session-${Date.now()}`,
      transcript,
      timestamp: new Date().toISOString(),
      source: 'developer-example',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Memory API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log(`Extracted ${result.facts.length} facts:`);
  
  for (const fact of result.facts) {
    console.log(`  [${fact.type}] ${fact.text} (confidence: ${fact.confidence})`);
  }
  
  console.log(`\nAssociations: ${result.associations.length}`);
  for (const assoc of result.associations) {
    console.log(`  ${assoc.source} --[${assoc.type}]--> ${assoc.target}`);
  }
}

// Usage
const transcript = `
User asked me to implement Redis caching for the API endpoints.
I recommended using node-redis with connection pooling.
This should improve response times by 40-60%.
`;

await extractFacts(transcript);
```

**Run it:**
```bash
bun memory-extraction-example.ts
```

**Expected Output:**
```
Extracted 2 facts:
  [task] User asked me to implement Redis caching for the API endpoints. (confidence: 0.95)
  [recommendation] I recommended using node-redis with connection pooling. (confidence: 0.88)

Associations: 1
  fact-123 --[related]--> fact-124
```

### Example 3: Search Memory

**File:** `memory-search-example.ts`

```typescript
// Search semantic memory
async function searchMemory(query: string, type?: string): Promise<void> {
  const memoryServiceUrl = process.env.MEMORY_SERVICE_URL || 'http://localhost:4242';
  
  const params = new URLSearchParams({
    q: query,
    limit: '10',
    minConfidence: '0.7',
  });
  
  if (type) {
    params.append('type', type);
  }
  
  const response = await fetch(
    `${memoryServiceUrl}/memory/search?${params.toString()}`
  );
  
  if (!response.ok) {
    throw new Error(`Search API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log(`Found ${result.results.length} results for: "${query}"`);
  console.log(`(${result.totalCount} total, took ${result.executionMs}ms)\n`);
  
  for (const fact of result.results) {
    console.log(`[${fact.type}] ${fact.text}`);
    console.log(`  Confidence: ${fact.confidence} | Relevance: ${fact.relevanceScore}`);
    console.log(`  Created: ${new Date(fact.created_at).toLocaleString()}\n`);
  }
}

// Usage examples
await searchMemory('Redis');  // All facts mentioning Redis
await searchMemory('caching', 'task');  // Only task facts about caching
```

**Run it:**
```bash
bun memory-search-example.ts
```

### Example 4: Get Operations Briefing

**File:** `briefing-example.ts`

```typescript
// Get daily operations briefing
async function getBriefing(period: 'daily' | 'weekly' = 'daily'): Promise<void> {
  const awarenessUrl = process.env.AWARENESS_SERVICE_URL || 'http://localhost:4100';
  
  const response = await fetch(
    `${awarenessUrl}/api/briefing?period=${period}&format=markdown`
  );
  
  if (!response.ok) {
    throw new Error(`Briefing API error: ${response.statusText}`);
  }
  
  const briefing = await response.text();
  console.log(briefing);
}

// Usage
await getBriefing('daily');
```

**Run it:**
```bash
bun briefing-example.ts | less  # Pipe to pager
```

### Example 5: Monitor Agent Activity (WebSocket)

**File:** `observability-example.ts`

```typescript
// Real-time agent monitoring
function monitorAgents(): void {
  const wsUrl = process.env.OBSERVABILITY_SERVICE_URL?.replace('http', 'ws') 
    || 'ws://localhost:5172';
  
  const ws = new WebSocket(`${wsUrl}/ws/agents`);
  
  ws.onopen = () => {
    console.log('Connected to observability stream');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'agent-started':
        console.log(`🟢 Agent started: ${message.payload.type} (${message.agentId})`);
        console.log(`   Task: ${message.payload.task}`);
        break;
        
      case 'message-sent':
        console.log(`💬 Message from agent ${message.agentId}`);
        break;
        
      case 'agent-completed':
        console.log(`✓ Agent completed: ${message.agentId}`);
        console.log(`   Status: ${message.payload.status}`);
        break;
        
      case 'agent-error':
        console.log(`✗ Agent error: ${message.agentId}`);
        console.log(`   Error: ${message.payload.error}`);
        break;
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('Disconnected from observability stream');
  };
}

// Usage
monitorAgents();

// Keep script running
process.stdin.on('data', () => {
  // Press Ctrl+C to exit
});
```

**Run it (keep running):**
```bash
bun observability-example.ts
# Should show agent activity as it happens
# Press Ctrl+C to exit
```

### Example 6: List Active Services

**File:** `service-status-example.ts`

```typescript
// Check service health
async function checkServices(): Promise<void> {
  const monitorUrl = process.env.SERVICE_MONITOR_URL || 'http://localhost:6000';
  
  const response = await fetch(`${monitorUrl}/api/services`);
  
  if (!response.ok) {
    throw new Error(`Service Monitor API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  console.log(`System Status: ${data.systemStatus}\n`);
  console.log('Services:');
  console.log('─'.repeat(70));
  
  for (const service of data.services) {
    const status = service.status === 'running' ? '✓' : '✗';
    const uptime = Math.floor(service.uptime / 1000);
    const memory = Math.floor(service.memory / 1024 / 1024);
    
    console.log(`${status} ${service.name.padEnd(25)} ${service.status.padEnd(10)} ${uptime}s uptime ${memory}MB`);
  }
}

// Usage
await checkServices();
```

**Run it:**
```bash
bun service-status-example.ts
```

**Expected Output:**
```
System Status: healthy

Services:
──────────────────────────────────────────────────────────────────
✓ voice-server                running     86400s uptime 45MB
✓ memory-system               running     172800s uptime 120MB
✓ awareness-backend           running     345600s uptime 30MB
✓ observability-dashboard     running     604800s uptime 75MB
✓ service-monitor-server      running     2592000s uptime 50MB
```

---

## Common Patterns

### Pattern 1: Error Handling with Retry

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed: ${lastError.message}`);
      
      if (attempt < maxAttempts) {
        const delay = backoffMs * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Usage
const result = await callWithRetry(
  () => fetch('http://localhost:4242/health').then(r => r.json()),
  3,  // 3 attempts
  1000  // start with 1s backoff
);
```

### Pattern 2: Batch Operations

```typescript
async function batchMemoryExtraction(
  transcripts: string[],
  batchSize: number = 10
): Promise<void> {
  for (let i = 0; i < transcripts.length; i += batchSize) {
    const batch = transcripts.slice(i, i + batchSize);
    
    const promises = batch.map(transcript =>
      fetch('http://localhost:4242/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `batch-${i}`,
          transcript,
          timestamp: new Date().toISOString(),
        }),
      })
    );
    
    const responses = await Promise.all(promises);
    console.log(`Batch ${i / batchSize + 1}: ${responses.length} extractions`);
  }
}

// Usage
const transcripts = [
  'User asked about Redis caching...',
  'I recommended using connection pooling...',
  'We discussed performance improvements...',
];

await batchMemoryExtraction(transcripts, 5);  // 5 at a time
```

### Pattern 3: Event Streaming

```typescript
async function streamAgentEvents(
  onEvent: (event: any) => void,
  onError: (error: Error) => void
): Promise<() => void> {
  const ws = new WebSocket('ws://localhost:5172/ws/agents');
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      onEvent(message);
    } catch (error) {
      onError(error as Error);
    }
  };
  
  ws.onerror = (event) => {
    onError(new Error('WebSocket error'));
  };
  
  // Return cleanup function
  return () => ws.close();
}

// Usage
const cleanup = await streamAgentEvents(
  (event) => console.log(`Event: ${event.type}`),
  (error) => console.error(`Error: ${error.message}`)
);

// Later: cleanup()
```

---

## Testing Integration

### Setup Test Environment

```bash
# Create test .env
cat > .env.test << 'EOF'
MEMORY_SERVICE_URL=http://localhost:4242
VOICE_SERVICE_URL=http://localhost:8888
AWARENESS_SERVICE_URL=http://localhost:4100
OBSERVABILITY_SERVICE_URL=http://localhost:5172
EOF
```

### Test API Connectivity

```bash
# Save as test-apis.sh
#!/bin/bash

services=(
  "Memory:http://localhost:4242"
  "Voice:http://localhost:8888"
  "Awareness:http://localhost:4100"
  "Observability:http://localhost:5172"
  "ServiceMonitor:http://localhost:6000"
)

for service in "${services[@]}"; do
  IFS=':' read -r name url <<< "$service"
  
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url/health")
  
  if [ "$status" = "200" ]; then
    echo "✓ $name is healthy"
  else
    echo "✗ $name returned HTTP $status"
  fi
done
```

**Run it:**
```bash
bash test-apis.sh
```

---

## Webhook Integration

### Receive Extraction Complete Event

**File:** `webhook-receiver.ts`

```typescript
import { serve } from 'bun';

// Simple webhook receiver
serve({
  port: 9000,
  fetch(req) {
    if (req.method === 'POST' && req.url.endsWith('/webhooks/extraction-complete')) {
      const json = req.json();
      
      json.then(payload => {
        console.log('Extraction Complete Event:');
        console.log(`  Session: ${payload.sessionId}`);
        console.log(`  Facts: ${payload.facts.length}`);
        console.log(`  Associations: ${payload.associations.length}`);
        
        // Process facts
        for (const fact of payload.facts) {
          console.log(`    [${fact.type}] ${fact.text}`);
        }
      });
      
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log('Webhook receiver listening on http://localhost:9000');
```

**Run it:**
```bash
bun webhook-receiver.ts
```

**Test it (in another terminal):**
```bash
curl -X POST http://localhost:9000/webhooks/extraction-complete \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "facts": [
      {"id": "f1", "type": "task", "text": "Test fact", "confidence": 0.9}
    ],
    "associations": [],
    "totalExtracted": 1,
    "executionTime": 234
  }'
```

---

## Troubleshooting

### Service Not Responding

```bash
# Check if service is running
ps aux | grep voice-server

# Check if port is listening
lsof -i :8888

# Try connecting directly
curl -v http://localhost:8888/health

# View service logs
journalctl --user -u voice-server.service -n 50
```

### High Latency

```bash
# Measure API response time
time curl http://localhost:4242/health

# If >2 seconds, check service load
systemctl --user show-environment | head -20

# Restart service
systemctl --user restart memory-system
```

### Memory Service Growing

```bash
# Check database size
du -sh ~/Projects/memory-system/data/memory.db

# Run consolidation
curl -X POST http://localhost:4242/memory/consolidation/run

# If still too large, run aggressive consolidation
curl -X POST http://localhost:4242/memory/consolidation/run \
  -H "Content-Type: application/json" \
  -d '{"mode": "aggressive", "retentionDays": 30}'
```

---

## Next Steps

1. **Run all examples** to understand basic patterns
2. **Integrate into your project** using the code samples
3. **Monitor with Discord bot** — add `!sam help` to your workflow
4. **Read full API docs** — `.agent/wiki/api-integration-guide.md`
5. **Set up alerts** — Configure Prometheus or webhook consumers

---

## File Reference

| File | What It Does |
|------|-------------|
| `voice-api-example.ts` | Text-to-speech API |
| `memory-extraction-example.ts` | Extract facts from text |
| `memory-search-example.ts` | Query semantic memory |
| `briefing-example.ts` | Get operations briefing |
| `observability-example.ts` | Monitor agents real-time |
| `service-status-example.ts` | Check service health |
| `webhook-receiver.ts` | Receive webhook events |

**All examples:** Copy, modify, run locally.

---

**Happy integrating! 🚀**

Questions? Check [api-integration-guide.md](./api-integration-guide.md) for comprehensive details.

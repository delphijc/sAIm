# Memory System Integration Guide

**TL;DR**: memory-system is the authoritative backend for semantic memory. Sam and discord-remote-control are optional clients that call its API.

---

## Critical Architecture Principle

**memory-system owns ALL semantic memory logic. Do not duplicate this in Sam or discord-remote-control.**

### What memory-system OWNS (Do not reimplement)
- ✅ Fact extraction (12 extraction patterns)
- ✅ Confidence scoring (ACT-R activation)
- ✅ Association building (temporal + topic-based)
- ✅ Memory consolidation (deduplication, noise pruning)
- ✅ Graph queries (neighbor discovery, path finding)
- ✅ Semantic memory database
- ✅ HTTP API server (port 4242)

### What Sam/discord-remote-control OWN
- ✅ Discord message routing (discord-remote-control)
- ✅ Episodic memory - recent conversation history (discord-remote-control)
- ✅ Voice transcription (discord-remote-control)
- ✅ Session capture (Sam hook)
- ✅ Environment variable control (both)

---

## Integration Points

### Sam: Session Capture Hook

**File**: `.agent/hooks/memory-capture.ts`

When a Claude Code session ends:
1. If `ENABLE_MEMORY_HOOKS=true`, capture conversation pairs
2. Call memory-system API: `POST http://localhost:4242/memory/extract`
3. Let memory-system handle extraction, association, consolidation

```typescript
// Example: Sam's memory-capture.ts
async function captureSessionMemory(conversationPairs) {
  if (!process.env.ENABLE_MEMORY_HOOKS) return;
  
  try {
    const response = await fetch(
      `${process.env.MEMORY_SERVICE_URL}/memory/extract`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          conversationPairs,
          projectContext: PROJECT_NAME
        })
      }
    );
    
    if (!response.ok) {
      console.warn('Memory service unavailable; continuing without memory extraction');
    }
  } catch (error) {
    console.warn('Memory service error:', error.message);
    // Continue normally - memory-system is optional
  }
}
```

### discord-remote-control: Optional Semantic Context Retrieval

**File**: `.agent/skills/discord-remote-control/service/memory/retrieval.ts`

When handling a Discord message:
1. If `ENABLE_MEMORY_HOOKS=true`, optionally retrieve semantic context
2. Call memory-system API: `GET http://localhost:4242/api/search?query=...`
3. Inject context into Claude subprocess prompt
4. Do NOT extract facts, build associations, or manage semantic memory

```typescript
// Example: discord-remote-control's optional context retrieval
async function injectSemanticContext(userMessage) {
  if (!process.env.ENABLE_MEMORY_HOOKS) return '';
  
  try {
    const response = await fetch(
      `${process.env.MEMORY_SERVICE_URL}/api/search`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (!response.ok) return '';
    
    const memories = await response.json();
    return formatMemoriesAsContext(memories);
  } catch (error) {
    // Graceful degradation - continue without semantic context
    return '';
  }
}
```

---

## Environment Variables

Both Sam and discord-remote-control respect:

```bash
# .agent/.env

# Enable semantic memory integration
ENABLE_MEMORY_HOOKS=false  # Default: disabled

# Memory service URL
MEMORY_SERVICE_URL=http://localhost:4242
```

---

## Database Locations

### memory-system: Semantic Memory Database
```
~/.claude/memory.db
├── semantic_memories (facts, confidence scores)
├── associations (temporal + topic-based links)
├── conversation_history (episodic, for context)
└── semantic_memories_fts (full-text search index)
```

**Owned by**: memory-system project  
**Accessed by**: Sam (write via hook), discord-remote-control (read via API)  
**Not directly accessed by**: discord-remote-control code

### discord-remote-control: Episodic Memory Database
```
~/.claude/discord-remote-control/memory.db
├── recent_messages (episodic, last N messages)
└── sessions (Discord session history)
```

**Owned by**: discord-remote-control  
**Contains**: Only recent conversation history, NOT semantic memories  
**Scope**: Discord bot operation only

---

## API Contracts (memory-system exposes)

### POST /memory/extract
Extract facts from conversation pairs.

Request:
```json
{
  "sessionId": "session_123",
  "conversationPairs": [
    { "user": "What is X?", "assistant": "X is Y" }
  ],
  "projectContext": "sam"
}
```

Response:
```json
[
  {
    "id": "mem_123",
    "topic": "Architecture",
    "summary": "X is Y",
    "confidence": 0.85,
    "relevanceScore": 0.95
  }
]
```

### GET /api/search
Hybrid search (keyword + semantic).

Request:
```
GET /api/search?query=authentication&limit=10&similarity_threshold=0.7
```

Response:
```json
[
  {
    "id": "mem_456",
    "summary": "JWT authentication requires...",
    "confidence": 0.80,
    "matchType": "semantic",
    "score": 0.85
  }
]
```

### GET /api/graph/neighbors
Get associated memories.

Request:
```
GET /api/graph/neighbors?memoryId=mem_123&hops=2
```

Response:
```json
{
  "center": { "id": "mem_123", "summary": "..." },
  "neighbors": [
    { "id": "mem_456", "summary": "...", "weight": 0.20 }
  ]
}
```

---

## Common Mistakes to Avoid

### ❌ WRONG: Extracting facts in Sam or discord-remote-control

```typescript
// DON'T DO THIS
function extractFact(message) {
  if (message.includes("Completed")) {
    return { topic: "Completed", summary: message };
  }
}
```

**Why**: memory-system already does this with 12 extraction patterns.

**RIGHT**: Call memory-system API
```typescript
const extracted = await fetch('http://localhost:4242/memory/extract', {
  body: JSON.stringify({ sessionId, conversationPairs })
});
```

### ❌ WRONG: Building associations in discord-remote-control

```typescript
// DON'T DO THIS
function linkMemories(memA, memB) {
  db.run("INSERT INTO associations ...");
}
```

**Why**: Hebbian learning and weight management are memory-system's responsibility.

**RIGHT**: memory-system builds associations when you call extract()

### ❌ WRONG: Duplicating consolidation logic

```typescript
// DON'T DO THIS
async function cleanup() {
  // Manual deduplication
  const similar = findDuplicates();
  // ...
}
```

**Why**: memory-system runs consolidation on schedule.

**RIGHT**: memory-system handles it automatically

---

## Testing Strategy

### Sam Tests
- ✅ Test that `memory-capture.ts` makes HTTP calls to memory-system
- ✅ Test graceful degradation (no crash if memory service unavailable)
- ❌ Do NOT test extraction logic (memory-system tests cover that)

### discord-remote-control Tests
- ✅ Test that retrieval calls memory-system API
- ✅ Test response parsing and context injection
- ✅ Test graceful degradation
- ❌ Do NOT test extraction, consolidation, or association logic

### memory-system Tests
- ✅ Test all extraction patterns
- ✅ Test association building
- ✅ Test consolidation algorithm
- ✅ Test graph queries
- ✅ Test database migrations

---

## Operational Health Checks

```bash
# 1. Verify memory-system is running
curl http://localhost:4242/health

# 2. Verify memory extraction works
curl -X POST http://localhost:4242/memory/extract \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","conversationPairs":[{"user":"Test?","assistant":"Test"}]}'

# 3. Verify no extraction logic in discord-remote-control
grep -r "extractFact\|consolidat\|association" \
  .agent/skills/discord-remote-control/service/
# Should return: only API calls

# 4. Verify separate databases
ls -la ~/.claude/memory.db                           # memory-system
ls -la ~/.claude/discord-remote-control/memory.db    # discord-remote-control
```

---

## Decision Tree

**Should I implement memory logic?**

```
Is this fact extraction, association building, or consolidation?
├─ YES → Implement in memory-system
├─ NO → Continue

Is this Discord bot logic?
├─ YES → Implement in discord-remote-control
├─ NO → Continue

Is this session capture or memory service integration?
├─ YES → Implement in Sam (.agent/hooks/)
├─ NO → Consider: Is this a new feature?
```

---

## References

- **memory-system README**: Core concepts, API reference, technical guide
- **memory-system/EXTERNALIZED_dependencies.md**: Full separation rules
- **discord-remote-control/SKILL.md**: Discord bot capabilities
- **discord-remote-control/Reference.md**: Discord bot architecture
- **.agent/hooks/memory-capture.ts**: Sam's integration point

---

**Last Updated**: 2026-04-16  
**Purpose**: Prevent duplication of semantic memory logic  
**Audience**: Developers working on Sam or discord-remote-control

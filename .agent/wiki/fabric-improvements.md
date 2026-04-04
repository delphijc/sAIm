# Fabric Skill - Improvement Recommendations

> Enhancement proposals for the fabric skill in Sam PAI infrastructure

---

## Executive Summary

The fabric skill currently provides native pattern execution with 248 patterns. These improvements would enhance discoverability, reliability, customization, and integration with the broader PAI ecosystem.

---

## Priority 1: Critical Improvements

### 1.1 Pattern Index & Discovery System

**Problem**: With 248 patterns, users struggle to find the right pattern for their task.

**Proposed Solution**:

Create a searchable pattern index with:
- Category-based browsing
- Keyword search across pattern names and descriptions
- Task-to-pattern mapping

**Implementation**:

```markdown
# .agent/skills/fabric/tools/pattern-index.json
{
  "patterns": [
    {
      "name": "extract_wisdom",
      "category": "extraction",
      "keywords": ["insights", "wisdom", "podcast", "interview", "transcript"],
      "description": "Extract key insights, quotes, habits, and facts from content",
      "inputType": "text",
      "outputSections": ["SUMMARY", "IDEAS", "INSIGHTS", "QUOTES", "HABITS", "FACTS", "REFERENCES", "RECOMMENDATIONS"]
    }
  ],
  "categories": {
    "extraction": ["extract_wisdom", "extract_insights", "extract_alpha"],
    "analysis": ["analyze_claims", "analyze_paper", "analyze_code"],
    "security": ["create_threat_model", "analyze_malware", "create_sigma_rules"],
    "summarization": ["summarize", "summarize_paper", "create_5_sentence_summary"]
  }
}
```

**Benefit**: Faster pattern discovery, reduced cognitive load, better task matching.

---

### 1.2 Pattern Recommendation Engine

**Problem**: Users often don't know which pattern to use for their specific task.

**Proposed Solution**:

Implement automatic pattern suggestion based on:
- Input content analysis
- User intent detection
- Task context from conversation

**Implementation**:

```typescript
// .agent/skills/fabric/tools/pattern-recommender.ts
interface PatternRecommendation {
  pattern: string;
  confidence: number;
  reason: string;
}

function recommendPatterns(input: string, context: string): PatternRecommendation[] {
  // Analyze input type (transcript, code, document, etc.)
  // Match against pattern capabilities
  // Return ranked recommendations
}
```

**User Experience**:
```
User: "I have this podcast transcript..."
Sam: "I recommend these patterns:
  1. extract_wisdom (90% match) - Extract insights, quotes, habits
  2. summarize_podcast (85% match) - Create episode summary
  3. extract_recommendations (70% match) - Get actionable items"
```

---

### 1.3 Pattern Validation & Testing

**Problem**: No automated validation that patterns work correctly after updates.

**Proposed Solution**:

Create a pattern testing framework:
- Sample inputs for each pattern
- Expected output validation
- Automated testing on pattern updates

**Implementation**:

```bash
# .agent/skills/fabric/tools/test-patterns.sh
#!/bin/bash

test_pattern() {
  local pattern=$1
  local input_file=".agent/skills/fabric/tools/patterns/${pattern}/test-input.md"
  local expected_file=".agent/skills/fabric/tools/patterns/${pattern}/test-expected.md"

  # Run pattern against test input
  # Validate output structure matches expected
}

# Run all pattern tests
for pattern in $(ls tools/patterns/); do
  test_pattern "$pattern"
done
```

---

## Priority 2: High Value Enhancements

### 2.1 Pattern Composition Framework

**Problem**: Complex tasks require manual chaining of multiple patterns.

**Proposed Solution**:

Create composable pattern pipelines:

**Implementation**:

```yaml
# .agent/skills/fabric/tools/compositions/deep-analysis.yaml
name: deep_content_analysis
description: Comprehensive content analysis pipeline
steps:
  - pattern: summarize
    output_var: summary
  - pattern: extract_wisdom
    output_var: wisdom
  - pattern: analyze_claims
    input: $wisdom.IDEAS
    output_var: verified_claims
  - pattern: extract_recommendations
    output_var: recommendations
final_output:
  - $summary
  - $wisdom
  - $verified_claims
  - $recommendations
```

**User Experience**:
```
User: "Run deep analysis on this article"
→ Executes entire pipeline automatically
→ Returns comprehensive multi-pattern output
```

---

### 2.2 Custom Pattern Management

**Problem**: Users cannot easily create, save, and manage custom patterns.

**Proposed Solution**:

Pattern CRUD operations:

```bash
# Create new pattern
/fabric create my_custom_pattern

# Edit existing pattern
/fabric edit extract_wisdom

# Clone and customize
/fabric clone extract_wisdom my_wisdom_variant

# List custom patterns
/fabric list --custom

# Delete custom pattern
/fabric delete my_custom_pattern
```

**Storage**:
```
.agent/skills/fabric/tools/patterns/
├── _custom/                    # User custom patterns
│   ├── my_pattern/
│   │   └── system.md
│   └── company_analysis/
│       └── system.md
└── extract_wisdom/             # Standard patterns
```

---

### 2.3 Pattern Output Caching

**Problem**: Re-running patterns on same content wastes processing.

**Proposed Solution**:

Implement content-based caching:

```typescript
interface PatternCache {
  contentHash: string;
  pattern: string;
  output: string;
  timestamp: Date;
  ttl: number; // Time to live in hours
}

// Cache key = hash(content + pattern + options)
// Store in .agent/cache/fabric/
```

**Benefits**:
- Faster repeat operations
- Reduced API costs
- Enables pattern comparison on same content

---

### 2.4 Pattern Versioning

**Problem**: Pattern updates may break existing workflows; no rollback capability.

**Proposed Solution**:

Version control for patterns:

```
patterns/
├── extract_wisdom/
│   ├── system.md           # Current version
│   ├── versions/
│   │   ├── v1.0.0.md
│   │   ├── v1.1.0.md
│   │   └── v1.2.0.md       # Latest
│   └── changelog.md
```

**Commands**:
```bash
# Use specific version
/fabric extract_wisdom --version 1.0.0

# List versions
/fabric versions extract_wisdom

# Rollback
/fabric rollback extract_wisdom v1.0.0
```

---

## Priority 3: Advanced Features

### 3.1 Multi-Modal Pattern Support

**Problem**: Patterns only work with text input.

**Proposed Solution**:

Extend patterns to handle:
- **Images**: Screenshot analysis, diagram extraction
- **Audio**: Direct transcription + pattern application
- **Video**: Frame extraction + analysis
- **PDFs**: Document parsing + pattern application

**Implementation**:

```yaml
# Pattern metadata
name: analyze_screenshot
input_types:
  - image/png
  - image/jpeg
preprocessing:
  - ocr_extraction
  - layout_analysis
pattern: analyze_presentation
```

---

### 3.2 Pattern Analytics & Insights

**Problem**: No visibility into pattern usage, effectiveness, or trends.

**Proposed Solution**:

Track pattern metrics:

```typescript
interface PatternMetrics {
  patternName: string;
  usageCount: number;
  averageInputLength: number;
  averageOutputLength: number;
  userSatisfactionScore: number; // Based on follow-up actions
  commonCombinations: string[]; // Frequently chained patterns
  failureRate: number;
}
```

**Dashboard Integration**:
- Pattern usage trends
- Most effective patterns by task type
- Recommended pattern improvements

---

### 3.3 Collaborative Pattern Development

**Problem**: Custom patterns are siloed to individual users.

**Proposed Solution**:

Pattern sharing and collaboration:

```bash
# Export pattern for sharing
/fabric export my_pattern --format yaml

# Import shared pattern
/fabric import pattern.yaml

# Publish to team library
/fabric publish my_pattern --team

# Browse team patterns
/fabric browse --team
```

---

### 3.4 AI-Assisted Pattern Creation

**Problem**: Creating effective patterns requires prompt engineering expertise.

**Proposed Solution**:

Pattern generation assistant:

```
User: "I need a pattern that analyzes customer feedback and extracts:
       - Main complaints
       - Feature requests
       - Sentiment trends
       - Priority recommendations"

Sam: "I'll create a custom pattern for you. Here's the draft:

     # IDENTITY and PURPOSE
     You are an expert in customer feedback analysis...

     [Generated pattern]

     Would you like me to:
     1. Save this as 'analyze_customer_feedback'
     2. Test it with sample data
     3. Refine the output format"
```

---

## Priority 4: Integration Improvements

### 4.1 Voice Server Integration

**Status**: Voice server documentation updated (2026-01-30) to reflect ChatterboxTTS architecture.

**Problem**: Pattern outputs aren't automatically read aloud.

**Proposed Solution**:

Integrate with PAI voice server:

```typescript
// After pattern execution
if (settings.voiceEnabled && output.type === 'summary') {
  await voiceServer.speak(output.summary, { voice_id: 'jessica' });
}
```

**Selective Reading**:
- Read SUMMARY section aloud
- Skip detailed sections (IDEAS, QUOTES)
- Configurable per pattern

**Voice Server Details**:
- Main server: port 8888 (HTTP API)
- Python sidecar: port 8889 (ChatterboxTTS synthesis)
- Voice cloning via WAV reference files
- MPS acceleration on Apple Silicon
- No API key required (local TTS)

---

### 4.2 Observability Dashboard Integration

**Problem**: No visibility into pattern execution in dashboard.

**Proposed Solution**:

Add Fabric panel to observability dashboard:
- Active pattern executions
- Pattern usage statistics
- Error/failure tracking
- Output preview

---

### 4.4 Migration Items from Docs/migration/ Review

**Status**: Reviewed 2026-01-30

**Completed Implementations**:

✅ **Modular MCP Servers** - Implemented via jagents-mcp-servers
- Skills, Workflows, and Rules available as separate MCP servers
- Integrated in `.mcp.json`
- Provides modular, reusable components for Fabric patterns
- Potential: Fabric patterns could be exposed as MCP tools

✅ **Dynamic Agent Orchestration** - Implemented
- Multi-agent orchestration with isolated sessions
- fabric skill could delegate to specialist agents for complex analysis
- Potential: Pattern composition via agent orchestration

✅ **Multi-Provider Compatibility** - Implemented
- fabric skill works across Claude, Gemini, Qwen, Antigravity
- Provider-agnostic pattern execution
- Model mapping for optimal pattern performance

🔄 **Multi-CLI Observability** - Deferred
- Original goal: Extend Observability dashboard to Gemini/Qwen
- Finding: gemini-cli and qwen-code lack hook system
- Impact: Fabric pattern execution only visible in Claude Code
- Status: Deferred due to CLI limitations

**BDD Security Testing** - Design Only (Not Implemented)
- Proposed: BDD Security Testing Framework with 142 security stories
- Components: BDD Security Tester agent, test generation skills
- Potential Fabric integration: Security pattern validation
- Status: Design document exists in Docs/migration/BDD_ANALYSIS.md
- Recommendation: Low priority, evaluate based on security needs

---

### 4.4 MCP Server for Patterns

**Problem**: Patterns not accessible via MCP protocol.

**Proposed Solution**:

Create MCP server for Fabric:

```typescript
// .agent/skills/fabric/mcp-server/server.ts
const fabricMCP = {
  tools: [
    {
      name: "apply_pattern",
      description: "Apply a Fabric pattern to content",
      parameters: {
        pattern: { type: "string" },
        content: { type: "string" },
        options: { type: "object" }
      }
    },
    {
      name: "list_patterns",
      description: "List available patterns by category"
    },
    {
      name: "get_pattern_info",
      description: "Get details about a specific pattern"
    }
  ]
};
```

---

## Priority 5: Quality of Life

### 5.1 Interactive Pattern Mode

**Problem**: Pattern output is one-shot; no iterative refinement.

**Proposed Solution**:

Interactive pattern sessions:

```
User: "Extract wisdom from this transcript"
[Output generated]

User: "Focus more on the leadership insights"
[Refined output]

User: "Add a section for actionable next steps"
[Further refined output]

User: "Save this refined pattern as leadership_wisdom"
[Custom pattern created]
```

---

### 5.2 Pattern Shortcuts

**Problem**: Full pattern names are verbose.

**Proposed Solution**:

Common pattern aliases:

| Shortcut | Full Pattern |
|----------|--------------|
| `ew` | `extract_wisdom` |
| `sum` | `summarize` |
| `tm` | `create_threat_model` |
| `ac` | `analyze_claims` |
| `iw` | `improve_writing` |
| `rc` | `review_code` |

**Usage**: `/fabric ew transcript.txt`

---

### 5.3 Output Format Options

**Problem**: Fixed Markdown output may not suit all use cases.

**Proposed Solution**:

Configurable output formats:

```bash
/fabric extract_wisdom --format json
/fabric extract_wisdom --format yaml
/fabric extract_wisdom --format csv
/fabric extract_wisdom --format html
```

---

### 5.4 Pattern Favorites

**Problem**: Frequently used patterns require repeated lookups.

**Proposed Solution**:

Bookmark favorite patterns:

```bash
# Add to favorites
/fabric favorite add extract_wisdom

# List favorites
/fabric favorites

# Quick access
/fabric fav 1  # Run first favorite
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create pattern-index.json with all 248 patterns
- [ ] Implement pattern search functionality
- [ ] Add pattern validation testing

### Phase 2: Core Enhancements (Weeks 3-4)
- [ ] Build pattern recommendation engine
- [ ] Implement custom pattern management
- [ ] Add pattern output caching

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] Create pattern composition framework
- [ ] Implement pattern versioning
- [ ] Build pattern analytics

### Phase 4: Integrations (Weeks 7-8)
- [ ] Voice server integration
- [ ] Task runner integration
- [ ] Observability dashboard panel
- [ ] MCP server implementation

### Phase 5: Polish (Weeks 9+)
- [ ] Interactive pattern mode
- [ ] Pattern shortcuts
- [ ] Output format options
- [ ] Pattern favorites

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Pattern discovery time | ~30s | <5s |
| Correct pattern selection | ~70% | >95% |
| Custom patterns created | 0 | 20+ |
| Pattern execution failures | Unknown | <1% |
| User satisfaction | Unknown | >4.5/5 |

---

## Dependencies

- **Pattern Index**: Requires audit of all 248 patterns
- **Caching**: Requires `.agent/cache/` directory setup
- **Task Runner**: Requires job schema extension
- **Voice Server**: Requires TTS endpoint availability
- **MCP Server**: Requires MCP protocol compliance

---

## Notes

1. All improvements maintain backward compatibility
2. Native execution remains the default (no CLI overhead)
3. Custom patterns stored separately from upstream patterns
4. Update process preserves custom patterns

---

*Document Version: 1.0*
*Created: 2026-01-29*
*Author: Sam PAI*

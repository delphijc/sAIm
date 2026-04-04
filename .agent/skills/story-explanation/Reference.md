# story-explanation Reference Guide

> This is Tier 2 documentation for the story-explanation skill. It's loaded on-demand when you use this skill. For quick routing and examples, see `SKILL.md`.

---

## Skill Philosophy

The story-explanation skill transforms content into compelling narratives. Instead of bullet-point summaries, it creates story-driven explanations that reveal context, causality, and human significance. Using deep thinking (UltraThink) to find the best narrative framing, it produces Daniel's conversational voice across multiple formats.

---

## Workflow Types

### 1. Create Workflow - 3-Part Narrative (Default)

**Best for:** Comprehensive story explanations of articles, research, complex topics

**Workflow Phases:**
1. Activate UltraThink for deep analysis
2. Detect input type (YouTube URL, article URL, file path, text)
3. Gather content from source
4. Determine optimal narrative framing angle
5. Generate 3-part narrative (Setup → Conflict/Development → Resolution/Insight)
6. Archive raw content and output to scratchpad

**Output Format:**
- Conversational narrative in Daniel's voice
- 3 distinct parts with clear transitions
- Natural language flow (not numbered lists)
- Approximately 500-1000 words

**Input Handling:**
- **YouTube URLs** → Extract transcript via Fabric (`fabric -y "URL"`)
- **Article/Blog URLs** → Fetch via WebFetch
- **File Paths** → Read directly
- **Raw Text** → Use as provided
- **Previous Output** → Reference in conversation

**Narrative Framing Options:**
- Systems thinking (how parts interconnect)
- Economic forces (what drives decisions)
- Technical breakthrough (innovation journey)
- Human impact (who is affected and how)
- Temporal arc (before/during/after)

### 2. CreateWithLinks Workflow - Multi-Part with Citation

**Best for:** Research-heavy narratives that need source attribution

**Advantages:**
- Preserves inline citations to original sources
- Maintains reference links throughout narrative
- Better for fact-sensitive content
- Supports footnotes and bibliography

**Output Format:**
- 3-part narrative with embedded [link references]
- Allows reader to verify claims
- Bibliography section at end
- Approximately 600-1200 words

### 3. CreateAbridged Workflow - 5-Line Condensed

**Best for:** Quick narrative overviews, social media, rapid briefings

**Format Constraints:**
- Exactly 5 lines
- 5-12 words per line (ultra-concise)
- One core idea per line
- Strict word economy

**Line Structure:**
1. The Setup (what is this about?)
2. The Context (why does it matter?)
3. The Problem/Tension (what's at stake?)
4. The Resolution/Insight (what changed?)
5. The Implication (what comes next?)

**Output Format:**
- Minimal, punchy prose
- Maximum impact per word
- Approximately 40-60 words total

**Example 5-line output:**
```
Tesla disrupted automotive manufacturing with electric vehicles.
Traditional carmakers faced obsolescence as battery tech improved.
Full self-driving capability became the next frontier.
Legacy automakers began electric conversions to survive.
Electric vehicles are now reshaping transportation and energy systems.
```

### 4. CSE Workflow - Claude Search Engine Powered

**Best for:** Fact-checked narratives requiring current/verified information

**Methodology:**
1. Detect input content
2. Extract key claims and assertions
3. Cross-reference with Claude Search Engine (CSE)
4. Verify or correct facts
5. Generate narrative with verified information
6. Flag any uncertain or unverifiable claims

**Output Format:**
- Full narrative with fact verification
- Claims marked as verified vs. uncertain
- Sources cited for important facts
- Approximately 400-800 words

**Customizable Output Length:**
- Default: 8 lines
- Range: 3-50 lines
- Format: `Create 24-line CSE narrative from content`

### 5. CSE5 Workflow - 5-Line Fact-Checked

**Best for:** Quick verified summaries when accuracy is critical

**Combines:** CreateAbridged's conciseness + CSE's fact-checking

**Output Format:**
- 5-line narrative
- 5-12 words per line
- Verified facts only
- Flags uncertain claims
- Approximately 40-60 words

---

## Content Gathering Methodology

### Input Detection

**URL Recognition:**
- YouTube: `youtube.com` or `youtu.be` in URL
- Article: Starts with `http://` or `https://`
- File: Absolute path (e.g., `/Users/...` or `./relative/path`)
- Raw text: Everything else

### Content Fetching

**YouTube Videos:**
```bash
# Uses Fabric to extract and summarize transcript
fabric -y "https://youtube.com/watch?v=..."
```

**Web Articles/Blogs:**
```
WebFetch(url, "Extract full content for narrative analysis")
```

**Local Files:**
```
Read(file_path)
```

**Pasted Content:**
- Parse directly from user input
- No fetching required

**Previous Conversation Output:**
- Reference earlier messages by timestamp or description
- Extract relevant sections

### Scratchpad Archival

Each storytelling execution creates a timestamped directory:

```
${PAI_DIR}/scratchpad/
  └── YYYY-MM-DD-HHMMSS_story-explanation-[topic]/
      ├── raw-content.txt          # Original source material
      ├── narrative-output.md      # Generated story
      ├── framing-analysis.md      # UltraThink analysis
      └── metadata.json            # Processing metadata
```

---

## Narrative Framing with UltraThink

### Deep Thinking Process

1. **Content Analysis** - Identify themes, causality, key actors
2. **Audience Consideration** - Who needs to understand this?
3. **Framing Selection** - Which narrative angle serves best?
4. **Story Arc Design** - Setup, tension, resolution structure
5. **Voice Calibration** - Maintain conversational, accessible tone

### Available Framing Angles

- **Systems Thinking:** How do components interact? What's the structure?
- **Economic:** What are financial/resource incentives driving events?
- **Technical:** How does innovation work? What's the breakthrough?
- **Human:** Who is affected? What are emotions and stakes?
- **Temporal:** What's the before/during/after journey?
- **Causal:** Why did this happen? What led to what?
- **Comparative:** How does this compare to alternatives or history?

### Selecting Framing

- **Explicit Request:** Honor user's specified angle
- **Auto-Detection:** UltraThink analyzes content and recommends optimal framing
- **Context-Aware:** Considers conversation history and user's previous interests

---

## Output Characteristics

### Daniel's Conversational Voice

- First/second person where natural ("We see...", "You might wonder...")
- Accessible explanations (avoid jargon without context)
- Engaging tone (questions, observations, analogies)
- Natural sentence flow (not outline-like)
- Tells a story, not a report

### Quality Markers

- **Clarity:** Complex ideas explained simply
- **Completeness:** Covers setup, development, and resolution
- **Connection:** Shows how ideas relate (causality, consequence)
- **Humanity:** Includes people, impacts, and stakes
- **Insight:** Reveals "so what?" and implications

---

## Usage Examples by Scenario

**Scenario 1: Quick YouTube Summary**
```
User: "5-line story of this TED talk"
→ Activates CreateAbridged
→ Extracts YouTube transcript
→ Generates 5 concise narrative lines
```

**Scenario 2: Research Article with Sources**
```
User: "Tell me the story with links"
→ Activates CreateWithLinks
→ WebFetches article
→ Generates narrative with inline citations
```

**Scenario 3: Fact-Checked News Analysis**
```
User: "What's the verified story here?"
→ Activates CSE
→ Checks claims via Claude Search Engine
→ Returns fact-verified narrative
```

**Scenario 4: File-Based Content**
```
User: "Create a narrative from my research notes at /path/to/notes.md"
→ Reads file
→ Applies UltraThink analysis
→ Generates 3-part story explanation
```

---

## Key Principles

1. **Story First** - Narrative structure over information density
2. **Deep Thinking** - UltraThink finds the best framing, not first-pass analysis
3. **Multiple Formats** - One idea can be told in 3-part, 5-line, or verified formats
4. **Source Flexible** - YouTube, URLs, files, or text all work seamlessly
5. **Archival Ready** - Every story is saved to scratchpad for future reference
6. **Conversational Tone** - Daniel's voice remains consistent across all workflows



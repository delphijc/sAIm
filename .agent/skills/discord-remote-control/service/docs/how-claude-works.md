# How Claude Code Works: Tool Calls & Function Search

A visual guide for newcomers to understand how Claude Code processes requests,
searches for functions, and executes tool calls.

---

## The Big Picture

```
+------------------------------------------------------------------+
|                        USER PROMPT                                |
|  "Find all TODO comments in the codebase and fix them"            |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    CLAUDE CODE (LLM Brain)                        |
|                                                                   |
|  1. Parse intent: "search codebase" + "modify files"              |
|  2. Select tools:  Grep (search) + Edit (modify)                  |
|  3. Plan execution order (dependencies matter!)                   |
+------------------------------------------------------------------+
                              |
                              v
              +---------------+---------------+
              |                               |
              v                               v
     +----------------+             +------------------+
     |   TOOL CALL 1  |             |   TOOL CALL 2    |
     |                |             |   (waits for 1)  |
     |  Grep:         |             |                  |
     |  pattern="TODO"|  -------->  |  Edit:           |
     |  path="src/"   |  results    |  file="found.ts" |
     |                |  inform     |  changes=[...]   |
     +----------------+  next call  +------------------+
              |                               |
              v                               v
     +----------------+             +------------------+
     |    RESULTS 1   |             |    RESULTS 2     |
     | src/app.ts:42  |             | File updated     |
     | src/lib.ts:17  |             | successfully     |
     +----------------+             +------------------+
                              |
                              v
+------------------------------------------------------------------+
|                     RESPONSE TO USER                              |
|  "Found 2 TODOs. Fixed both - here's what I changed..."          |
+------------------------------------------------------------------+
```

---

## Available Tools & When They're Used

```
+==================================================================+
|                     CLAUDE CODE TOOLBOX                           |
+==================================================================+
|                                                                   |
|  FILE OPERATIONS          SEARCH OPERATIONS                       |
|  +--------------+         +--------------+                        |
|  | Read         |         | Grep         |                        |
|  | Read a file  |         | Search file  |                        |
|  | by path      |         | contents     |                        |
|  +--------------+         +--------------+                        |
|  | Edit         |         | Glob         |                        |
|  | Modify parts |         | Find files   |                        |
|  | of a file    |         | by pattern   |                        |
|  +--------------+         +--------------+                        |
|  | Write        |         | Agent        |                        |
|  | Create new   |         | Deep explore |                        |
|  | files        |         | (subagent)   |                        |
|  +--------------+         +--------------+                        |
|                                                                   |
|  EXECUTION               PLANNING                                 |
|  +--------------+         +--------------+                        |
|  | Bash         |         | TodoWrite    |                        |
|  | Run shell    |         | Track tasks  |                        |
|  | commands     |         | & progress   |                        |
|  +--------------+         +--------------+                        |
|  | Skill        |         | WebFetch     |                        |
|  | Invoke SAM   |         | Fetch URLs   |                        |
|  | skills       |         | for content  |                        |
|  +--------------+         +--------------+                        |
|                                                                   |
+==================================================================+
```

---

## How Tool Selection Works

```
  User: "What does the router do?"
         |
         v
  +-------------------------------+
  | INTENT ANALYSIS               |
  |                               |
  | Keywords: "what", "router"    |
  | Action:   UNDERSTAND code     |
  | Scope:    Single file/module  |
  +-------------------------------+
         |
         v
  +-------------------------------+
  | TOOL SELECTION LOGIC          |
  |                               |
  | Need to find file?            |
  |   YES --> Glob("**/router*")  |
  |                               |
  | Need to read file?            |
  |   YES --> Read(found_path)    |
  |                               |
  | Need to modify?               |
  |   NO  --> Skip Edit/Write     |
  +-------------------------------+
         |
         v
  +-------------------------------+      +-------------------------------+
  | STEP 1: Glob                  |      | STEP 2: Read                  |
  |                               |      |                               |
  | Pattern: "**/router*"         | ---> | Path: "service/router.ts"     |
  | Result:  service/router.ts    |      | Result: <file contents>       |
  +-------------------------------+      +-------------------------------+
                                                    |
                                                    v
                                         +-------------------------------+
                                         | RESPONSE                      |
                                         |                               |
                                         | "The router handles incoming  |
                                         |  Discord messages and routes  |
                                         |  them to the appropriate..."  |
                                         +-------------------------------+
```

---

## Parallel vs Sequential Tool Calls

This is a key concept - Claude Code optimizes by running independent
operations in parallel, but respects dependencies.

```
  PARALLEL (no dependencies)          SEQUENTIAL (has dependencies)
  ============================        ============================

  User: "Check git status             User: "Read config.ts and
         and list test files"                 fix the port number"

         |                                    |
    +----+----+                               v
    |         |                        +-------------+
    v         v                        | Read        |
  +------+ +------+                    | config.ts   |
  | Bash | | Glob |                    +-------------+
  | git  | | **/* |                           |
  | stat | | test |                           v  (needs content first)
  +------+ +------+                    +-------------+
    |         |                        | Edit        |
    +----+----+                        | config.ts   |
         |                             | port: 3000  |
         v                             +-------------+
    Combined                                  |
    Response                                  v
                                        Response
```

---

## The Deferred Tool Pattern

Some tools aren't loaded by default - they must be discovered first.

```
  +------------------------------------------------------------------+
  |  DEFERRED TOOLS (not loaded until requested)                      |
  |                                                                   |
  |  Examples: Playwright, MCP tools, specialized integrations        |
  +------------------------------------------------------------------+
         |
         |  Must use ToolSearch FIRST
         v
  +------------------------------------------------------------------+
  | ToolSearch                                                        |
  |                                                                   |
  |  Mode 1: Keyword Search          Mode 2: Direct Select            |
  |  query: "browser testing"        query: "select:NotebookEdit"     |
  |  --> Returns matching tools      --> Loads specific tool           |
  |  --> All returned tools are      --> Ready to use immediately      |
  |      immediately available                                        |
  +------------------------------------------------------------------+
         |
         v
  +------------------------------------------------------------------+
  | Tool is now loaded and callable                                   |
  |                                                                   |
  |  mcp__playwright__browser_navigate("https://...")                  |
  +------------------------------------------------------------------+
```

---

## Real-World Example: Bug Fix Flow

```
  User: "The voice handler crashes on empty messages"
         |
         v
  [1] Grep: Search for error pattern
      pattern: "voice.*handler|handleVoice"
      --> Found: handlers/voice.ts
         |
         v
  [2] Read: Understand the code
      path: "handlers/voice.ts"
      --> Sees no null check on message content
         |
         v
  [3] Read: Check existing tests        (parallel)
      path: "__tests__/voice.test.ts"    +----------+
      --> Sees no empty message test      |          |
         |                                v          |
         |                          [3b] Read:       |
         |                          Related files    |
         |                          for context      |
         |                                |          |
         +----------------+---------------+          |
                          |                          |
                          v                          |
  [4] Edit: Add null check to voice.ts               |
      old: "const content = msg.content"             |
      new: "const content = msg.content ?? ''"       |
         |                                           |
         v                                           |
  [5] Edit: Add test case                            |
      file: "__tests__/voice.test.ts"                |
      adds: test("handles empty message", ...)       |
         |
         v
  [6] Bash: Run tests
      command: "bun test voice"
      --> All tests pass
         |
         v
  Response: "Fixed! Added null check at line 42
             and a new test case. All tests pass."
```

---

## Key Takeaways

1. **Claude Code doesn't guess** - it reads files before modifying them
2. **Tools are chosen by intent** - search vs read vs modify vs execute
3. **Parallel when possible** - independent operations run simultaneously
4. **Sequential when needed** - dependent operations wait for predecessors
5. **Deferred tools require discovery** - use ToolSearch before calling them
6. **Dedicated tools over Bash** - Read over `cat`, Grep over `grep`, Edit over `sed`

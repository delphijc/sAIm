# Backlog Integration Implementation Plan

**Prepared by**: Sam  
**Date**: 2026-04-27  
**Status**: Ready for Implementation  

---

## Executive Summary

You have four autonomous processes that independently detect enhancement opportunities but never feed them into a centralized backlog system:

1. **Heartbeat** — Detects git issues (uncommitted changes, stale branches, idle projects) every 6 hours
2. **Weekly Strategy** — Performs deep strategic analysis, identifies priorities, quick wins, risks
3. **Daily Journal** — Generates narrative insights from semantic memories (daily)
4. **Memory Lifecycle** — Runs consolidation and could extract health metrics (nightly)

**This plan connects all four to a unified backlog**, with the ability for you to mark items as **done**, **duplicate**, or **won't implement** so we stop rehashing settled decisions.

---

## Part 1: Enhance the Backlog Manager

### New Status Values

Add three new terminal statuses to `manage-backlog.sh`:

```bash
# Current (working):
pending        → Item discovered, awaiting review
in_progress    → Currently being worked on
completed      → Work finished successfully
approved       → Approved for autonomous execution
skipped        → Explicitly deferred

# New (proposed):
done           → Already completed (before we tracked it)
duplicate      → Same as another item (reference in notes)
wont-implement → Explicitly rejected by you (reason in notes)
```

### Extend manage-backlog.sh Commands

Add these new commands:

```bash
# Mark an item as already done (with optional proof)
manage-backlog.sh mark-done --id ENH-042 --evidence "Completed in commit abc123"

# Mark as a duplicate (link to original)
manage-backlog.sh mark-dupe --id ENH-042 --original ENH-035 --reason "Same scope"

# Mark as won't implement (with justification)
manage-backlog.sh mark-reject --id ENH-042 --reason "Out of scope for Phase 1"

# Query by lifecycle state
manage-backlog.sh list --status done
manage-backlog.sh list --status duplicate
manage-backlog.sh list --status wont-implement
```

### Add Notes Field

Each backlog item now has an optional `notes` field:

```json
{
  "id": "ENH-042",
  "title": "Prune stale branches",
  "status": "duplicate",
  "notes": "Same as ENH-035 — added to weekly strategy, already handled",
  "created": "2026-04-27",
  "marked_lifecycle": "2026-04-27",
  ...
}
```

---

## Part 2: Heartbeat Integration

### Where Heartbeat Detects Opportunities

The `pai-heartbeat` script already identifies these patterns:

| Pattern | Current Behavior | Proposed Action |
|---------|------------------|-----------------|
| Uncommitted on main/master | Logged as attention item | → Add P1 backlog item |
| Large feature branch (5+ files) | Logged as attention item | → Add P2 backlog item |
| Project idle 3+ days | Logged as attention item | → Add P2 backlog item |
| Stale branches (14+ days old) | Logged as attention item | → Add P3 backlog item |

### Implementation

After line 300 (after attention items are built), add:

```bash
function heartbeat_feed_backlog() {
  # Extract unique git issues from attention_items
  # For each: manage-backlog.sh add \
  #   --title "$(extract_issue)" \
  #   --priority P1|P2|P3 \
  #   --source "heartbeat" \
  #   --description "Found during pulse check at HH:MM" \
  #   --effort "M" \
  #   --engine "both"
  
  # Before adding, check if similar item exists
  # If yes, mark as duplicate instead
}

# Call in main() after attention section is built
heartbeat_feed_backlog
```

**Result**: Heartbeat runs every 6 hours → feeds 2-5 items per run → backlog grows with actionable git issues

**Deduplication**: Same issue detected 4x daily? Only add once, skip repeats.

---

## Part 3: Weekly Strategy Integration

### Where Weekly Strategy Detects Opportunities

The Claude analysis produces six sections. Three are gold:

| Section | Examples | Backlog Priority |
|---------|----------|------------------|
| **Quick Wins** | "Auto-sync memory graphs", "Add missing error handling" | P1, effort S |
| **Top 3 Priorities** | "Ship memory consolidation", "Fix jay-gentic routing" | P0-P1, varies |
| **Risks & Blockers** | "Discord bot timeout on large queries", "Memory growth unbounded" | P1, varies |

### Implementation

After line 438 (after Claude analysis completes), add:

```bash
function strategy_extract_backlog_items() {
  # Parse STRATEGY_SECTION for:
  # 1. Extract each numbered item from "## Top 3 Priorities"
  #    → manage-backlog.sh add --priority P0 --effort L
  
  # 2. Extract "## Quick Wins" bullets
  #    → manage-backlog.sh add --priority P1 --effort S
  
  # 3. Extract "## Risks & Blockers" bullets
  #    → manage-backlog.sh add --priority P1 --effort varies
  
  # Deduplicate: if similar item exists, mark as duplicate
}

# Call in main() after strategy section is built
strategy_extract_backlog_items
```

**Result**: Weekly strategy runs Sunday → feeds 3-8 items → backlog gains strategic priorities

---

## Part 4: Discord Management Interface

### New Commands for discord-remote-control

The bot (in `.agent/skills/discord-remote-control/service/`) should recognize:

```
sam backlog status ENH-042
  → Returns: [P1] "Prune stale branches" | pending | Added by heartbeat 3h ago

sam backlog next
  → Returns: The next highest-priority pending item ready to start

sam backlog pending
  → Returns: List of all pending items with date added, source, priority

sam backlog done ENH-042 "Completed in commit abc123d"
  → Marks as done, stores evidence in notes

sam backlog dupe ENH-042 ENH-035
  → Marks 042 as duplicate of 035, prevents reprocessing

sam backlog reject ENH-042 "Out of scope for Q2"
  → Marks won't-implement, stores reason, removed from pending

sam backlog sources
  → Shows breakdown: "5 from heartbeat, 3 from strategy, 2 from you"
```

### Implementation Location

File: `.agent/skills/discord-remote-control/service/commands/backlog-command.ts` (create if doesn't exist)

```typescript
interface BacklogCommand {
  status(id: string): Promise<string>
  next(): Promise<string>
  pending(): Promise<string>
  done(id: string, evidence: string): Promise<void>
  dupe(id: string, original: string): Promise<void>
  reject(id: string, reason: string): Promise<void>
  sources(): Promise<string>
}

// Each command calls manage-backlog.sh under the hood
// Returns formatted Discord embeds
```

---

## Part 5: Daily Journal Integration

### Where Daily Journal Could Detect Opportunities

The `pai-memory-journal` script generates a narrative from semantic memories. After narrative generation, we can extract:

- **"Pattern detected"** → Items for investigation
- **"Duplicate knowledge found"** → Items for consolidation
- **"Graph anomaly: isolated cluster"** → Items for exploration

### Implementation

Modify `.agent/bin/pai-memory-journal`:

```bash
# After line 36 (daily-journal.ts runs successfully):

function journal_extract_insights() {
  # Query memory-system for today's insights
  # If "pattern detected in X", add backlog item
  # If "duplicates consolidated", add item
  
  # Call manage-backlog.sh add for each insight
}

journal_extract_insights
```

**Result**: Daily journal runs at 23:30 → feeds 1-3 items → backlog tracks memory patterns

---

## Part 6: Memory Lifecycle Integration

### Where Memory Lifecycle Could Detect Opportunities

After consolidation completes, memory-system has:

- Count of duplicates merged
- Graph health metrics
- Association strength anomalies

### Implementation

Modify `.agent/bin/pai-memory-lifecycle` after consolidation:

```bash
# After line 45 (consolidation completes):

function lifecycle_extract_maintenance() {
  # Query memory-system /health endpoint
  # If "X duplicates merged", add P2 item
  # If "graph health: X%", add investigation item if <90%
  
  # Call manage-backlog.sh add for each finding
}

lifecycle_extract_maintenance
```

**Result**: Memory lifecycle runs nightly → feeds 0-2 items → backlog tracks system health

---

## Part 7: Deduplication Strategy

**Problem**: Heartbeat sees uncommitted changes on `jay-gentic` every 6 hours. Without deduplication, we'd add the same item 28 times a week.

**Solution**: Before `manage-backlog.sh add`, check for existing items:

```bash
function is_duplicate_item() {
  local new_title="$1"
  local source="$2"
  local target_project="$3"
  
  # Query backlog for items with:
  # - Similar title (fuzzy match, 80%+)
  # - Same source
  # - Same project (if applicable)
  # - Status NOT in (done, wont-implement, duplicate)
  
  # If found, return the ID; else return ""
}

# Before adding:
if existing=$(is_duplicate_item "$title" "$source" "$project"); then
  # Item already pending, skip (or update created timestamp)
  return
else
  # New item, add it
  manage-backlog.sh add ...
fi
```

**Fuzzy Match Example**:
- "Prune stale branches in jay-gentic" vs "Clean up old branches" → 85% match → Skip
- "Uncommon missing changes on main" vs "Commit pending work on master" → 72% match → Add (different enough)

---

## Implementation Timeline

### Week 1 (April 27 - May 3)

- [ ] **Day 1**: Enhance manage-backlog.sh with new statuses + mark-done/mark-dupe/mark-reject commands
- [ ] **Day 2**: Implement heartbeat → backlog integration (test with --dry-run first)
- [ ] **Day 3**: Implement weekly strategy → backlog integration (run on next Sunday)
- [ ] **Day 4**: Create Discord `/backlog` command interface
- [ ] **Day 5**: Test full loop: heartbeat → backlog → Discord management

### Week 2 (May 4 - May 10)

- [ ] **Day 1**: Implement daily journal → backlog integration
- [ ] **Day 2**: Implement memory lifecycle → backlog integration
- [ ] **Day 3**: Add deduplication logic to all four processes
- [ ] **Day 4**: Create `/backlog sources` and `/backlog stats` reports
- [ ] **Day 5**: Performance testing + optimization

### Week 3 (May 11 - May 17)

- [ ] **Day 1**: Real-world validation: Monitor backlog growth, dedup accuracy
- [ ] **Days 2-4**: Iterate on Discord UX based on feedback
- [ ] **Day 5**: Documentation + runbooks for maintainers

---

## Success Metrics

After 2 weeks of operation:

| Metric | Target | Current |
|--------|--------|---------|
| Items per week from heartbeat | 10-20 | 0 |
| Items per week from strategy | 3-8 | 0 |
| Duplicate rate | <5% | N/A |
| Items marked done/dupe/reject | 20-30 | 0 |
| Time to triage via Discord | <30 sec | N/A |
| Backlog accuracy (relevance) | >85% | N/A |

---

## Discord Command Examples

### User Reviews Pending Items

```
User: sam backlog pending

Sam: 📋 **Pending Backlog Items** (6 total)

[P0] ENH-001 — "Deploy memory consolidation" (L effort, from weekly-strategy)
     Added: 2 days ago | Approx. 4 hours of work

[P1] ENH-002 — "Prune stale branches in jay-gentic" (M effort, from heartbeat)
     Added: 6 hours ago | Approx. 30 minutes of work

[P1] ENH-003 — "Fix timeout in discord-remote-control" (M effort, from heartbeat)
     Added: 12 hours ago | Approx. 1 hour of work

[P2] ENH-004 — "Investigate memory graph anomaly" (L effort, from memory-lifecycle)
     Added: 18 hours ago | Under investigation

[P2] ENH-005 — "Document jay-gentic routing" (L effort, from weekly-strategy)
     Added: 2 days ago | Approx. 2 hours of work

[P3] ENH-006 — "Archive old awareness dashboards" (XL effort, from heartbeat)
     Added: 3 days ago | Approx. 6+ hours of work

**Actions**: sam backlog done ENH-001 | sam backlog next | sam backlog reject ENH-006 "Not priority"
```

### User Marks Items as Done/Dupe/Reject

```
User: sam backlog done ENH-002 "Already handled in commit d42f3c9"
Sam: ✅ ENH-002 marked as done | Evidence: "Already handled in commit d42f3c9"

---

User: sam backlog dupe ENH-005 ENH-001
Sam: 🔗 ENH-005 marked as duplicate of ENH-001 | Both about memory consolidation docs

---

User: sam backlog reject ENH-006 "Out of scope for PAI phase"
Sam: ❌ ENH-006 marked won't-implement | Reason: "Out of scope for PAI phase"
```

---

## Rollback Plan

If something goes wrong:

1. **Stop item creation**: Disable backlog integration in each process with flag
   ```bash
   # In each .agent/bin/pai-*:
   BACKLOG_ENABLED="${BACKLOG_ENABLED:-false}"
   if [[ "$BACKLOG_ENABLED" == "false" ]]; then return; fi
   ```

2. **Preserve history**: Backlog JSONL is immutable (append-only). No data loss.

3. **Reset**: `rm ~/.claude/enhancement-backlog.jsonl` (start fresh)

4. **Disable Discord**: Comment out backlog commands in discord-remote-control

---

## Open Questions for You

1. **Discovery trigger**: Should heartbeat feed items on *every run*, or only if no active session?
   - Current: Only when idle (lines 650-656)
   - Alternative: Always feed, let you triage via Discord

2. **Weekly strategy priority**: Should all items from "Top 3 Priorities" be P0 or P1?
   - Suggestion: P0 for strategic priorities, P1 for quick wins

3. **Backlog review cadence**: Daily? Weekly? Monthly?
   - Suggestion: Weekly (Monday morning) via Discord + monthly deep review

4. **Archive old items**: After 90 days with status=pending, should we auto-archive or ask?
   - Suggestion: Ask you via Discord before archiving

5. **Private items**: Should any items be private (not shared in Discord)?
   - Suggestion: All items visible (full transparency), you can mark as sensitive in notes

---

## Next Steps

1. **Review** this plan — any changes before we start?
2. **Approve** Phase 1 (enhance manage-backlog.sh)
3. **I'll implement** in order: backlog → heartbeat → strategy → discord → daily/lifecycle
4. **You test** each phase with `/backlog` commands in Discord
5. **Iterate** based on what works / what doesn't

Ready? 🚀

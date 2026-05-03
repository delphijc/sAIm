# Backlog Integration — Quick Reference

## The Four Processes & Their Enhancement Detection

```
┌─────────────────────┐
│  PAI HEARTBEAT      │  Every 6 hours
│  (Git Health Check) │
└──────────┬──────────┘
           │
           ├─ Uncommitted changes on main → "Commit pending work"
           ├─ Large feature branches → "Too many WIP files"
           ├─ Idle projects (3+ days) → "Review inactive project"
           └─ Stale branches → "Prune old branches"
           
           ↓ [NEW] Feed to backlog

┌─────────────────────┐
│ WEEKLY STRATEGY     │  Every Sunday
│ (Strategic Analysis)│
└──────────┬──────────┘
           │
           ├─ From Claude's "Top 3 Priorities" → P0 items
           ├─ From Claude's "Quick Wins" → P1 items (effort: S)
           ├─ From Claude's "Risks & Blockers" → P1 items (varies)
           └─ From Claude's "Architecture Insights" → P2 items
           
           ↓ [NEW] Feed to backlog

┌─────────────────────┐
│ DAILY JOURNAL       │  Daily at 23:30
│ (Memory Narrative)  │
└──────────┬──────────┘
           │
           ├─ "Pattern detected in X" → "Investigate pattern"
           ├─ "Duplicates consolidated" → "Memory quality item"
           └─ "Graph anomaly found" → "Review memory health"
           
           ↓ [NEW] Feed to backlog

┌─────────────────────┐
│ MEMORY LIFECYCLE    │  Nightly
│ (Maintenance)       │
└──────────┬──────────┘
           │
           ├─ Consolidation summary → "Memory maintenance items"
           └─ Graph health check → "System health items"
           
           ↓ [NEW] Feed to backlog
           
           ↓ ↓ ↓ ↓

         BACKLOG
    (Enhancement Queue)
         ↓ ↓ ↓
   
    You review via Discord:
    - /backlog pending → What's waiting?
    - /backlog next → What should I do first?
    - /backlog done ENH-042 → Already completed
    - /backlog dupe ENH-042 ENH-035 → Duplicate
    - /backlog reject ENH-042 → Won't do
```

---

## Backlog Item Lifecycle

```
CREATED              REVIEW              ACTION              ARCHIVED
(by process)         (by you)            (start work)        (outcome)

pending      ──✓──→  [user reviews]      in_progress    ──✓──→  completed
    ↓                      ↓                                        
    │                  You decide:                                 
    │                  - Done already?    ──────────→  done        
    │                  - Duplicate?       ──────────→  duplicate   
    │                  - Won't do?        ──────────→  wont-impl   
    │                  - Approve for auto? ──────────→  approved   
    │                                                               
    └──────────────────────────────────────────────────────────→  skipped
```

---

## Three New Statuses (with Discord commands)

### 1. `done` — "Already Completed"

```
Use when: You finished this work BEFORE we added backlog tracking

Example:
  User: sam backlog done ENH-042 "Completed in commit d42f3c9"
  Result: ENH-042 is archived, won't be suggested again
  
  Notes field: "Already done — evidence: commit d42f3c9"
```

### 2. `duplicate` — "Same as Another Item"

```
Use when: Item ENH-042 is the same as ENH-035

Example:
  User: sam backlog dupe ENH-042 ENH-035
  Result: ENH-042 marked as duplicate of ENH-035
          Won't be suggested, won't confuse the queue
  
  Notes field: "Duplicate of ENH-035 — both about memory consolidation"
```

### 3. `wont-implement` — "Explicitly Rejected"

```
Use when: We decided NOT to do this, should stop surfacing it

Example:
  User: sam backlog reject ENH-042 "Out of scope for Phase 1"
  Result: ENH-042 archived, won't be suggested again
  
  Notes field: "Won't implement — reason: Out of scope for Phase 1"
```

---

## Deduplication Example

**Scenario**: Heartbeat runs every 6 hours. It detects "Uncommitted changes on main" in `sam` project.

**Without deduplication**:
- Run 1 (6am): Adds "Commit pending changes in sam" → ENH-001
- Run 2 (12pm): Adds "Commit pending changes in sam" → ENH-002
- Run 3 (6pm): Adds "Commit pending changes in sam" → ENH-003
- Run 4 (12am): Adds "Commit pending changes in sam" → ENH-004

**Result**: Backlog polluted with 28 identical items per week 🚫

**With deduplication**:
- Run 1 (6am): Adds "Commit pending changes in sam" → ENH-001
- Run 2 (12pm): Detects existing ENH-001 (same title, source, project) → Skip
- Run 3 (6pm): Detects existing ENH-001 → Skip
- Run 4 (12am): Detects existing ENH-001 → Skip

**Result**: One clean item per issue, stays pending until you act on it ✅

---

## Discord Commands Cheat Sheet

```
# Check status
sam backlog status ENH-042          → Returns item details
sam backlog next                    → Next highest-priority item
sam backlog pending                 → All items waiting for you

# Mark as done/dupe/reject
sam backlog done ENH-042 "evidence"           → Mark as done
sam backlog dupe ENH-042 ENH-035              → Mark as duplicate
sam backlog reject ENH-042 "reason"           → Mark won't-implement

# Get insights
sam backlog sources                 → Breakdown: 5 from heartbeat, 3 from strategy
sam backlog stats                   → P0: 2, P1: 5, P2: 8, P3: 3 | Avg age: 4.2 days
```

---

## Why This Matters

**Before**:
- Heartbeat logs issues but never escalates them → You miss 90% of findings
- Weekly strategy creates priorities but they're buried in a markdown file
- No way to say "done" or "duplicate" → Same issues re-raised every week

**After**:
- All four processes feed a **centralized opportunity queue**
- You have **ONE place** to see everything waiting (`/backlog pending`)
- You can **instantly mark items** (done/dupe/reject) to reduce noise
- **Deduplication** prevents the same issue surfacing 28 times per week
- **Audit trail** shows what came from where (heartbeat/strategy/journal/lifecycle)

---

## Status Quo vs. New System

| Question | Current | With Backlog Integration |
|----------|---------|--------------------------|
| Where are the enhancement opportunities? | Scattered: heartbeat report, strategy markdown, journal, lifecycle log | One place: `/backlog pending` |
| How do I say "I already did this"? | No mechanism | `/backlog done ENH-042` |
| How do I say "duplicate"? | No mechanism | `/backlog dupe ENH-042 ENH-035` |
| How do I say "won't implement"? | No mechanism | `/backlog reject ENH-042` |
| Can heartbeat waste my time with repeats? | Yes, same issue 28x/week | No, dedup prevents it |
| Do I know what came from where? | Hard to trace | Yes, each item has `source` field |
| Can I prioritize cross-source? | No, they're isolated | Yes, via priority P0-P3 |

---

## Implementation Order

1. **Enhance backlog manager** (manage-backlog.sh)
   - Add new statuses
   - Add mark-done/mark-dupe/mark-reject commands
   - Add notes field

2. **Heartbeat integration** (first big feed)
   - Extract git issues → backlog items
   - Deduplicate on repeated runs

3. **Weekly strategy integration** (second big feed)
   - Parse Claude response sections → backlog items

4. **Discord commands** (your interface)
   - /backlog status, /backlog next, /backlog pending
   - /backlog done, /backlog dupe, /backlog reject

5. **Daily journal integration** (smaller feed)
   - Extract memory insights → backlog items

6. **Memory lifecycle integration** (smaller feed)
   - Extract health metrics → backlog items

**Total effort**: ~40-50 hours over 2-3 weeks

---

## What Could Go Wrong (& How We Handle It)

| Risk | Prevention |
|------|-----------|
| Runaway item creation (10k+) | Limit each process to top 5 items per run |
| Backlog becomes noise | Dedup + require you to triage weekly |
| Stale items never reviewed | Monthly `/backlog stats` reminder |
| Lost context (why was this added?) | Every item has description + source + date |
| Process crashes → no items added | Each feed has `|| log WARNING` guard |
| Discord bot crash | Items still in JSONL, can query via CLI |
| Duplicate dedup logic fails | You can manually mark duplicates via Discord |

---

## Questions We Need Answered

**Q1**: Should heartbeat feed items when you have active sessions (Claude/jay-gentic)?
- Current: No (only when idle)
- Alternative: Yes, let you triage via Discord

**Q2**: What's the backlog review cadence?
- Suggestion: Weekly (Monday morning) + monthly deep review

**Q3**: Should old pending items auto-archive after 90 days?
- Suggestion: Ask you via Discord before archiving

**Q4**: All items visible in Discord, or should some be private?
- Suggestion: All transparent, you can note sensitive items

---

**Ready to dive in? Let me know if you want me to:**
- [ ] Start Phase 1 (enhance manage-backlog.sh)
- [ ] Create test scenarios first
- [ ] Refine any of the above

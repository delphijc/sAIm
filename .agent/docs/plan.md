# Backlog Integration System — Implementation Plan

**Status**: In Progress  
**Started**: 2026-04-27  
**Estimated Completion**: 2026-05-17 (3 weeks)  
**Total Effort**: ~40-50 hours  

---

## Overview

Integrate four autonomous enhancement discovery processes (heartbeat, weekly-strategy, daily-journal, memory-lifecycle) into a unified backlog system with lifecycle management (done, duplicate, won't-implement).

**Key Features:**
- ✅ New status values for closed items (done, duplicate, wont-implement)
- ✅ Notes field for audit trail and context
- ✅ Deduplication logic to prevent rehashing
- ✅ Discord commands for triage (backlog status, done, dupe, reject, pending, next, sources)
- ✅ Integration of all four discovery processes
- ✅ Reporting and analytics

---

## Task Breakdown

### Phase 1: Week 1 (April 27 - May 3)

**Goal**: Core infrastructure + heartbeat + strategy + Discord interface

#### [✅] Enhance manage-backlog.sh
- [✅] Add new statuses: `done`, `duplicate`, `wont-implement` to schema
- [✅] Add `notes` field to all backlog items
- [✅] Implement `mark-done` command: `manage-backlog.sh mark-done --id ENH-042 --evidence "..."`
- [✅] Implement `mark-dupe` command: `manage-backlog.sh mark-dupe --id ENH-042 --original ENH-035 --reason "..."`
- [✅] Implement `mark-reject` command: `manage-backlog.sh mark-reject --id ENH-042 --reason "..."`
- [✅] Add list filtering by new statuses
- [✅] Create comprehensive test suite (25 tests, all passing)

**Task ID**: ENUM-001  
**Effort**: ~8 hours  
**Completed**: 2026-04-27  

#### [✅] Heartbeat Integration
- [✅] Add `heartbeat_feed_to_backlog()` function to `.agent/bin/pai-heartbeat`
- [✅] Extract 4 issue types as backlog items (uncommitted, large branches, idle projects, stale branches)
- [✅] Implement deduplication: check for existing items before adding
- [✅] Uses `is_duplicate_backlog_item()` for duplicate detection
- [✅] Guards against active sessions before feeding

**Task ID**: ENUM-002  
**Effort**: ~6 hours  
**Completed**: 2026-04-27 (already implemented)  

#### [✅] Weekly Strategy Integration
- [✅] Add `strategy_extract_and_feed_backlog()` function to `.agent/bin/pai-weekly-strategy`
- [✅] Extract from three Claude sections: Top 3 Priorities (P0), Quick Wins (P1), Risks & Blockers (P1)
- [✅] Auto-assigns priorities based on section
- [✅] Guards against empty strategy sections

**Task ID**: ENUM-003  
**Effort**: ~5 hours  
**Completed**: 2026-04-27 (already implemented)  

#### [✅] Discord Command Interface
- [✅] Create `backlog-command.ts` in `.agent/skills/discord-remote-control/service/commands/`
- [✅] Implement all commands:
  - [✅] `backlog status ENH-042` — Show item details
  - [✅] `backlog next` — Next highest-priority pending item
  - [✅] `backlog pending` — List all pending items
  - [✅] `backlog done ENH-042 "evidence"` — Mark as done
  - [✅] `backlog dupe ENH-042 ENH-035` — Mark as duplicate
  - [✅] `backlog reject ENH-042 "reason"` — Mark won't-implement
  - [✅] `backlog sources` — Breakdown by source
  - [✅] `backlog stats` — Statistics
- [✅] Create Discord embed formatting (color-coded by priority)
- [✅] Export handlers for bot integration
- [✅] Create comprehensive test suite (backlog-command.test.ts)

**Task ID**: ENUM-004  
**Effort**: ~8 hours  
**Completed**: 2026-04-27  

#### [✅] Daily Journal Integration
- [✅] Add `journal_reconcile_backlog()` function to `.agent/bin/pai-memory-journal`
- [✅] Parse daily journal output for "work completed" patterns
- [✅] Cross-reference against pending backlog items
- [✅] Auto-mark items as `done` if work is documented (with journal excerpt as evidence)
- [✅] Handle cases where journal mentions items indirectly (completion keyword detection)
- [✅] Log matched items for audit trail

**Task ID**: ENUM-005  
**Effort**: ~6 hours  
**Completed**: 2026-04-27

#### [✅] Memory Lifecycle Integration
- [✅] Add `lifecycle_audit_backlog()` function to `.agent/bin/pai-memory-lifecycle`
- [✅] During nightly consolidation, scan memory database for work patterns
- [✅] Identify completed work that hasn't been marked done in backlog
- [✅] Detect duplicate memory entries (similarity heuristic)
- [✅] Flag items that have been "in progress" too long (>14 days staleness check)
- [✅] Generate reconciliation report (logged to backlog-audit-YYYY-MM-DD.log)

**Task ID**: ENUM-006  
**Effort**: ~7 hours  
**Completed**: 2026-04-27  

#### [✅] Phase 1 Testing & Validation
- [✅] Comprehensive manage-backlog.sh test suite (25 tests, all passing)
- [✅] Discord command integration tests (backlog-command.test.ts)
- [✅] Phase 1 integration test suite (29 tests, all passing)
- [✅] Verified all functions exist and are exported
- [✅] End-to-end flow testing: add → list → next → done → duplicate → reject
- [✅] Full loop validation: heartbeat → backlog → Discord triage

**Task ID**: ENUM-005  
**Effort**: ~4 hours  
**Completed**: 2026-04-27  

---

### Phase 2: Week 2 (May 4 - May 10)

**Goal**: Daily journal + memory lifecycle + deduplication + reporting

#### [ ] Daily Journal Integration
- [ ] Modify `.agent/bin/pai-memory-journal` to extract insights
- [ ] Parse journal for: pattern detected, duplicates consolidated, graph anomalies
- [ ] Create backlog items for each insight
- [ ] Test nightly at 23:30

**Task ID**: ENUM-006  
**Effort**: ~4 hours  

#### [ ] Memory Lifecycle Integration
- [ ] Modify `.agent/bin/pai-memory-lifecycle` to extract maintenance items
- [ ] Query memory-system for health metrics after consolidation
- [ ] Create backlog items for: duplicates merged, graph anomalies, health < 90%
- [ ] Test nightly

**Task ID**: ENUM-007  
**Effort**: ~3 hours  

#### [ ] Advanced Deduplication Logic
- [ ] Create `is_duplicate_item()` function with fuzzy matching (80%+ title similarity)
- [ ] Apply to all four processes
- [ ] Test fuzzy matching accuracy
- [ ] Handle edge cases: same issue, different wording

**Task ID**: ENUM-008  
**Effort**: ~6 hours  

#### [ ] Reporting & Analytics
- [ ] Implement `backlog sources` command: breakdown by source (heartbeat, strategy, journal, lifecycle)
- [ ] Implement `backlog stats` command: P0-P3 counts, avg days pending, completion rate
- [ ] Create Discord visualizations

**Task ID**: ENUM-009  
**Effort**: ~4 hours  

#### [ ] Phase 2 Testing
- [ ] Run all four processes and verify items appear
- [ ] Validate deduplication across multiple runs
- [ ] Test reporting commands

**Task ID**: ENUM-010  
**Effort**: ~3 hours  

---

### Phase 3: Week 3 (May 11 - May 17)

**Goal**: Validation, iteration, documentation

#### [ ] Real-World Validation
- [ ] Monitor backlog growth over 5 days
- [ ] Measure deduplication accuracy (target: <5% duplicate rate)
- [ ] Collect usage patterns

**Task ID**: ENUM-011  
**Effort**: ~4 hours  

#### [ ] Discord UX Iteration
- [ ] Refine embed formatting based on feedback
- [ ] Add command aliases (e.g., `backlog done` vs `mark-done`)
- [ ] Optimize response time
- [ ] Add help text and examples

**Task ID**: ENUM-012  
**Effort**: ~4 hours  

#### [ ] Documentation
- [ ] Create runbook: "How to Triage Backlog via Discord"
- [ ] Document Discord commands with examples
- [ ] Create troubleshooting guide
- [ ] Update CLAUDE.md with backlog section

**Task ID**: ENUM-013  
**Effort**: ~4 hours  

#### [ ] Final Validation
- [ ] End-to-end test of all processes
- [ ] Verify success metrics met
- [ ] Archive implementation plan

**Task ID**: ENUM-014  
**Effort**: ~2 hours  

---

## Success Metrics

| Metric | Target | Baseline |
|--------|--------|----------|
| Items per week from heartbeat | 10-20 | 0 |
| Items per week from strategy | 3-8 | 0 |
| Duplicate rate | <5% | N/A |
| Items marked done/dupe/reject | 20-30 | 0 |
| Discord command response time | <1 sec | N/A |
| Backlog accuracy (relevance) | >85% | N/A |

---

## Assumptions & Risks

| Risk | Mitigation |
|------|-----------|
| Runaway item creation (10k+ items) | Limit top 5 items per source per run |
| Fuzzy match false negatives | Manual review weekly, adjust threshold if needed |
| Process crashes | Each process has `|| log "WARNING"` guard |
| Lost context | Always include description + source + date |

---

## Dependencies

- `manage-backlog.sh` ✅ (exists)
- `.agent/bin/pai-heartbeat` ✅ (exists)
- `.agent/bin/pai-weekly-strategy` ✅ (exists)
- `.agent/bin/pai-memory-journal` ✅ (exists, in memory-system)
- `.agent/bin/pai-memory-lifecycle` ✅ (exists)
- `discord-remote-control` ✅ (exists)
- Memory-system API (for daily-journal + lifecycle)

---

## File Changes Summary

### Modified Files
- `.agent/scripts/manage-backlog.sh` — Add new commands and statuses
- `.agent/bin/pai-heartbeat` — Add backlog extraction
- `.agent/bin/pai-weekly-strategy` — Add backlog extraction
- `.agent/bin/pai-memory-journal` — Add backlog extraction
- `.agent/bin/pai-memory-lifecycle` — Add backlog extraction
- `.agent/skills/discord-remote-control/service/index.ts` — Wire in backlog commands

### New Files
- `.agent/skills/discord-remote-control/service/commands/backlog-command.ts` — Command implementation
- `.agent/scripts/fuzzy-match.sh` — Deduplication helper

---

## Progress Tracking

**Week 1:**
- [✅] Phase 1.1: manage-backlog.sh enhancements (ENUM-001) — COMPLETED with test suite (25 tests)
- [✅] Phase 1.2: Heartbeat integration (ENUM-002) — COMPLETED (already implemented)
- [✅] Phase 1.3: Strategy integration (ENUM-003) — COMPLETED (already implemented)
- [✅] Phase 1.4: Discord commands (ENUM-004) — COMPLETED with test suite
- [✅] Phase 1.5: Daily Journal integration (ENUM-005) — COMPLETED
- [✅] Phase 1.6: Memory Lifecycle integration (ENUM-006) — COMPLETED
- [✅] Phase 1.7: Integration testing — COMPLETED (29 tests passing)

**Week 2:**
- [✅] Phase 2.1: Daily journal (ENUM-006) — COMPLETED
- [✅] Phase 2.2: Memory lifecycle (ENUM-007) — COMPLETED
- [✅] Phase 2.3: Deduplication (ENUM-008) — COMPLETED (fuzzy-match.sh with 80%+ matching)
- [✅] Phase 2.4: Reporting (ENUM-009) — COMPLETED (enhanced stats with completion rate)
- [✅] Phase 2.5: Testing (ENUM-010) — COMPLETED (20/20 tests passing)

**Week 3:**
- [~] Phase 3.1: Validation (ENUM-011)
- [ ] Phase 3.2: UX iteration (ENUM-012)
- [ ] Phase 3.3: Documentation (ENUM-013)
- [ ] Phase 3.4: Final validation (ENUM-014)

---

## Next Steps (Phase 3 - Upcoming)

### [ ] Real-World Validation
- [ ] Monitor backlog growth over 5 days
- [ ] Measure deduplication accuracy (target: <5% duplicate rate)
- [ ] Collect usage patterns

**Task ID**: ENUM-011  
**Effort**: ~4 hours

---

## Notes

- All backlog operations go through `manage-backlog.sh` (stack broker pattern)
- Deduplication prevents rehashing the same issue across 6-hour heartbeat cycles
- Discord provides instant triage feedback
- Memory-system integration tracks domain-specific insights
- Full audit trail preserved in JSONL (append-only)

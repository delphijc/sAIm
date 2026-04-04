# 🛠 Troubleshooting Guide: Bash Kanban

This document provides resolutions for common issues encountered during agentic development and parallel execution.

---

## 🛑 Pre-Commit Failures
The pre-commit hook acts as a quality gate. If it fails, the agent cannot finalize work.

### 1. "No task is marked as In-Progress"
* **Cause**: You attempted to commit without updating `plan.md`.
* **Fix**: Edit `docs/plan.md`. Ensure the current task is marked with `[~]`.

### 2. "Code coverage is below 80%"
* **Cause**: New logic was implemented without sufficient unit tests.
* **Fix**: 
    1.  Run `bun test --coverage` to identify untested lines.
    2.  Add tests to the corresponding `*.test.ts` file.
    3.  If a file is purely boilerplate, consider adding it to an exclusion list in `antigravity.config.json`.

---

## 🔄 Resource & Concurrency Issues
Parallel execution requires strict management of ports and file locks.

### 3. "Port already in use"
* **Cause**: A previous agent process did not release its port, or a port conflict occurred.
* **Fix**: Run `./scripts/resource_manager.sh cleanup_stale`. This clears `resources/ports.jsonl` and kills orphaned dev servers.

### 4. "File is locked by another agent"
* **Cause**: Two agents are trying to modify the same story or plan file simultaneously.
* **Fix**: 
    1.  Check `resources/file_locks.jsonl` to see which `job_id` holds the lock.
    2.  Wait for that agent to finish, or use the **Agent Manager** dashboard to "Force Release" the lock.

---

## 📝 Logging & Debugging
### 5. "Agent is stuck (no output)"
* **Cause**: The agent might be waiting for a shell command that became interactive.
* **Fix**: 
    1.  Check the JSONL log: `tail -f logs/stderr.jsonl | jq -r 'select(.job_id == "YOUR_JOB_ID") | .data'`.
    2.  If it's asking for a password or confirmation, restart the task with `CI=true`.

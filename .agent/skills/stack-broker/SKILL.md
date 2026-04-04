---
name: stack-broker
description: "Brokers all data operations through shell scripts to ensure reliability and file locking. USE WHEN persisting data to JSONL files, managing file-locked data operations, or ensuring atomic writes to shared state files."
---

# Skill: Stack Broker

## Description
Brokers all data operations through shell scripts to ensure reliability and file locking.

## Constraints
- **Rule 1**: No direct File IO for Data (no `Bun.write()`).
- **Rule 2**: Use `Bun.spawn` to execute shell commands (e.g., `jq`, `cat`, `tail`).
- **Rule 3**: Pass complex data via `stdin` to scripts.

## Example
Instead of writing to `jobs.jsonl` directly, the agent must call `submit_job.sh`.

## Testing Impact
The stack broker pattern enables reliable testing:
- Shell scripts handling file I/O are tested via `.bats` tests
- TypeScript agents are isolated and tested via unit tests
- File operations become observable and auditable through git history
- Mock scripts can be substituted during testing without side effects

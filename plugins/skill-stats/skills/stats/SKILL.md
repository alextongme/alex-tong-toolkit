---
name: "skill-stats:stats"
description: >
  Summarize which Claude Code skills and agents the user has actually
  invoked over time — use when asked "which skills am I using", "what
  are my top skills", "what did I install but never use", "audit my
  skill usage", "am I actually using this plugin", or any variation of
  wanting to see the personal usage log from `~/.claude/skill-usage.jsonl`.
  Do NOT use for: real-time telemetry across an org (this is a
  personal, local-only log), profiling latency or errors of individual
  skill runs, editing skill files, or generating usage predictions for
  skills that have not run at least once.
model: claude-opus-4-7
allowed-tools: ["Bash", "Read", "Glob"]
---

# Skill Stats

> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)

You are the skill-stats reporter. Read the local invocation log at `~/.claude/skill-usage.jsonl` (created by the `skill-stats` plugin's `PreToolUse` hook), aggregate it, and produce a compact usage report the user can act on.

## Overview

**What the log is.** One JSON object per line. Every Skill or Task tool invocation appended a record: `{"ts": <ISO8601 UTC>, "tool": "Skill|Task", "name": "<skill or subagent name>", "cwd": "<working dir>"}`. The hook is fire-and-forget, so a small fraction of records may be truncated or `"unknown"` — silently ignore malformed lines rather than failing the whole report.

**What the user wants.** *"Which of the skills I installed do I actually use, and which ones are dead weight?"* Optimize the report for that question. The top-10 is a scan; the undertriggered list is the action.

## Quick Reference

- Log path: `~/.claude/skill-usage.jsonl` (override with `$SKILL_STATS_LOG`)
- Windows: default 30 days; support `--days N` from `$ARGUMENTS`
- Installed skills baseline: `~/.claude/plugins/**/SKILL.md` + user-level `~/.claude/skills/**/SKILL.md` + repo-local `.claude/skills/**/SKILL.md`
- Never write to the log. Never delete it. Never send it anywhere.

## Requirements for Output

Every report must include:

1. **Header** — window used, log path, and record count (raw + valid).
2. **Top 10 by invocation count** — name, count, last-used-relative (e.g., "2 days ago").
3. **Per-type breakdown** — Skill vs. Task, count + share.
4. **Undertriggered installs** — every skill discoverable on disk that has **0 invocations** in the window. Grouped by plugin. This is the action list.
5. **A one-line summary** — the single sentence a user should walk away with (e.g., "You use 4 skills daily, have 17 installed you've never touched.").

Skip any section that has no data (e.g., no Task invocations → skip the per-type breakdown), and say so in one line.

## Process

1. **Parse arguments.** `$ARGUMENTS` may contain `--days N` (default 30) and/or a plugin filter `--plugin <name>`. Anything else is treated as a free-text filter matched against `name`.
2. **Read the log.** If the file doesn't exist or is empty, say so and stop — recommend running any skill once to seed it. If the file exists but every line is malformed, treat as empty and say so.
3. **Filter by window.** Drop records older than the window. Report the total dropped, so a "0 recent invocations" result is explained by the window, not silently swallowed.
4. **Discover installed skills.** Glob the three baseline paths above. Parse each SKILL.md's `name:` from frontmatter. Cache the name-to-file map for the undertriggered list.
5. **Aggregate.** Count per `name`. Track first-seen and last-seen timestamps per name. Sum per `tool`.
6. **Compute undertriggered.** Set-diff: installed names − invoked names. Sort by plugin for readability.
7. **Emit the report** in the format below.

## Output Format

```
### Skill Stats — last <N> days

**Log:** `~/.claude/skill-usage.jsonl` · **Records:** <raw> total, <valid> valid, <old> outside window

#### Top 10 skills + agents
| # | Name              | Invocations | Last used     |
|---|-------------------|-------------|---------------|
| 1 | rewrite           | 42          | 3 hours ago   |
| 2 | claude-brain:audit| 18          | 2 days ago    |
| ...

#### By type
- Skill: <count> (<pct>%)
- Task (subagents): <count> (<pct>%)

#### Undertriggered — installed but never invoked in this window
**Plugin: `<plugin-name>`**
- `<skill-name>` — installed <date>, 0 invocations
- ...

**Plugin: `<plugin-name>`**
- ...

#### Summary
<One sentence. Example: "You lean on 4 skills daily and haven't touched 17 of the 24 you have installed — consider uninstalling the ones you didn't reach for even once.">
```

## Rules

- **The log is personal and local.** Never surface an option to send it anywhere, never suggest uploading it, never ask the user to share it. If the user asks about org-wide aggregation, tell them Phase 2 (opt-in shipping to a shared destination) is not implemented in this plugin — that's a separate design decision.
- **Silently skip malformed lines.** A single truncated record must not fail the whole report. Report the count of skipped lines under Records.
- **Respect the window.** Never quietly widen the window because "there wasn't enough data" — that hides the shape of the answer. Say "0 invocations in the last N days" and let the user re-run with a longer window.
- **Never guess a `last used` you don't have.** If a name has no valid timestamp, print `—` not a made-up date.
- **Do not modify the log.** No writes, no deletes, no rotations. If the user wants a fresh log, tell them to move or delete it themselves.
- **Undertriggered ≠ useless.** Some installed skills are deliberately rare (setup, one-shot bootstraps). Present the list as *"consider whether these are worth keeping installed,"* not as a purge order.

## Example

Given a log with 200 records over 45 days and 24 installed skills across 6 plugins:

```
### Skill Stats — last 30 days

**Log:** `~/.claude/skill-usage.jsonl` · **Records:** 142 total, 141 valid, 58 outside window

#### Top 10 skills + agents
| # | Name                | Invocations | Last used   |
|---|---------------------|-------------|-------------|
| 1 | rewrite             | 42          | 3 hours ago |
| 2 | triage              | 22          | 1 day ago   |
| 3 | claude-brain:audit  | 18          | 2 days ago  |
| 4 | mark-posted         | 14          | 4 days ago  |
| 5 | lint                | 9           | 8 days ago  |
| 6 | rebuild-index       | 7           | 2 days ago  |
| 7 | roundup             | 4           | 6 days ago  |
| 8 | compound            | 3           | 12 days ago |
| 9 | variants            | 2           | 21 days ago |
|10 | sync-brand-kit      | 2           | 15 days ago |

#### By type
- Skill: 121 (85.8%)
- Task (subagents): 20 (14.2%)

#### Undertriggered — installed but never invoked in this window
**Plugin: `education`**
- `education:worksheet` — 0 invocations

**Plugin: `company-research`**
- `company-research:research` — 0 invocations

**Plugin: `agent-patterns`**
- `sandbox` — 0 invocations

#### Summary
You lean on 4 skills daily; 3 skills across 3 plugins have zero invocations in the last 30 days — consider whether they're worth keeping installed.
```

## Edge Cases

- **Empty log:** `Records: 0 total. Run any skill or subagent once to seed the log — the hook records automatically.`
- **Log exists but every line is malformed:** treat as empty, mention the invalid-line count.
- **`~/.claude` unreadable (permissions):** report the path and error; do not fall back to a different location silently.
- **Very large log (>100k lines):** stream, don't slurp — read line by line, filter by timestamp before parsing.
- **User asks for a range longer than the log:** use whatever data exists, note that data begins at `<earliest timestamp>`.
- **User asks for an org-wide roll-up:** decline, explain Phase 2 not implemented, suggest they file an issue if they want it.

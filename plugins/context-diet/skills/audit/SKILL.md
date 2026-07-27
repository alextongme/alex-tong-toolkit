---
name: "context-diet:audit"
description: >
  Measure and prune the on-load context that every Claude Code session
  starts with — MCP servers, installed plugins, skills, subagents, and
  CLAUDE.md files. Use when the user asks "why does my context feel
  slow", "audit my Claude setup", "what's eating my context window",
  "trim my Claude config", "context budget", "what loads at startup",
  or any variation of wanting a token-cost view of everything installed
  or configured. Do NOT use for: scoring the QUALITY of a single
  CLAUDE.md file (that is `claude-brain:audit`), debugging in-session
  context growth from tool calls, editing conversation history, or
  measuring runtime token spend (this is startup-load only).
model: claude-opus-4-7
allowed-tools: ["Read", "Glob", "Grep", "Bash"]
---

# Context Diet

> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)

You are the context-diet auditor. Enumerate every source that gets loaded into a Claude Code session at startup, estimate the token cost of each, and produce a prune list ordered by cost-to-value.

## Overview

**What "context on load" means.** Every session begins with a fixed context payload before the first user message: the resolved CLAUDE.md hierarchy, installed plugin metadata, skill trigger descriptions, subagent definitions, and connected MCP server tool schemas. All of it costs tokens on every session, regardless of whether the user ever needs it. That's the diet target.

**What the user wants.** *"Show me what I'm paying for on every session — sorted by size — and tell me what I can safely drop."* Optimize for that. The token estimates matter less than the ranking; the prune list is the action.

**Relationship to `claude-brain:audit`.** `claude-brain:audit` scores the *quality* of a single CLAUDE.md file (signal vs. noise). `context-diet:audit` measures the *token cost* of everything loaded at startup, across all sources. They're complementary — run both if the user wants full context hygiene.

## Quick Reference

**Sources to enumerate** (in this order):

1. **CLAUDE.md hierarchy** — `~/.claude/CLAUDE.md`, `~/CLAUDE.md`, any parent-directory `CLAUDE.md` walking up from the repo root, `<repo>/CLAUDE.md`, `<repo>/CLAUDE.local.md`, `<repo>/.claude/rules/*.md`, `<repo>/<subdir>/CLAUDE.md`.
2. **Plugin descriptions** — `~/.claude/plugins/**/plugin.json` and `~/.claude/plugins/**/.claude-plugin/plugin.json`. The `description` field loads on every session.
3. **Skill trigger descriptions** — `~/.claude/plugins/**/SKILL.md` + `~/.claude/skills/**/SKILL.md` + `.claude/skills/**/SKILL.md`. Only the frontmatter `description:` field loads at startup; the body loads on invocation, so score frontmatter separately from body.
4. **Subagent definitions** — `~/.claude/agents/*.md` + `.claude/agents/*.md`. Full definition loads.
5. **MCP server tool schemas** — read `~/.claude/settings.json`, `~/.claude.json`, and repo-local `.mcp.json` / `.claude/settings.json` for connected servers. Server tool schemas load fully unless the server is deferred/lazy-loaded (note which are).
6. **Custom slash commands** — `~/.claude/commands/*.md` + `.claude/commands/*.md`.

**Token estimation** — use a `chars / 4` heuristic per source (roughly matches OpenAI/Anthropic byte-pair tokenization at English-language ratios). Round to nearest 100. This is DIRECTIONAL — say so in the report. Don't attempt precise tokenization.

**Never do.** Do not delete a file. Do not modify settings.json. Do not disable an MCP server. Do not `rm` anything. The skill is read-only + recommendations; the user takes action.

## Requirements for Output

Every report must include:

1. **Header** — total estimated on-load tokens + machine identifier (`hostname`) + working directory.
2. **Per-category breakdown** — CLAUDE.md hierarchy, Plugins, Skills, Subagents, MCP servers, Slash commands. Each with: source count, estimated tokens, percentage of total.
3. **Top 10 individual sources by size** — table with path, category, estimated tokens.
4. **Prune candidates** — items that are large AND look low-signal. Cross-reference against `skill-stats` output if available (`~/.claude/skill-usage.jsonl`), so an "installed but never used" skill scores as prune-worthy.
5. **A one-line summary** — the single sentence the user should walk away with.

## Process

1. **Enumerate sources** in the order listed above. Use `Glob` for filesystem sweeps; use `Read` for individual files; use `Bash` only for read-only checks (`stat`, `wc -c`, `hostname`).
2. **Handle missing / unreadable sources gracefully.** If a source doesn't exist or permissions block reading, skip it silently EXCEPT log the count of skipped sources in the header. Never fail the whole report.
3. **Estimate tokens.** For each source: `tokens ≈ ceil(byte_count / 4 / 100) * 100`. Sum per category. Sum overall.
4. **Cross-reference with `skill-stats`** if the log exists at `~/.claude/skill-usage.jsonl`. Compute a `days_since_last_use` for each skill/subagent. Anything installed but not invoked in the last 30 days is a prune candidate regardless of size.
5. **Score prune candidates.**
   - **Definitely prune** — over 500 est. tokens AND never invoked in the last 30 days (or no usage log).
   - **Consider pruning** — over 1,500 est. tokens AND rarely invoked (bottom quartile).
   - **Keep** — high-usage skills, active MCP servers, current-repo CLAUDE.md files.
6. **Emit the report** in the format below.

## Output Format

```
### Context Diet Audit — <hostname> · <cwd>

**Total on-load context (estimated):** ~<N> tokens across <M> sources.
**Estimation method:** char-count / 4, rounded to 100 (directional, not precise).
**Skipped sources:** <count> (unreadable or missing).

#### Breakdown by category
| Category            | Sources | Est. tokens | % of total |
|---------------------|---------|-------------|-----------|
| CLAUDE.md hierarchy | 4       | 3,200       | 22%       |
| Plugins             | 6       | 800         | 5%        |
| Skills              | 24      | 4,800       | 33%       |
| Subagents           | 3       | 1,500       | 10%       |
| MCP servers         | 2       | 4,000       | 27%       |
| Slash commands      | 5       | 400         | 3%        |
| **Total**           | 44      | **14,700**  | 100%      |

#### Top 10 individual sources
| # | Path                                              | Category    | Est. tokens |
|---|---------------------------------------------------|-------------|-------------|
| 1 | `~/.claude/plugins/mega-mcp/schemas.json`         | MCP servers | 3,800       |
| 2 | `~/CLAUDE.md`                                     | CLAUDE.md   | 1,900       |
| ...

#### Prune candidates
**Definitely prune (large + unused):**
- `~/.claude/plugins/foo/skills/bar/SKILL.md` — ~800 tokens, 0 invocations in 30 days
- ...

**Consider pruning (large + rarely used):**
- `~/CLAUDE.md` — ~1,900 tokens, contains 3 sections that duplicate `<repo>/CLAUDE.md`
- ...

**Keep (large but active or load-bearing):**
- `~/.claude/plugins/mega-mcp/schemas.json` — 3,800 tokens, MCP server actively used
- ...

#### Summary
<One sentence. Example: "Your session loads ~14.7k tokens on startup — dropping the 3 unused plugins would save ~2.4k without losing anything you use.">
```

## Rules

- **Directional, not precise.** Say so in the header. Do not claim precise token counts — `chars / 4` is a rough approximation, and different tokenizers will disagree.
- **Read-only.** Never edit, delete, or move any file. Never modify settings.json. Never disable an MCP server. Recommendations are for the user to act on.
- **Cross-reference `skill-stats` if available, but don't require it.** If `~/.claude/skill-usage.jsonl` doesn't exist, do the audit without usage data — just say "usage data unavailable, prune scoring is size-only" in the header.
- **Do not audit content the user didn't ask about.** Audit *cost*, not *quality* — that's `claude-brain:audit`'s job. If the user wants both, run both, but don't quietly bundle a quality audit into a cost audit.
- **Respect the hierarchy.** When a CLAUDE.md at `<repo>` duplicates content in `~/.claude/CLAUDE.md`, flag the *repo* file as prune-eligible (the more-specific file is the one you edit locally). Follow the same load order as `claude-brain:audit`.
- **Never send data anywhere.** The audit is local. Do not offer to upload results, POST to a server, or write to any shared location. Report only.

## Example

Given `~/.claude/CLAUDE.md` (7.6 KB), `~/CLAUDE.md` (1.9 KB), `<repo>/CLAUDE.md` (2.1 KB), 6 installed plugins, 24 skills, 3 subagents, 2 MCP servers, and 5 slash commands, with `skill-stats` showing 3 skills unused in 30 days:

```
### Context Diet Audit — <hostname> · <cwd>

**Total on-load context (estimated):** ~14,700 tokens across 44 sources.
**Estimation method:** char-count / 4, rounded to 100 (directional, not precise).
**Skipped sources:** 0.

#### Breakdown by category
| Category            | Sources | Est. tokens | % of total |
|---------------------|---------|-------------|-----------|
| CLAUDE.md hierarchy | 4       | 3,200       | 22%       |
| Plugins             | 6       | 800         | 5%        |
| Skills              | 24      | 4,800       | 33%       |
| Subagents           | 3       | 1,500       | 10%       |
| MCP servers         | 2       | 4,000       | 27%       |
| Slash commands      | 5       | 400         | 3%        |
| **Total**           | 44      | **14,700**  | 100%      |

#### Prune candidates
**Definitely prune (large + unused):**
- `~/.claude/plugins/education/skills/worksheet/SKILL.md` — ~600 tokens, 0 invocations in 30 days
- `~/.claude/plugins/company-research/skills/research/SKILL.md` — ~900 tokens, 0 invocations in 30 days

**Consider pruning (large + rarely used):**
- `~/CLAUDE.md` — ~1,900 tokens, 3 sections appear to duplicate the repo-level CLAUDE.md

#### Summary
Your session loads ~14.7k tokens on startup — dropping the 2 unused plugins and de-duping `~/CLAUDE.md` would save ~3.4k without losing anything you use.
```

## Edge Cases

- **No CLAUDE.md anywhere:** report the breakdown for other categories, note "no CLAUDE.md hierarchy detected — consider adding one for repo-specific context."
- **MCP config unreadable / no MCP servers:** skip the MCP category cleanly, note it in Skipped Sources count.
- **`skill-stats` log missing:** run size-only prune scoring, note in header.
- **Symlinked skill/plugin dirs:** follow the symlink once, don't recurse into loops.
- **Same skill installed both globally and in-repo:** count both, flag the duplication as prune-eligible on the less-specific copy.

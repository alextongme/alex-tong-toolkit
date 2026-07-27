---
name: "alex-tong-engineering:workspace-audit"
description: >
  Audit a workspace for drift — reconcile claims in `.claude/CLAUDE.md` and
  `repos.json` against the actual state of the world (GitHub, local clones,
  file freshness). Use when the user asks to "audit the workspace", "check
  for stale workspace docs", "validate repos.json", or "see what's drifted
  in CLAUDE.md". Do NOT use for: scoring CLAUDE.md quality (use
  `alex-tong-engineering:claude-md-audit`), auditing a single repo's code, or reviewing PRs.
model: claude-opus-4-7
allowed-tools: ["Bash(gh repo view:*)", "Bash(gh auth status:*)", "Bash(command -v:*)", "Bash(ls:*)", "Bash(pwd:*)", "Bash(stat:*)", "Bash(jq:*)", "Bash(cat:*)", "Read", "Glob", "Grep"]
---

# Workspace Audit

> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)

Reconcile what the workspace *claims* (in `repos.json` and `.claude/CLAUDE.md`) against what *is* (repos on GitHub, files on disk, relative mtimes). Produce a classified findings report so the user knows what to fix, what's merely stale, and what's intentional.

**Scope:** cross-repo workspace documents only. Individual repo `CLAUDE.md` files are out of scope — use `alex-tong-engineering:claude-md-audit` for those.

## Preconditions

The current directory (or `$ARGUMENTS` if provided) must be a workspace root — that is, it must contain **both** `repos.json` and `.claude/CLAUDE.md`. If either is missing:

- If `repos.json` is missing, stop: "Not a workspace root (no `repos.json`). Run `/alex-tong-engineering:workspace-create` first."
- If `.claude/CLAUDE.md` is missing, stop: "Workspace is missing `.claude/CLAUDE.md`. Re-run create, or write one."

Also check prerequisites:

    Bash: command -v gh
    Bash: command -v jq
    Bash: gh auth status 2>&1

If any fail, stop and report what's missing. The audit needs `gh` to verify repos and `jq` to read `repos.json`.

## Classification

Every finding must be classified as one of:

- **BUG** — something is broken or demonstrably wrong. `repos.json` lists a repo that 404s on GitHub. CLAUDE.md references a repo not in `repos.json`. A placeholder like `__TEAM_NAME__` is still in the file. The user should fix these before anything else.
- **DRIFT** — the docs are stale but nothing is broken. Contract source file newer than CLAUDE.md. A repo's default branch changed. CLAUDE.md's "Last reviewed" date is more than 90 days old. Worth updating soon.
- **FUTURE** — the file contains an intentional TODO, a `> **TODO:**` block, or a section that's deliberately empty (e.g., "Gotchas" with a placeholder line). Not a defect — the scaffold invites the user to fill these in over time. Report but don't alarm.

When a finding could be BUG or DRIFT, prefer BUG only if you can point to something concretely broken (404, wrong reference, unresolved placeholder). When in doubt, DRIFT.

## Instructions

Run these phases in order. Parallelize within a phase where possible.

### Phase 1: Load the workspace

Read the two authoritative files. Both are required.

- **Read** `{workspace}/repos.json`
- **Read** `{workspace}/.claude/CLAUDE.md`

Also capture:

    Bash: stat -f %m {workspace}/.claude/CLAUDE.md 2>/dev/null || stat -c %Y {workspace}/.claude/CLAUDE.md

Store as `claude_md_mtime` (epoch seconds).

Parse `repos.json` into a flat list of repos with fields: `name`, `repo` (org/name), `description`, `language`, `defaultBranch`, `tags`, optional `ref`. Build two name sets:

- `registry_full`: every `repo` value (e.g., `acme/payments-api`)
- `registry_short`: every `name` value (e.g., `payments-api`)

### Phase 2: Verify each repo on GitHub

For every repo in the registry, in parallel (batch in groups of 15 if more than 15 repos):

    Bash: gh repo view {org/repo} --json name,defaultBranchRef,isArchived,visibility 2>&1

For each result, record:

- **BUG** if the command fails with "not found", "Could not resolve", or a 404 — the repo is gone, was renamed, or the workspace never had access.
- **BUG** if `isArchived: true` and the user's CLAUDE.md doesn't acknowledge it (search for the word "archived" near the repo name). Archived repos can still be read but cannot be pushed to — downstream automation will break silently.
- **DRIFT** if `defaultBranchRef.name` no longer matches `repos.json`'s `defaultBranch` field. Updating `repos.json` is a one-line fix.
- **DRIFT** if `visibility` is "PRIVATE" but the user's README implies the workspace is public (skip this check if no README.md exists).

Surface non-404 errors (rate-limited, auth, network) as a separate line — do NOT classify these as BUG. Print: "Could not verify {repo}: {error}." and continue.

### Phase 3: Check local clone presence

Use **Glob** to list top-level directories in the workspace. For each repo in the registry:

- If the directory exists and contains `.git`: OK.
- If the directory does not exist: **FUTURE** — noted as "not yet cloned" (running `make setup` will fix it). Do not flag as BUG.
- If the directory exists but has no `.git`: **BUG** — something created the directory without cloning. Likely user error.

Also enumerate directories that exist but are NOT in the registry. For each:

- Skip hidden dirs (`.git`, `.claude`, `.contract-sources`, anything starting with `.`).
- Skip `node_modules`, `vendor`, `__pycache__`, and other common artifact dirs.
- What's left that looks like a repo (contains `.git`) is a **DRIFT** finding: "untracked local clone `{name}` — either add to `repos.json` or delete."

### Phase 4: Cross-check CLAUDE.md against the registry

Search the full CLAUDE.md content for references to repo names. Use these patterns:

- Inline code backticks: `` `repo-name` ``
- Inside tables: `| repo-name |` or cells containing `repo-name`
- Headings and prose: bare word matches for names in `registry_short`

For every mention of a name that looks like a repo (long enough, hyphenated, or matches the project naming convention):

- If it's in `registry_short`: OK.
- If it's NOT in `registry_short` and not obviously a library/tool/system codename: **BUG** — "`{name}` referenced in CLAUDE.md but not in `repos.json`. Did you rename or remove it?" Include the line number.

Also scan for **unresolved placeholders**: any remaining `__SOMETHING__` pattern (double-underscore, uppercase, double-underscore). These are scaffold tokens that should have been replaced:

- `__TEAM_NAME__`, `__TODAY__`, `__TRACKER_PREFIX__`, `__CROSS_REPO__`, `__TRACKER_SECTION__`, `__DEPLOY_TABLE__` → **BUG**. The create skill should have substituted these; their presence means the scaffold was edited by hand or the substitution failed.

### Phase 5: Check the "Last reviewed" date

Grep CLAUDE.md for a line matching `Last reviewed:` followed by a date. If present and older than 90 days relative to today's date: **DRIFT**. The workspace CLAUDE.md template sets this on creation; a stale date is a weak but useful signal that nobody has revisited the file. If absent, skip silently — not every workspace uses this convention.

### Phase 6: Check contract freshness

Look for `.contract-sources` at the workspace root.

- If it doesn't exist: skip silently. The file is optional.
- If it exists: read each path (one per line, ignore blank lines and lines starting with `#`). For each:
  - If the file doesn't exist: **DRIFT** — "contract `{path}` listed in `.contract-sources` but the file is missing."
  - If the file's mtime > `claude_md_mtime`: **DRIFT** — "`{path}` modified after CLAUDE.md was last updated — review Cross-Repo Relationships."

Use a single Bash call with `jq`-style reading or a plain loop; don't spawn one Bash per path.

### Phase 7: Check TODO density

Count lines containing `TODO` in CLAUDE.md. These are **FUTURE** findings — the scaffold intentionally includes TODO markers as prompts for the user to fill in.

- 0–3 TODOs: healthy.
- 4–10: normal for a new workspace; summarize as "FUTURE: {N} unfilled scaffold prompts remain."
- 11+: noteworthy — the workspace may have been scaffolded but never filled in. One-line summary only, do not list each line.

Do NOT flag TODO-laden sections as BUG or DRIFT.

## Output Format

Print results grouped by classification, most urgent first. Skip empty sections. If everything passes, print the "all clean" message under **Output when everything passes**.

```
## Workspace Audit — {workspace_name}

_Audited against GitHub and local state on {today's date}._

### 🔴 BUG — Fix these
- [{category}] {finding}, {file:line if applicable}
- [{category}] {finding}

### 🟡 DRIFT — Stale but not broken
- [{category}] {finding}
- [{category}] {finding}

### 🔵 FUTURE — Intentional TODOs
- {N} unfilled scaffold prompts in CLAUDE.md
- {N} repos in registry not yet cloned

### Summary
{count} BUG, {count} DRIFT, {count} FUTURE. {one-line recommendation}.
```

**Category** is one of: `registry`, `repo`, `clone`, `cross-ref`, `placeholder`, `contracts`, `review-date`. Use these consistently so findings can be grouped.

**Recommendation** is a single sentence. For BUG > 0, suggest fixing the first BUG. Otherwise, pick the most impactful DRIFT. Otherwise, say "healthy — no action needed."

### Output when everything passes

If no BUGs, no DRIFTs, and only FUTURE findings exist (or no findings at all), print the happy-path summary:

```
## Workspace Audit — {workspace_name}

✅ No drift detected. {N} repos verified against GitHub, CLAUDE.md references resolve, contract files are fresh.

{If FUTURE count > 0}: {N} scaffold TODOs remain — these are intentional prompts, not defects.
```

## Rules

- **Don't suggest edits to CLAUDE.md content.** This skill identifies drift; the user fixes it. Do not generate replacement sections or guess at what the user meant. Scope here is strictly verification, not authorship.
- **Don't re-score the file.** For quality scoring, point the user at `alex-tong-engineering:claude-md-audit`. This skill and that one are complementary — drift is orthogonal to quality.
- **Verify before flagging.** A "repo not found" must come from an actual `gh repo view` failure, not a guess. A stale contract must come from an actual mtime comparison. Never flag something you didn't verify.
- **Attribute findings to file and line where possible.** `CLAUDE.md:47` beats "somewhere in CLAUDE.md". Grep returns line numbers — use them.
- **Tolerate non-404 `gh` errors.** Auth failures, rate limits, and transient network errors are not BUGs — they mean the audit was incomplete. Report them as a separate "could not verify" list and continue.
- **Never modify files.** This is a read-only skill. `allowed-tools` excludes Write and Edit by design.

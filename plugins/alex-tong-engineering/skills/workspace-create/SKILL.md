---
name: "alex-tong-engineering:workspace-create"
description: >
  Create a workspace with shared context across multiple repos — for teams or
  personal projects. Generates a repo registry, CLAUDE.md scaffold, Makefile,
  and bootstrap script. Use when the user asks to "set up a workspace",
  "bootstrap a multi-repo project", "add shared Claude context across repos",
  or similar. Do NOT use for: single-repo project setup, IDE/editor
  configuration, CI pipeline scaffolding, or general repo cloning without a
  shared Claude context layer.
model: claude-opus-4-7
allowed-tools: ["Bash(gh repo view:*)", "Bash(gh auth status:*)", "Bash(git init:*)", "Bash(chmod +x:*)", "Bash(date:*)", "Bash(command -v:*)", "Bash(mkdir:*)", "Bash(ls:*)", "Bash(gh api:*)", "Bash(pwd:*)", "Read", "Write", "AskUserQuestion"]
---

# Workspace Create Command

> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)

Create a new workspace with repo registry, shared context, and safety defaults.

**CRITICAL: Execute every phase and every step in order. Do NOT skip, combine, or assume defaults for any step — even if you think you know the answer from context. Every AskUserQuestion must be shown to the user.**

## Variables Set During Setup

Track these as you go — they're referenced across multiple phases:

| Variable | Set in | Used in |
|----------|--------|---------|
| `mode` | Before You Start | Phases 1–7 (controls which steps run and template language) |
| `github_owner` | Phase 0 (personal) or 1b (team) | Phases 1b, 2, 7 |
| `slug` | Phase 1a | Phases 1b, 1d, 5–7 |
| `display_name` | Phase 1a | Phases 6–7 |
| `tracker_prefix` | Phase 1c (team only) | Phases 6–7 |
| `output_dir` | Phase 1d | Phases 5–7 |

## Before You Start

Use **AskUserQuestion** with this exact question and these exact three options:

Question: "What kind of workspace are you setting up?"

Options:
- **"Team workspace — for an engineering team at a company"** -- set `mode = team`
- **"Personal workspace — for my own projects"** -- set `mode = personal`
- **"Not sure — explain the difference"** -- display the explanation below, then re-ask

**Explanation (only if "Not sure" is selected):**

> **Team workspace** is for engineering teams that share multiple repos. It scaffolds a CLAUDE.md with sections for system codenames, cross-repo relationships, deployment info, and tribal knowledge — context that helps every engineer on the team get consistent AI assistance. The workspace is meant to be committed to GitHub and shared.
>
> **Personal workspace** is for individual developers who work across several of their own repos. Same scaffolding, but without team-specific sections like project trackers, on-call rotations, or ownership. It's your personal AI context layer.

### Team mode only: check for existing workspace

If `mode = team`, display this notice:

> **Have you checked with your team?** If your team already has a shared workspace, you should use that instead of creating a new one. Ask in your team's chat or check GitHub for an existing `your-team-workspace` repo.

Use **AskUserQuestion** with options:
- **"Yes, no existing workspace"** -- proceed
- **"Not sure, let me check first"** -- STOP and tell the user to check with their team, then re-run `/alex-tong-engineering:workspace-create` when ready

Do NOT proceed until the user confirms. **Skip this entirely for personal mode.**

## Phase 0: Pre-flight Checks

Run prerequisite checks. Use **three separate Bash calls** so you can report ALL missing tools at once (do NOT chain with `&&`):

    Bash: command -v gh
    Bash: command -v jq
    Bash: command -v git

Then check auth:

    Bash: gh auth status 2>&1

`jq` is not used in this skill directly, but the generated Makefile and setup.sh require it — it must be installed before the workspace is usable.

If ANY check fails, STOP and list everything that needs fixing:
- Missing `gh`: "Install GitHub CLI: `brew install gh && gh auth login`"
- Missing `jq`: "Install jq: `brew install jq`"
- Missing `git`: "Install git: `brew install git`"
- `gh` not authenticated: "Authenticate GitHub CLI: `gh auth login`"

Do NOT proceed past Phase 0 until all checks pass.

### Detect GitHub identity

After all checks pass, detect the authenticated GitHub user:

    Bash: gh api user --jq '.login'

Store the result as `github_user`.

- **Personal mode:** Set `github_owner = github_user`. Print: "Using your GitHub account `{github_user}` for repo lookups." Do NOT ask for an org — proceed directly.
- **Team mode:** `github_owner` will be set in Phase 1b (the user is asked explicitly).

## Phase 1: Gather Information

### 1a. Workspace Name (required)

Print this as plain text (do NOT use AskUserQuestion — let the user type freely):

- **Team mode:** "What is your team name? This becomes your workspace folder name (e.g., Platform → `platform-workspace`)."
- **Personal mode:** "What do you want to call this workspace? This becomes the folder name (e.g., side-projects → `side-projects-workspace`)."

Wait for the user's response.

**Sanitize to slug**: lowercase → spaces to hyphens → strip characters not in `[a-z0-9-]` → collapse consecutive hyphens → strip leading/trailing hyphens.

If the slug is empty after sanitization, ask again.

Set `display_name` to the user's original input (before sanitization, but trimmed).

### 1b. GitHub Naming Conflict Check

**Team mode only:** Ask the user: "What is your GitHub organization? (e.g., `acme-corp`)"

Set `github_owner` to their response. If they say they don't have one or leave it empty, set `github_owner = github_user` and inform them: "No org — using your personal account `{github_user}`."

**Validate `github_owner`:** The value must match `^[a-zA-Z0-9_.-]+$`. If it contains spaces, slashes, or other invalid characters, tell the user: "GitHub org/user names can only contain letters, numbers, hyphens, underscores, and dots." Then re-ask.

**Personal mode:** `github_owner` was already set in Phase 0. Skip asking.

**Both modes:** Check if `{slug}-workspace` already exists:

    Bash: gh repo view {github_owner}/{slug}-workspace --json name 2>&1

- Exit 0 = repo exists. Warn and use **AskUserQuestion**: "Use a different name" or "Continue anyway"
- "not found" or "Could not resolve" = doesn't exist. Proceed silently
- Any other error = prerequisite problem. STOP and tell the user to fix it

### 1c. Project Tracker Prefix (team mode only)

**Skip this step entirely for personal mode.** Set `tracker_prefix = null`.

**Team mode:** Ask: "What is your project tracker prefix? (e.g., PAY, PLAT — type `none` to skip)"

If the user types "none", "skip", "n/a", or similar, use the literal string `PREFIX` as placeholder in templates.

### 1d. Output Directory

You MUST ask the user where to put the workspace. Do NOT skip this step or assume a default.

**First, resolve the current working directory** so the last option can show the real path:

    Bash: pwd

Store the result as `cwd` and substitute it into the "Current directory" option label below. Do NOT leave the `{cwd}` placeholder unresolved — users must see the real absolute path.

Then use **AskUserQuestion** with this exact question and these exact four options:

Question: "Where should the workspace be created? (`{slug}-workspace` will be created inside your choice)"

Options:
- **"Documents (`~/Documents/`)"**
- **"Desktop (`~/Desktop/`)"**
- **"Home directory (`~/`)"**
- **"Current directory (`{cwd}/`)"** — with `{cwd}` replaced by the `pwd` output

After receiving the choice, resolve the full output path as `{parent_dir}/{slug}-workspace`. Resolve `~` to the home directory. Resolve relative paths to absolute.

Then confirm using a second **AskUserQuestion**: "Workspace will be created at `{absolute_path}`. Is this correct?"
- **"Yes, use this location"** -- proceed
- **"No, let me pick a different path"** -- go back and re-ask

**If the directory already exists:**
1. Warn: "Directory already exists. Generated files will be replaced."
2. If `.claude/CLAUDE.md` exists, note it will be backed up.
3. Use **AskUserQuestion**: "Continue and overwrite" or "Use a different path"
4. If confirmed and CLAUDE.md exists, back it up to `.claude/CLAUDE.md.bak`

### 1e. Repo List

End Phase 1 by printing this message as plain text. **Do not call AskUserQuestion or any other tool after printing this message.** Claude Code will display your text and wait for the user's next message.

> Enter all your repos in one message — comma-separated, space-separated, or one per line all work. Any format:
> - Just the repo name (e.g., `payments-api`)
> - `org/payments-api` or `username/my-project`
> - GitHub URL (e.g., `https://github.com/org/payments-api`)
> - SSH URL (e.g., `git@github.com:org/payments-api.git`)
>
> Example: `payments-api, checkout-frontend, billing-service`

## Phase 2: Parse Repositories

The user's message contains their complete repo list. Parse all identifiers in a single pass.

**If the message is clearly not a repo list** (a question, request to go back, etc.), respond appropriately and re-print the 1e prompt when ready.

**Otherwise, parse as repos.** Do not call AskUserQuestion. Do not ask for more repos or confirmation. Treat the message as final and proceed to Phase 3.

**Split:** Split on newlines. For each line, strip leading whitespace, markdown bullets (`- `, `* `), and numbering (`\d+\. ` prefix). Then split each line on commas. Then split each segment on whitespace. Process each resulting token individually.

**Normalize:** Strip `https://github.com/`, `http://github.com/`, `ssh://git@github.com/`, or `git@github.com:` prefixes. Strip `.git` suffix. Take only the first two `/`-separated segments. **If a token has no `/` (bare repo name), prefix it with `{github_owner}/`** (already known from Phase 0 or 1b — do NOT re-ask).

**Validate:** Must match `^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$`. Skip invalid tokens silently -- prose fragments and descriptions naturally become invalid after splitting and are harmless.

**Duplicate detection:** Extract basename (after `/`). If already seen, skip and note: "Duplicate: `{name}` -- repos can't share a short name (they'd collide on disk)."

**Minimum:** At least 1 valid repo required. If none found, show format examples and re-print the 1e prompt (plain text, no tool calls).

**Summary:** Print a brief summary (e.g., "Parsed 5 repos: payments-api, checkout-frontend, billing-service, config, deploy-tools"). Proceed directly to Phase 3.

## Phase 3: Fetch GitHub Metadata

For each repo, run a Bash command:

    Bash: gh repo view {org/repo} --json description,primaryLanguage,defaultBranchRef

Run all repos in parallel using multiple Bash tool calls in a single message. If more than 15 repos, batch into groups of 15.

Extract from each result:
- `description` (fallback: "No description" if null/empty)
- `primaryLanguage.name` (fallback: "unknown" if null)
- `defaultBranchRef.name` (fallback: "main" if null)

**If `gh repo view` fails for a repo** (404, no access, typo), do NOT silently continue. Immediately surface it to the user using **AskUserQuestion**:

> Could not find `{org/repo}` on GitHub. This could be a typo, a private repo you don't have access to, or the repo may not exist.

Options:
- **"Re-enter this repo"** -- ask the user for the correct name, normalize and validate it, then retry the `gh repo view` call
- **"Remove it from the list"** -- drop this repo and continue with the rest
- **"Keep it anyway"** -- proceed with placeholder metadata (description="TODO", language="unknown", defaultBranch="main")

If the user re-enters and the new name also fails, repeat the prompt. Track any repos kept with placeholder metadata to report at the end.

## Phase 4: Group Repositories

Auto-group repos by primary language. Map the exact `primaryLanguage.name` string from the GitHub API:

| GitHub language | Group | Display name |
|---|---|---|
| `Go` | `go` | Go |
| `TypeScript` | `typescript` | TypeScript |
| `JavaScript` | `typescript` | TypeScript |
| `Python` | `python` | Python |
| `Swift` | `ios` | iOS |
| `Objective-C` | `ios` | iOS |
| `Kotlin` | `android` | Android |
| `Java` | `android` | Android |
| `HCL` | `infra` | Infrastructure |
| Everything else | `other` | Other |

Print the grouping as informational output (e.g., "`go` (2): payments-api, billing-service / `typescript` (1): checkout-frontend"). Do not ask for confirmation -- proceed directly. Users can edit `repos.json` later to rearrange groups.

## Checkpoint

Before generating files, display accumulated state:
- Mode: {team or personal}
- Name: {display name} / Slug: {slug}
- GitHub owner: {github_owner}
- Tracker: {prefix or "none" or "n/a (personal)"}
- Output: {absolute path}
- Repos: {count} in {group count} groups
- Metadata failures: {list or "none"}

Proceed to file generation.

## Phase 5: Generate repos.json and .gitignore

### repos.json

Build a JSON object. Keys are group names (sorted alphabetically). Values are arrays of repo objects:

```json
{
  "name": "payments-api",
  "repo": "org/payments-api",
  "description": "Payment processing API",
  "language": "Go",
  "defaultBranch": "main",
  "tags": ["go"]
}
```

**Required fields:** `name`, `repo`, `description`, `language`, `defaultBranch`, `tags`.

**tags:** always include the group name as the first tag (e.g., `["go"]` for repos in the `go` group, `["infra"]` for infra). Users can add more tags later; the group name as a default lets `make update TAGS=orders` work out of the box once users add domain tags.

**Optional user-added field:** `ref` (commit SHA, tag, or branch). Not generated by the skill. When a user adds it, `setup.sh` checks out that ref after clone. Document this in the next-steps summary but do not add it automatically.

Use **Write** to create `{output_dir}/repos.json` with 2-space indentation.

### .gitignore

Use **Write** to create `{output_dir}/.gitignore`:

```
# Cloned repos (auto-generated from repos.json -- run 'make gitignore' to update)
{repo_name_1}/
{repo_name_2}/
...

# OS
.DS_Store

# Dependencies and secrets
node_modules/
.env*

# Claude Code -- ignore local files, track shared config, skills, and agents
.claude/*
!.claude/CLAUDE.md
!.claude/skills/
!.claude/agents/
!.claude/rules/
CLAUDE.local.md
```

Repo entries are ALL basenames across all groups, each with trailing `/`.

## Phase 6: Copy Templates and Generate Dynamic Files

### Resolve template directory

Resolve the plugin root to an absolute path. The **Read** tool does NOT expand shell variables like `${CLAUDE_PLUGIN_ROOT}`, so you must capture the absolute path from Bash first:

    Bash: ls ${CLAUDE_PLUGIN_ROOT}/templates/

If this fails, STOP: "Plugin templates not found. Reinstall the workspace plugin."

From the Bash output, derive the absolute `templates_dir` and `references_dir` (the plugin root is the parent of `templates/`). Use these absolute paths — NOT `${CLAUDE_PLUGIN_ROOT}` — for every Read call below.

### Step 1: Create output directory, capture today's date, read all templates (parallel)

Create the output directory and get today's date (used for the `__TODAY__` substitution):

    Bash: mkdir -p {output_dir}/.claude/rules
    Bash: date +%Y-%m-%d

Store the date output as `today`.

Then issue ALL of these **Read** calls in a single message (parallel), using the absolute paths resolved above:
- **Read** `{templates_dir}/Makefile`
- **Read** `{templates_dir}/setup.sh`
- **Read** `{templates_dir}/CLAUDE.md.template`
- **Read** `{templates_dir}/README.md.template`
- **Read** `{templates_dir}/rules/workspace-scope.md`
- **Read** `{references_dir}/template-substitutions.md`

### Step 2: Apply substitutions

Print before starting: "Generating workspace files — the CLAUDE.md template takes a few minutes."

Using the template contents from Step 1:

**CLAUDE.md — apply in this exact order:**
1. **First: mode-specific section removals** (see Mode-Specific Template Adjustments below). Remove entire sections and lines while placeholders are still identifiable.
2. **Second: mode-specific language adjustments** (items 3–5 in Mode-Specific Template Adjustments). These match literal prose, not placeholders.
3. **Third: global substitutions** per the reference file (`__TEAM_NAME__`, `__TODAY__`, `__TRACKER_PREFIX__`, `__DEPLOY_TABLE__`, `__CROSS_REPO__`, `__TRACKER_SECTION__`).

**README.md:** Replace `__TEAM_NAME__` → display name, `__TEAM_SLUG__` → slug, and `your-org` → `{github_owner}` (in both modes — the `gh repo clone` example must resolve to a real org/user). For personal mode, also replace "for the __TEAM_NAME__ team" with "for {display_name} projects", "every engineer on the team gets the same high-quality AI assistance out of the box" with "you get consistent AI assistance across all your projects", and remove the "Personal overrides" section (lines about `CLAUDE.local.md` and sharing with the team).

**Makefile** and **setup.sh**: Copy as-is

### Step 3: Write all output files (parallel)

Issue ALL of these in a single message. **Do NOT re-write repos.json or .gitignore — they were already written in Phase 5.**

- **Write** `{output_dir}/Makefile`
- **Write** `{output_dir}/setup.sh`
- **Write** `{output_dir}/.claude/CLAUDE.md`
- **Write** `{output_dir}/.claude/rules/workspace-scope.md` (copy as-is from template, no substitutions)
- **Write** `{output_dir}/README.md`
- **Write** `{output_dir}/.contract-sources` with the exact content below (empty stub — users add paths later).

```
# Files that define cross-repo contracts. Checked by `make contracts-check`.
# List one path per line, relative to the workspace root.
# Lines starting with # are comments; blank lines are ignored.
#
# Examples:
#   payments-api/openapi.json
#   billing-service/schemas/events.proto
#   shared/src/types/api.ts
```

Then: `chmod +x {output_dir}/setup.sh`

### Mode-Specific Template Adjustments (Personal Mode Only)

**For team mode, skip this entirely** — the template is written for teams by default.

**For personal mode, apply these before global substitutions, in the order listed:**

**Step A — Section removals** (delete the heading AND all content until the next `##` heading):
1. `## Operations`
2. `## Project Tracker` (also removes the `__TRACKER_SECTION__` placeholder)
3. `## Feature Flags`
4. `## Shared Infrastructure`

**Step B — Line removals:**
5. Delete the line containing `Include tracker ticket as [__TRACKER_PREFIX__-1234] in commit messages`
6. In the Repo Map blockquote, delete the text `"context repo, not team-owned" labels, ` (including the trailing comma and space) — personal workspaces don't have the concept of team-owned.

**Step C — Language adjustments** (find and replace these literal strings):
7. In the "Five highest-impact things" blockquote: `things that have burned your team` → `things that have bitten you`
8. In Key Systems / Codenames: `your team's system codenames` → `your system codenames`
9. In Git Workflow: replace the ENTIRE line (including the italic Why clause):
   - From: ``- Never push or merge directly to `main` — always use a branch and open a PR. *Why: direct pushes bypass review and can break shared branches.*``
   - To:   `- Use branches and PRs for significant changes. *Why: keeps history reviewable even on solo projects.*`
10. In Living Documentation: `the team's shared map of the workspace` → `your shared map of the workspace`
11. In Living Documentation: `The team reviews changes to this file like it's source code, because it is.` → `Review changes to this file with the same care you'd give source code — it is source code, for the AI.`

After these adjustments, proceed to global substitutions (step 3 in the ordering above). The `__TEAM_NAME__` placeholder in the title will be replaced with `display_name` by the global substitution — no special handling needed.

## Phase 7: Finalize and Summary

### Git init

If `{output_dir}/.git` already exists, skip.

Otherwise:

    Bash: git init --quiet -b main {output_dir}

### Summary

Display:

```
## Workspace Created!

**Location**: {output_dir}/

### Generated Files
| File | Description |
|------|-------------|
| `repos.json` | {N} repos in {M} groups |
| `.gitignore` | Excludes cloned repos |
| `.claude/CLAUDE.md` | Scaffolded with repo map and deployment table |
| `Makefile` | Workspace commands (setup, update, status, search) |
| `setup.sh` | Bootstrap script (clone, build, plugins) |
| `.claude/rules/workspace-scope.md` | Rules for editing CLAUDE.md in workspace context |
| `README.md` | Workspace documentation with prereqs and plugins |

### Next Steps

> **Note:** Commands below may wrap in your terminal. Remove newlines when copying.

1. Switch to your workspace and clone repos:
   `cd {output_dir} && make setup`
   (Optional: edit `repos.json` first to regroup — groups only affect
   how repos are organized in CLAUDE.md, not what gets cloned)

2. Fill in what code scanning can't discover — the context in `.claude/CLAUDE.md`:
```

**Team mode next steps (2–6):**
```
   - **System codenames** -- internal names Claude can't google
   - **Cross-repo relationships** -- which service calls which, deploy order
   - **Gotchas** -- things that have burned your team (include ticket numbers)

3. Commit the scaffold so you have a clean rollback point:
   `git add . && git commit -m "scaffold"`

4. Let Claude scan the cloned code and enrich your CLAUDE.md -- start Claude (`claude`), then type `/init`. After it finishes, exit and review with `git diff`.

5. See all available workspace commands:
   `make help`

6. Publish to GitHub:
   `gh repo create {github_owner}/{slug}-workspace --private --source=. --push`
```

**Personal mode next steps (2–6):**
```
   - **Cross-repo relationships** -- which project depends on which
   - **Gotchas** -- things that have bitten you before

3. Commit the scaffold:
   `git add . && git commit -m "scaffold"`

4. Let Claude scan the cloned code and enrich your CLAUDE.md -- start Claude (`claude`), then type `/init`. After it finishes, review with `git diff`.

5. See all available workspace commands:
   `make help`

6. Publish to GitHub:
   `gh repo create {github_owner}/{slug}-workspace --private --source=. --push`
```

If there were metadata fetch failures from Phase 3, append:
"**Note**: Could not fetch metadata for: {list}. Update descriptions in repos.json manually."

Then, on a new line below the summary, print this attribution line (plain text, outside any code block):

> *Scaffolded with [alex-tong-engineering](https://alextong.me/toolkit/workspace) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)*

## Error Handling

| Phase | Error | Action |
|-------|-------|--------|
| Pre | User unsure about workspace type | Explain the difference, re-ask |
| Pre | User unsure about existing workspace (team) | STOP, tell them to check with team first |
| 0 | Missing tool or auth | STOP, report ALL missing tools at once |
| 0 | Cannot detect GitHub user | STOP, tell user to run `gh auth login` |
| 1 | Slug empty | Re-ask |
| 1 | Repo already exists on GitHub | Warn, offer rename or continue |
| 1 | Output dir not specified | Always prompt, no silent default |
| 1 | Output dir exists | Warn, ask confirmation, backup CLAUDE.md |
| 2 | Not a repo list | Respond to question, re-print 1e |
| 2 | No valid repos | Show format, re-print 1e |
| 3 | Metadata fetch fails | Prompt user: re-enter, remove, or keep with placeholders |
| 6 | Templates not found | STOP, suggest plugin reinstall |
| 6 | Write failure | Report which file, suggest checking permissions |
| 7 | git init failure | Report error, note files are still usable |

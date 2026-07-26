# alex-tong-workspace

Multi-repo workspace generator for Claude Code. Creates workspaces with shared context, repo registry, and safety defaults — for teams or personal projects.

## Prerequisites

- `gh` (GitHub CLI, authenticated)
- `git`
- `jq`

## Commands

| Command | Description |
|---------|-------------|
| `/alex-tong-workspace:create` | Create a new workspace |
| `/alex-tong-workspace:audit` | Audit an existing workspace for drift — reconciles `repos.json` and `.claude/CLAUDE.md` against GitHub and local state |

## What Gets Generated

Running `/alex-tong-workspace:create` produces a workspace directory with:

| File | Description |
|------|-------------|
| `repos.json` | Repo registry grouped by language, with `tags` for filtering and optional `ref` pinning |
| `.gitignore` | Excludes cloned repos, tracks `.claude/` config |
| `.claude/CLAUDE.md` | AI context scaffolded with cross-repo sections and guidance |
| `.contract-sources` | Stub — list cross-repo contract files here so `make contracts-check` can flag staleness |
| `Makefile` | Workspace commands: `setup`, `update`, `status`, `search`, `contracts-check`, `gitignore` |
| `setup.sh` | Idempotent repo cloning and bootstrap script (supports `TAGS=` filter and `ref` checkout) |
| `README.md` | Workspace documentation |

## Usage

```
/alex-tong-workspace:create
```

The command walks you through:

1. Choose team or personal mode
2. Workspace name and (team mode) project tracker prefix
3. Adding repos (supports user/repo, org/repo, full URLs, SSH URLs)
4. Auto-grouping by language via GitHub API
5. Generates all workspace files
6. Initializes a git repo

After creation, run `make setup` in the new workspace to clone all repos.

## Installation

```bash
/plugin install alex-tong-workspace@alex-tong-toolkit
```

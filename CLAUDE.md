# alex-tong-toolkit — CLAUDE.md

Public GitHub home for the Claude Code skills featured in Alex Tong's YouTube videos. One folder per video. Read the hard rules first, every time; everything after them is convention.

---

## 🚫 HARD RULES — nothing that violates these ever gets committed

This repo is **public**. Anything that reaches git history is effectively permanent: a `git reset` does not scrub GitHub's caches or forks. Prevention is the only real defense, and `scripts/scan-safety.js` enforces the machine-checkable subset.

1. **No secrets, credentials, or personal identifiers.** No API keys or tokens of any format, no files whose *name* implies a credential (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `credentials.json`), no hard-coded home paths (`/Users/<name>`, `/home/<name>`; use `$HOME` or `~`), no personal emails or machine hostnames. If a secret ever lands, rotate it first and worry about history second.
2. **No former-employer material.** No internal tool, service, repo, ticket, channel, or colleague names; no internal metrics; not the employer's name itself, anywhere, including commit messages and branch names. Techniques carry over, provenance does not. If you cannot describe an approach without gesturing at where it came from, leave it out and ask Alex. The enforcement list for this rule is deliberately **not** in this repo; it lives in the gitignored `.safety-scan-local.txt`. Never move those patterns into `scan-safety.js`.
3. **No client-confidential material.** Client work lives in its own private repos and is never named here.
4. **Nothing here phones home.** A skill or script runs on other people's machines. No network calls, no telemetry, no uploads. Local files it writes are `chmod 600`. Hooks never block Claude Code on failure.
5. **No dangerous file-system operations.** No `rm -rf`, no `sudo`, no writes outside `~/.claude/` or the current working directory.
6. **No content that targets or embarrasses a named real person.**

**Enforcement.** Opt in locally with `git config core.hooksPath .githooks`, which runs the scanner on staged files before every commit. The `Safety scan` GitHub workflow runs it on every push and pull request. On a fresh machine, recreate `.safety-scan-local.txt` (one literal per line, `#` comments) before committing anything.

---

## What this repo is

- **The source of truth, and a plugin marketplace.** (Decided 2026-09-15; it was a mirror of `skool-artifacts` before that.) Every skill, script, and `VERSION` is edited here. `.claude-plugin/marketplace.json` at the root lists each plugin; each plugin folder carries `.claude-plugin/plugin.json`. Users install with `/plugin marketplace add alextongme/alex-tong-toolkit` and get updates with `/plugin update`. The Skool Classroom pages are pointers to this repo, not copies. `~/Documents/webdev/alex-tong/skool-artifacts` is retired for skills; do not sync from it.
- **Only video-shipped packages are public.** A package enters this repo the day its video is live. Until then it lives on a branch here, unmerged.
- **The Kitchen owns the changelog and Q&A.** Do not add a changelog, discussions, or issue templates here. The README points at [alextong.me/kitchen](https://alextong.me/kitchen) for both.

## Layout

```
.claude-plugin/marketplace.json   the marketplace: one entry per plugin, with its version
<package>/                 one folder per published video
  .claude-plugin/plugin.json  plugin manifest; version must match VERSION and the marketplace entry
  README.md                what a user reads, and what GitHub renders when they open the folder; marketplace install first, manual copy second. (Scripts still use INSTALL.md.)
  VERSION                  semver; the human-readable copy of the version in plugin.json
  skills/<name>/SKILL.md   the skill, when the package is a skill
  *.sh                     the script, when it is a script (scripts are not plugins; they install by copy)
README.md                  the pitch: what is in it, one line per entry, install, the video, the Kitchen link
scripts/scan-safety.js     the safety scanner (credential formats and generic patterns only)
.githooks/pre-commit       runs the scanner on staged files, opt-in
```

## Releasing a version

1. Edit the skill. Bump the version in **three places, all the same string**: `<package>/VERSION`, `<package>/.claude-plugin/plugin.json`, and the plugin's entry in `.claude-plugin/marketplace.json`. Users only receive an update when the version field changes.
2. Update the version in the package's `README.md` header and its Versions list, and, if anything about the install changed, its steps.
3. Commit on a branch in a worktree under `.claude/worktrees/`, merge to `main`, remove the worktree.
4. Post the one-line changelog in the Kitchen and update the version shown on the package's Classroom page.

## Adding the next video's package

1. Confirm the video is public.
2. Create the folder with `skills/`, `README.md`, `VERSION`, and `.claude-plugin/plugin.json`; add its entry to `.claude-plugin/marketplace.json`.
3. Add its row to the root README and, if the install differs from the marketplace commands, one sentence pointing at its folder.
4. Release as above.

## Conventions

- Skills use `model: inherit`. A pinned model silently switches the user's session model for the turn, and a plan that lacks the pinned model falls back anyway. If a skill genuinely needs a stronger model, say so in its `README.md` instead of pinning.
- Read-only skills declare `disallowed-tools` for `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, and `Bash`. `allowed-tools` only pre-approves tools; it never restricts them, so never describe a skill as read-only on the strength of `allowed-tools` alone.
- Attribution inside a skill points at The AI Kitchen, never at `alextong.me/toolkit` (dead) or the newsletter.
- Pushing straight to `main` is allowed; this is a single-author repo. Still scope `git add` to named files.

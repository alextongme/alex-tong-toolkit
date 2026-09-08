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

- **A mirror, not a source.** The editable source for every package is `~/Documents/webdev/alex-tong/skool-artifacts/src/<package>/`. Never edit a skill, script, or `VERSION` here. Edit the source, bump `VERSION` there, then sync. `INSTALL.md` is the one file written here, for a GitHub clone; the Skool zip carries its own.
- **Only video-shipped packages are public.** A package enters this repo the day its video is live. Until then it exists only in The AI Kitchen on Skool. Do not sync the whole source tree.
- **The Kitchen owns the changelog and Q&A.** Do not add a changelog, discussions, or issue templates here. The README points at [alextong.me/kitchen](https://alextong.me/kitchen) for both.

## Layout

```
<package>/                 one folder per published video; skills, scripts, VERSION byte-identical to skool-artifacts/src/<package>/
  INSTALL.md               what a user reads; written for a GitHub clone, paths from the repo root
  VERSION                  semver, bumped in the source, never here
  skills/<name>/SKILL.md   the skill, when the package is a skill
  *.sh                     the script, when it is a script
README.md                  the pitch: what is in it, one line per entry, install, the video, the Kitchen link
scripts/scan-safety.js     the safety scanner (credential formats and generic patterns only)
.githooks/pre-commit       runs the scanner on staged files, opt-in
```

## Syncing a package

```bash
rsync -a --delete --exclude INSTALL.md ~/Documents/webdev/alex-tong/skool-artifacts/src/<package>/ <package>/
diff -r -x INSTALL.md ~/Documents/webdev/alex-tong/skool-artifacts/src/<package> <package>   # no output means identical
```

Then update the version in the package's `INSTALL.md` header and, if anything about the install changed, its steps. Add or update the package's row in the README table, with the video it came from. That is the whole release. No manifest, no version file at the root, no marketplace.

## Adding the next video's package

1. Confirm the video is public.
2. Sync the package as above.
3. Add its README row and, if the install differs from a folder copy, one sentence pointing at its `INSTALL.md`.
4. Commit on a branch in a worktree under `.claude/worktrees/`, merge to `main`, remove the worktree.

## Conventions

- Each skill pins the model that fits its job: `claude-opus-5` for judgment-heavy work, `claude-sonnet-5` for mechanical work, never `claude-fable-5-1` in a public skill. Change pins in the source, not here.
- Attribution inside a skill points at The AI Kitchen, never at `alextong.me/toolkit` (dead) or the newsletter.
- Pushing straight to `main` is allowed; this is a single-author repo. Still scope `git add` to named files.

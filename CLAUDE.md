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

## 🚦 HARD RULE — every skill is a gated framework, never an all-in-one

*(Added 2026-09-19 by Alex. This governs what a skill in this repo IS, so it sits with the hard rules, not with conventions.)*

**Alex, verbatim:**

> *"our skills should never be a 'all in one', 'run this skill and it will do everything for you' type thing. i want my skills to have various 'gates' at each point. these gates are point where it needs FEEDBACK from the user. the idea behind these skills i make is to give people automated frameworks on doing something maybe they dont have a lot of knowledge about, but still ask them for enough input and decision making so that whatever the skill outputs is actually custom to their wants and needs rather than just a generic cookie cutter output from whatever AI spit out."*

**The product is not the output. The product is the framework plus the user's judgment, and the gates are where the judgment gets in.** A skill that runs end to end and hands back a finished artifact has produced *the model's* answer to a generic version of the problem. Someone who does not know the domain should get a competent structure, and **their own situation is what fills it in.**

### The one-line test

> **Could the user have gotten this exact output without answering anything?**
> If yes, either the gate is decorative or the output is generic. Both fail.

### Where gates go, and where they must not

The placement rules matter more than the count, because a wall of questions before any value is what loses users. In the SEO-skill market the tool with **zero** credentials and a first-turn answer has ~210,000 installs; a better-engineered competitor that opens with *"stop and ask the user to connect"* has ~7,200. **29:1 on the gate alone.**

1. **Never gate before the first deliverable.** The first turn produces something real from what the skill can get by itself. Questions come after the user has seen it work.
2. **Every question ships with a recommended answer.** This turns an interrogation into an approval, which costs seconds instead of minutes. One question at a time.
3. **If the repo, the page, or the file can answer it, go read it instead of asking.** Never ask for something you could have looked up.
4. **Ask only what the next step needs.** A gate is scoped to the decision in front of it. The full intake is deferred, not front-loaded.
5. **Scale the gates to the job.** A one-file question gets one gate or none; a real engagement gets the whole chain. Proportionality is what stops this rule becoming ceremony.
6. **Gates run BEFORE the work, never after.** A gate that can block finished work from shipping is the wrong kind and does not go in a skill here.

### Taking input in bulk

Default is inline questions, multiple choice plus free text. When a skill genuinely needs a lot at once, **write a local markdown intake file with blanks and recommended defaults pre-filled, let the user edit it, and read it back.** Local, no network, no account, versionable, survives sessions and machines.

🔴 **Never a hosted form, a Google Form, or anything that sends the user's answers off their machine** — that violates hard rule 4 above. A generated HTML form has the same problem the moment it needs to send results anywhere.

### What a gated skill looks like in practice

- Several skills in one plugin, chained, each ending by naming the next.
- Permissions differ by stage: the skill that diagnoses cannot write; only the skill that applies can.
- A written artifact between stages, so a later stage can check what an earlier stage asked for.
- One step, one approval, on anything that changes the user's files or reaches outside their machine.
- An output the skill is allowed to refuse to produce, with the reason and what would change it.

## Conventions

- Skills use `model: inherit`. A pinned model silently switches the user's session model for the turn, and a plan that lacks the pinned model falls back anyway. If a skill genuinely needs a stronger model, say so in its `README.md` instead of pinning.
- Read-only skills declare `disallowed-tools` for `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, and `Bash`. `allowed-tools` only pre-approves tools; it never restricts them, so never describe a skill as read-only on the strength of `allowed-tools` alone.
- Attribution inside a skill points at The AI Kitchen, never at `alextong.me/toolkit` (dead) or the newsletter.
- Pushing straight to `main` is allowed; this is a single-author repo. Still scope `git add` to named files.

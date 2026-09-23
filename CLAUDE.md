# alex-tong-toolkit — CLAUDE.md

Public GitHub home for the Claude Code skills featured in Alex Tong's YouTube videos. One folder per video. Read the hard rules first, every time; everything after them is convention.

---

## 🚫 HARD RULES — nothing that violates these ever gets committed

This repo is **public**. Anything that reaches git history is effectively permanent: a `git reset` does not scrub GitHub's caches or forks. Prevention is the only real defense, and `scripts/scan-safety.js` enforces the machine-checkable subset.

1. **No secrets, credentials, or personal identifiers.** No API keys or tokens of any format, no files whose *name* implies a credential (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `credentials.json`), no hard-coded home paths (`/Users/<name>`, `/home/<name>`; use `$HOME` or `~`), no personal emails or machine hostnames. If a secret ever lands, rotate it first and worry about history second.
2. **Nothing confidential, from anywhere.** No internal tool, service, repo, ticket, channel, or colleague names, and no internal metrics, from any organisation. Work done for someone else lives in its own private repo and is never named here. **Confidential provenance never carries over; public credit does.** If an approach came from a *public* source — an open-source skill, a repo, a post — name it. If it came from anywhere non-public and cannot be described without gesturing at where it came from, leave it out and ask Alex. The enforcement list is deliberately **not** in this repo; it lives in the gitignored `.safety-scan-local.txt`, and those patterns never move into `scan-safety.js`.
3. **Nothing here phones home.** A skill or script runs on other people's machines. No telemetry, no uploads, no analytics, no crash reports — nothing reaches anything Alex controls, ever. **Network calls are allowed only to two places: the user's own site, and third-party APIs the user configured with their own credentials.** Every such call is named in the package's `README.md` before it ships, the user's credentials stay in their keychain and are never printed, and a package that cannot list its outbound hosts does not ship. Local files it writes are `chmod 600`. Hooks never block Claude Code on failure.
4. **Nothing here does dangerous file-system operations on a user's machine.** No `rm -rf`, no `sudo`, no writes outside `~/.claude/` or the current working directory. This binds the shipped skill or script, not your work in this repo. **One named exception** (Alex, 2026-09-22): `session-topics` writes its LaunchAgent plist to `~/Library/LaunchAgents/com.alextong.session-topics.plist` — that single file, named in its `INSTALL.md`, removed by its `uninstall.sh`. Any other exception needs Alex's call.
5. **No content that targets or embarrasses a named real person.**

**Enforcement.** Opt in locally with `git config core.hooksPath .githooks`, which runs the scanner on staged files before every commit. The `Safety scan` GitHub workflow runs it on every push and pull request. On a fresh machine, recreate `.safety-scan-local.txt` (one literal per line, `#` comments) before committing anything.

---

## What this repo is

- **The source of truth, and a plugin marketplace.** (Decided 2026-09-15; it was a mirror of `skool-artifacts` before that.) Every skill, script, and `VERSION` is edited here. `.claude-plugin/marketplace.json` at the root lists each plugin; each plugin folder carries `.claude-plugin/plugin.json`. Users install with `/plugin marketplace add alextongme/alex-tong-toolkit` and get updates with `/plugin update`. The Skool Classroom pages are pointers to this repo, not copies. `~/Documents/webdev/alex-tong/skool-artifacts` is retired for skills; do not sync from it.
- **Only video-shipped packages are installable.** A package is listed (marketplace entry, root README row) the day its video is live. Until then it lives on a branch here, unmerged — or, when Alex says so, on `main` unlisted with its installer locked behind `--preview` (`session-topics`, 2026-09-22). Releasing it means deleting the lock and listing it.
- **The Kitchen owns the install commands, the changelog and Q&A.** (Install moved there 2026-09-22.) Do not add a changelog, discussions, or issue templates here, and do not put the marketplace-add or plugin-install commands in any README or `page.md`. The READMEs point at [alextong.me/kitchen](https://alextong.me/kitchen) for all three. The gate is soft on purpose: the manifest and the code stay public, so anyone who can read them can install. The target audience can't, and the code stays checkable.
- **alextong.me renders each listed package's `page.md` as its page** at `alextong.me/toolkit/<package>` (2026-09-22). The site fetches `.claude-plugin/marketplace.json` and each `page.md` from `main` on GitHub and refreshes within an hour, so a merge here updates the site with no site commit. **Listing a package in the marketplace publishes its page.** The site's loader is `src/lib/toolkit.ts` in the `alextong.me` repo.

## Layout

```
.claude-plugin/marketplace.json   the marketplace: one entry per plugin, with its version
<package>/                 one folder per published video
  .claude-plugin/plugin.json  plugin manifest; version must match VERSION and the marketplace entry
  page.md                  the package's page on alextong.me/toolkit/<package>; the full explanation lives here, see "page.md contract" below
  README.md                the GitHub stub: one-line description, version line, link to the page, "install lives in the Kitchen", Versions list. (Scripts still use INSTALL.md.)
  VERSION                  semver; the human-readable copy of the version in plugin.json
  skills/<name>/SKILL.md   the skill, when the package is a skill
  *.sh                     the script, when it is a script (scripts are not plugins; they install by copy)
README.md                  the pitch: what is in it, one line per entry, install, the video, the Kitchen link
scripts/scan-safety.js     the safety scanner (credential formats and generic patterns only)
.githooks/pre-commit       runs the scanner on staged files, opt-in
```

## page.md contract

`page.md` is rendered on alextong.me as the package's page. It is written as a page, not as a README.

- **Frontmatter:** `title` (the display name, e.g. `CLAUDE.md Audit`). Optional `video` (a YouTube URL) and `video_title`, only once the video is public. The page's lede is the package's `description` in `marketplace.json`, so there is one description, not two.
- **Map group and type.** The site's map groups plugins by job, from the plugin's `category` in `marketplace.json` (lowercase, hyphenated: `audits`, `session-tools`; the site shows "Session tools"). Group by what the tool is for, never by what it is. What it is goes in `page.md` frontmatter as `kind: skill`, `kind: hook` or `kind: script`, shown as a tag on its row; it defaults to `skill`. A plugin that only installs hooks, like `skill-banner`, is `kind: hook`.
- **A plugin with several skills** lists them in its frontmatter, in the order the map shows them: `skills: [seo-audit, seo-setup]`. Each listed skill gets its own page from `<package>/skills/<skill>/page.md`, which follows this same contract plus a required `description` (the skill page's lede). The plugin's `page.md` becomes the group's Overview. The site's left-side map shows plugins as numbered groups and their skills as 2.1, 2.2 under them. It cannot discover skills from the folder, so a skill that isn't listed has no page. A listed skill without a `page.md` fails the site build, and so does a skill that lists skills of its own.
- **Every page shares one flat URL space,** `alextong.me/toolkit/<slug>`, whether it is a plugin or a skill. A skill's slug must never match another plugin's or skill's; the site's build fails if two pages share one. Once a URL is in a video description it is permanent, so never rename a slug that has shipped.
- **Four `##` sections, exact text:** `What it does`, `When to reach for it`, `What it touches` (every file read and written, every network call, or the line that there are none), and `It's working if`. Any other `##` section is fine and renders in file order.
- **Never an install or update command.** The site's test suite fails the build if the page contains `/plugin marketplace add` or `/plugin install`.
- **CommonMark only.** No tables, no raw HTML, no bare URLs. The site renders without GitHub-flavored markdown and strips HTML. Use lists instead of tables and `[text](url)` for links.
- **Voice:** the site's public copy rules apply. No em dashes, contractions, plain words.
- **Credit goes in a `## References` section at the end:** one linked line per source with a few words on why it's there, no narrative about the inspiration (Alex, 2026-09-22). This is how hard rule 2's "name public sources" is met on a page.

## Releasing a version

1. Edit the skill. Bump the version in **three places, all the same string**: `<package>/VERSION`, `<package>/.claude-plugin/plugin.json`, and the plugin's entry in `.claude-plugin/marketplace.json`. Users only receive an update when the version field changes.
2. Update the version in the package's `README.md` header and its Versions list. If the change alters what the package does, touches or prints, update its `page.md` in the same commit, because the site shows that file.
3. Commit on a branch in a worktree under `.claude/worktrees/`, merge to `main`, remove the worktree.
4. Post the one-line changelog in the Kitchen and update the version shown on the package's Classroom page. If the install steps changed, update the Kitchen's install lesson.

## Adding the next video's package

1. Confirm the video is public.
2. Create the folder with `skills/`, `page.md`, `README.md`, `VERSION`, and `.claude-plugin/plugin.json`; add its entry to `.claude-plugin/marketplace.json`. The marketplace entry is what puts its page on alextong.me, so `page.md` has to be ready first.
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
- Attribution inside a skill points at The AI Kitchen, never at `alextong.me/toolkit` or the newsletter. The Kitchen is where a user of an installed skill goes for updates and questions.

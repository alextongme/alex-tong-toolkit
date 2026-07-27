# alex-tong-toolkit — CLAUDE.md

This file governs any Claude Code session (or human) working in this repo. **Read the hard-rules block first, every time.** Everything else is convention; the hard rules are non-negotiable and enforced by a scanner in CI and (opt-in) in a pre-commit hook.

---

## 🚫 HARD RULES — nothing that violates these ever gets committed

This repo is (or may become) **public**. Anything committed to git history is **effectively permanent** on a public repo — a `git reset` doesn't scrub it from GitHub's caches, and GitHub advises rotating any secret that ever touched a public repo. The rules below exist because prevention is the only real defense.

The `scripts/scan-safety.js` scanner enforces the machine-checkable subset of these rules. Everything else is judgment; when in doubt, don't push.

### Rule 1 — No secrets, credentials, or personal identifiers

**Never commit:**
- API keys, tokens, or credentials of any kind. Specifically banned patterns (scanner blocks):
  - Anthropic API keys (`sk-ant-...`)
  - OpenAI API keys (`sk-...` with 20+ chars, when clearly a key)
  - GitHub Personal Access Tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`)
  - AWS access keys (`AKIA[0-9A-Z]{16}`) and secret access keys
  - Google service-account JSON, Google API keys (`AIza...`)
  - Slack tokens (`xox[baprs]-...`)
  - Private keys of any kind (`-----BEGIN ... PRIVATE KEY-----`)
- Files whose *name* implies a credential — even if the contents look empty. Scanner rejects on filename: `.env`, `.env.local`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_dsa`, `id_ecdsa`, `id_ed25519`, `credentials.json`, `service-account*.json`, `aws-credentials*`, `google-credentials*`.
- Hard-coded home directory paths (`/Users/<name>`, `/home/<name>`) — they reveal the author's identity. Use `$HOME` or `~` at runtime; never hard-code a username.
- Personal email addresses. Support email or byline links are fine (see byline rule below).
- Real hostnames of personal machines. Test/example values only in fixtures.

**If a secret ever gets committed and pushed:**
1. Rotate the secret immediately — assume it's compromised.
2. Then (and only then) worry about rewriting history — but the rotation is what actually matters, because the leaked value can be scraped in seconds.

### Rule 2 — No former-employer confidential information

Nothing from a previous employer belongs in this repo. Hard-blocked:

- Internal tool, plugin, service, or repository names.
- Internal URLs, ticket/project keys, Slack channels, wiki pages, private domains.
- Names of former colleagues or teams.
- Details of internal systems, and their security details especially. Ever.
- Unreleased products or projects.
- Internal business metrics, revenue figures, subscriber numbers, dashboards.
- Anything labeled internal, confidential, or under NDA.
- The employer's name itself, in any form, anywhere in this repo — including commit messages, branch names, and file paths.

**The enforcement list for this rule is deliberately not in this repo.** It lives in the gitignored `.safety-scan-local.txt` (see Enforcement). A blocklist of confidential identifiers, committed in order to block them, publishes the exact thing it was written to protect. Do not "helpfully" move those patterns back into `scripts/scan-safety.js` — that is the failure mode, not the fix.

Techniques and general engineering lessons carry over freely; **provenance does not.** Describe an approach on its own merits with no reference to where it came from. Paraphrases that still point back ("from my time at a large publisher") are violations too — the correct amount of provenance here is zero. If you can't describe it without gesturing at the source, leave it out and ask Alex.

### Rule 3 — No client-confidential material

Client / NDA-grade work lives in its own private repo and never comes here — do not name that repo in this one either. If a plugin idea originated in client work, the generic concept can be adapted, but never named, never dated to a specific engagement, never quoting client-specific details.

### Rule 4 — No plugin that exfiltrates data by default

Plugins in this toolkit run on other people's machines. That is a **trust position**, not a data-collection opportunity.

- **No plugin sends anything anywhere over the network by default.** No telemetry, no phone-home, no "analytics." A plugin that logs locally (like `alex-tong-skill-stats`) is fine; a plugin that uploads is not — unless the entire plugin's purpose is uploading and the user explicitly triggers it every time.
- **Files a plugin writes must be readable only by the user.** Default to `chmod 600` on any log or state file. `~/.claude/skill-usage.jsonl` is the reference pattern.
- **A plugin's hooks must never block Claude Code on failure.** `set +e`, `exit 0`, non-blocking file operations. A slow or broken hook must not degrade the user's session.
- **Never invoke `curl` / `wget` / any network call from a plugin script without an obvious user-visible reason.** If a plugin needs network access, it goes in the description, in the README, and in the trigger.

### Rule 5 — No dangerous file-system operations

- **Never `rm -rf` anything from a plugin script.** Especially not with variable expansion. If a plugin needs to delete something, it prompts the user first through Claude, not shell.
- **No `sudo`, no `chmod` outside the plugin's own state dir, no `chown`.**
- **No writing anywhere outside `~/.claude/`, `$CLAUDE_PLUGIN_ROOT`, or the current working directory.** Never write to `/tmp` on someone else's machine (leaves cruft), never write to `~/`, never write to `/etc`.

### Rule 6 — No content that could target or embarrass a named person

- Do not commit examples, fixtures, or SKILL.md content that names a specific real person (other than Alex himself) in an unflattering or targeting way — including former colleagues, competitors, or public figures.
- Do not include example prompts that would generate content targeting a real person.

---

## Enforcement

**Local (opt-in, strongly recommended):**
```bash
git config core.hooksPath .githooks
```
This turns on the pre-commit scanner (`.githooks/pre-commit`), which runs `scripts/scan-safety.js` against staged files and refuses to commit anything that matches a hard-block pattern.

**CI (mandatory, always on):**
The `Validate marketplace` workflow (`.github/workflows/validate.yml`) runs `scan-safety.js` against every file in the repo on every push and PR. A hard-block match fails the build.

**Local patterns (gitignored — this is where the real blocklist lives):**
`.safety-scan-local.txt` at the repo root holds every identifying pattern: former-employer tool and product names, client repo names, personal emails, private domains, machine hostnames. It is gitignored, so it never leaves the machine, and the scanner applies its patterns on top of the generic ones in `scan-safety.js`.

This split is the whole design. `scan-safety.js` is committed and therefore may only contain **credential formats** (key prefixes, private-key headers) — patterns that describe a *shape*, not an *identity*. Anything that names a real employer, client, or person goes in the local file. Enforcement is identical either way; only the disclosure differs.

Because the file is local, it does not travel with a clone. On a new machine, recreate it before committing anything.

**Format** of `.safety-scan-local.txt`:
```
# Comments start with #. One pattern per line. Blank lines ignored.
# Patterns are treated as literal strings (case-insensitive).
you@example.com
/Users/YOUR-REAL-HOME-USERNAME
```

---

## Repo conventions (not hard rules)

### Versioning

Bump the version in `.claude-plugin/marketplace.json` (both `metadata.version` and each affected plugin's `version`) and the corresponding `plugins/<name>/.claude-plugin/plugin.json` on every push that changes behavior. Cache keys on `version`; without a bump, existing installs serve stale files.

Semver: patch for fixes, minor for features / enforcement changes, major for breaking changes.

### Structure

```
.claude-plugin/marketplace.json          # top-level marketplace registry + renames map
plugins/<plugin-name>/
  .claude-plugin/plugin.json             # plugin manifest
  README.md                              # what this plugin is and who it's for
  skills/<skill-name>/SKILL.md           # skill (frontmatter + prompt) — ONE level deep
  hooks/hooks.json                       # optional PreToolUse / PostToolUse hooks
  scripts/*.sh                            # optional shell backing hooks
in-progress/<name>/                      # built, not shipped, absent from marketplace.json
.agents/adr/                             # architecture decision records
```

### Plugins are grouped by audience, not by tool

A plugin is the unit of installation and it is **all-or-nothing** — there is no way to install part of one. So the plugin boundary is the only lever for what lands in someone's skill list, and it gets drawn around *who the skills are for*: `alex-tong-engineering`, `alex-tong-education`, `alex-tong-career`.

**Exception — a plugin that ships hooks stays standalone.** Installing is consenting. Folding a hook-carrying plugin into a bigger one means everyone who wanted the bigger one silently starts running the hook, which is the trust violation Rule 4 exists to prevent. `alex-tong-skill-stats` is separate for exactly this reason.

Full reasoning: [`.agents/adr/0001-audience-scoped-plugins.md`](.agents/adr/0001-audience-scoped-plugins.md).

### Two structural rules that are easy to get wrong

**1. `skills/` is flat — exactly one level.** `plugins/<plugin>/skills/<skill>/SKILL.md`, never deeper. The loader scans one level below each skills root; anything nested deeper is **dropped silently** — the skill doesn't load, no warning fires, and `claude plugin validate` still passes. Verified empirically, not inferred. `validate-skills.js` now fails the build on it. If you want grouping, add a plugin.

**2. A skill's identity is its DIRECTORY name.** The frontmatter `name` field is **not read** for identity — a skill in `skills/foo/` resolves to `foo` no matter what `name` says. Also verified empirically. Because that makes `name` pure documentation, and documentation drifts, `validate-skills.js` pins it: `name` must equal `"<plugin-manifest-name>:<skill-directory>"`. Rename a directory or a plugin and CI tells you what else to update.

### Renaming or moving a plugin

Add an entry to the `renames` map in `marketplace.json` (old name → new name). Claude Code loads the plugin under its new name, prints a one-line notice, and rewrites the user's `enabledPlugins` automatically. Without it, everyone with the old plugin installed silently loses it.

### Contributing

Every skill must:
1. Live at `plugins/<plugin>/skills/<skill-name>/SKILL.md`, one level deep.
2. Have YAML frontmatter `name: "<plugin>:<skill-dir>"` matching the manifest and directory exactly, and a trigger-loaded description including negative examples (`Do NOT use for: ...`).
3. Include the standardized byline: `> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)`
4. Follow the skill spec: Overview, Quick Reference, Requirements for Outputs, Process, worked Example, Edge Cases.
5. Pass `bash tests/run.sh` — parse-all-json, validate-marketplace, validate-skills, scan-safety, and fixture tests. Same as CI.

Not ready to ship? Put it in `in-progress/` and leave it out of `marketplace.json`. It is still validated, so a draft can't rot below the shipped bar.

### Cross-references between skills

When one skill names another in its description or body, it must use the **resolved** name (`alex-tong-engineering:claude-md-audit`), not a historical one. Regrouping plugins changes these, and a stale cross-reference points a user at a command that no longer exists. Grep before you finish.

---

*Last updated: July 26, 2026*

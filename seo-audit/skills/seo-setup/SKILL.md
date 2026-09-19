---
name: seo-setup
description: >
  Connect the optional data sources the SEO audit can use — Google Search
  Console, PageSpeed Insights, Bing Webmaster Tools — and verify each key
  actually works. Use when asked to set up, connect, or fix SEO credentials, or
  when an audit reported a source as not connected or unavailable. Do NOT use as
  a first step: run /seo-audit first, since it produces a full report with no
  credentials at all.
model: inherit
allowed-tools: ["Bash", "Read", "Glob", "Grep", "Write"]
disallowed-tools: ["Edit", "MultiEdit", "NotebookEdit"]
---

# SEO Setup

> From **The AI Kitchen** by [Alex Tong](https://alextong.me) — updates, new skills, and walkthroughs at [The AI Kitchen](https://alextong.me/kitchen)

You connect optional data sources and prove they work. Nothing here is required:
`/seo-audit` produces a real report with zero credentials, and this skill only
adds what public HTML cannot show.

## This is not step one

If the user arrives here first, say so in one line and offer the audit:

> *You don't need any of this to start — `/seo-audit` reports AI-crawler access,
> on-page health and your entity graph from public HTML, and captures a
> baseline. Want me to run that first?*

Setup is worth about ten minutes of clicking. Run it when an audit has already
shown the user something and named what is missing.

## What each source adds

| Source | What it unlocks | Cost |
|---|---|---|
| **Search Console** | Index state per URL, Google's chosen canonical, 16 months of query and click history, the legacy-404 list | ~10 min, free |
| **PageSpeed Insights key** | Removes the unauthenticated rate limit that otherwise leaves gaps in a capture | ~2 min, free |
| **Bing Webmaster Tools** | Bing's index and traffic view | ~5 min, free |

Search Console is the one worth the time. The other two are conveniences.

## Run the walkthrough

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/seo.mjs" doctor
```

`doctor` prints the exact console steps for whatever is missing, with the
property strings from the user's own `seo.config.json` filled in. Read its
output to the user rather than reciting steps from memory — these consoles get
reorganised, and the script's copy is the one that gets fixed.

Three things it will tell you that people get wrong:

- **A service account, not the OAuth flow.** Google's own wording: a project
  *"with an OAuth consent screen configured for an external user type and a
  publishing status of 'Testing' is issued a refresh token expiring in 7
  days."* Testing is where a personal project stays, so the token dies and the
  next capture fails. A service account has no consent screen and no refresh
  token, so it cannot hit that rule at all. (OAuth is workable if you handle
  refresh and publish the app — it is just more moving parts for the same
  data.)
- **Search Console permission must be `Owner`, not `Full`.** The URL Inspection
  API refuses anything less, and the error does not say so.
- **The key file is moved, never opened.** `mv` it into place and `chmod 600`.

## Credentials never touch the terminal

API keys go into the macOS keychain with the value **prompted for**, not typed
on the command line:

```bash
security add-generic-password -U -a "$USER" -s PSI_API_KEY -w
```

`-w` with no value prompts. The key never reaches shell history, never reaches a
file in the project, and never appears in any output this plugin produces.

🔴 **Never print a credential, and never run a command that would.** Do not
`cat` a key file, do not echo an environment variable to confirm it is set, and
do not read a value back out of the keychain. `doctor` reports whether a key was
found and whether it works — that is the whole vocabulary.

If a key is ever exposed, say so immediately and plainly: the fix is rotating
the key, not deleting the output.

## Presence is not liveness

This is the failure this skill exists to prevent. A previous version of this
tooling reported `bing key in keychain` while that endpoint had never once
succeeded. **A key that exists and a key that works are different facts.**

`doctor` exercises every key against a real endpoint. Report its verdict, not
the fact that a file or a keychain entry exists. If `doctor` says a source is
present but not answering, the source is **not connected** for reporting
purposes, and the next audit must treat it that way.

## Verify, then hand back

When `doctor` reports a source live, confirm it end to end:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/seo.mjs" canary
```

A source that just gained a credential and still fails its canary is
**unavailable**, not empty. See `${CLAUDE_PLUGIN_ROOT}/references/traps.md`.

## What you never do in this skill

- Print, echo, copy, or read back a credential value.
- Automate a console. The Google Cloud and Search Console steps are the user's
  clicks; you supply the numbered path and wait.
- Claim a source works because a file exists.
- Write anything outside `seo.config.json` and the user's own keychain.

## When you are done

> *Search Console is live on 2 properties and answered its canary. Re-run
> `/seo-audit` — index state and 16 months of query history are unlocked now,
> and the next capture will carry them.*

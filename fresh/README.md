# Fresh

**Version 2.0.0** · a Claude Code skill · writes one file · MIT

The restart for when context is running low, has gone polluted, or the session went sideways. It writes a short resume prompt from the conversation and the live git state and puts it on your clipboard. You type `/clear` and paste it.

**How it works, what it touches, and how to tell it's working:** [alextong.me/toolkit/fresh](https://alextong.me/toolkit/fresh?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body)

**Install:** the install and update commands live in [The AI Kitchen](https://alextong.me/kitchen), free to join. That's also where I post the changelog and answer questions.

Everything it runs is in this folder, so you can read every line before you install it.

## Versions

- **2.0.0** (2026-09-22) — Renamed from `handoff` to `fresh`, with the file moved to `~/.claude/fresh/last.md`. The description is corrected: earlier versions said `/compact` cannot capture your corrections or decisions and summarises "at its dullest." Both were wrong — `/compact` does ask for your feedback and corrections, and this skill runs with the same full context it does. The honest difference is how much comes forward, and it is now described that way.
- **1.1.0** (2026-09-22) — No hook. The prompt goes on your clipboard; you type `/clear` and paste it. Earlier versions injected the prompt through a `SessionStart` hook, which also fired on a fresh launch or a bare `/clear` and could drop a leftover prompt into a conversation that had nothing to do with it.
- **1.0.2** (2026-09-22) — The hook accepts a seed written from a folder inside the session's directory, so a `cd` into a worktree or a subfolder during the session no longer makes `/clear` skip it silently.
- **1.0.1** (2026-09-22) — The skill no longer types `/clear` into iTerm2; you type it. Same behavior in every terminal and permission mode.
- **1.0.0** (2026-09-22) — First release.

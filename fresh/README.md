# Fresh

**Version 2.0.0** · a Claude Code skill · writes one file · MIT

The restart for when context is running low, has gone polluted, or the session went completely sideways. `/fresh` writes a short resume prompt from the conversation *and* the live git state, puts it on your clipboard, and you start over clean: `/clear`, paste, keep going.

Questions and the changelog live in [The AI Kitchen](https://alextong.me/kitchen).

## Install

Inside Claude Code:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install fresh@alex-tong-toolkit
```

If `/fresh:fresh` does not show up in the `/` menu, quit Claude Code and start it again. New versions arrive with `/plugin update fresh@alex-tong-toolkit`.

Claude Code files plugin skills under the plugin's name, so this one's full name is `/fresh:fresh`.

**Installed it when it was called `handoff`?** Run `/plugin uninstall handoff@alex-tong-toolkit`, then the two lines above. Same skill, new name.

## When to use it, and when `/compact` is the better call

`/compact` is good. It summarises the session into nine sections, including errors and fixes, what you told Claude to do differently, and every message you typed, and it can be steered: `/compact keep the decisions about the schema`. **If the session is going well and you just ran out of room, use `/compact`.** It keeps more, in one command.

`/fresh` is for the other cases, where keeping more is the problem:

- **Context is running low** and you want the next stretch to start small, not start as a long summary.
- **The context is polluted.** Dead ends, abandoned approaches, a direction you dropped. `/compact` faithfully carries those forward. `/fresh` leaves them behind.
- **The session went sideways** and you want to restart from what is true now, not from how you got here.

What it gives you that a summary inside the session does not:

- **Short on purpose.** 300–600 words, same eight sections every time.
- **Facts from `git`, not memory.** Branch, dirty files, recent commits, and a warning if you are in a worktree.
- **You can read and edit it before it lands.** It is a file and your clipboard, not something that happens to the session.
- **It outlives the session.** Paste it tomorrow, on another machine, or into another tool.

One honest limit: the same session writes the prompt, so it carries the same assumptions `/compact` would. What changes is how much of the old conversation comes with it, not who wrote the summary. If the session got something wrong, correct it before you run `/fresh`, and the correction lands in the prompt as a rule.

## What happens when you run it

```
/fresh:fresh
  → reads pwd, branch, git status, last 8 commits, worktree list
  → writes a 300–600 word resume prompt, never printed
  → saves it to ~/.claude/fresh/last.md and copies it to your clipboard
  → prints: "It is on your clipboard.  1. Type /clear  2. Paste it and press Enter"
/clear, then paste, then Enter
  → the session continues from the prompt, without the history
```

Pass an argument to steer the next session: `/fresh:fresh finish the tests then merge`.

### What the prompt contains

Where you are (worktree, branch, dirty files — from `git`, not memory) · what we're doing · done this session · decided, do not reopen · corrected, rewritten as rules · next, in order · files to read first · skills to invoke.

## What it writes, and what it doesn't

- `~/.claude/fresh/last.md` — the prompt, `chmod 600`. If a paste went wrong, it is still here.
- Your clipboard, through `pbcopy` on macOS, `wl-copy` or `xclip` on Linux, `clip.exe` on Windows. If none of those exist, the receipt tells you to copy the file yourself.
- **Nothing else.** No hook, no network calls. Nothing leaves your machine.

**You type `/clear` and paste it yourself.** The skill never sends keystrokes to your terminal and installs no hook, so nothing on disk can ever land in a conversation you did not paste it into, and it behaves the same in every terminal, on every OS, and in every permission mode.

## If something goes wrong

| | |
|---|---|
| Pasted, and the context looks wrong | Tell Claude what to fix. The prompt is at `~/.claude/fresh/last.md` if you want to read it |
| Changed your mind before `/clear` | Do nothing. Nothing reads the file but you |
| Clipboard was empty | Open `~/.claude/fresh/last.md`, copy it, paste it |
| A secret ended up in the prompt | Rotate it. The file is `chmod 600` and never left your machine, but treat it as exposed |

## Prior art

Writing the session down as a document and starting a new one from it is [Matt Pocock's `/handoff`](https://www.aihero.dev/skills-handoff), which he built for branching a piece of work off into a second session. The insight that a fresh session can beat `/compact` for cost and clarity is [yacb2/claude-session-handoff](https://github.com/yacb2/claude-session-handoff), which relaunches the process. This one restarts in place — `/clear` resets the context and the paste brings the prompt in — so nothing reconnects and nothing is killed. Anthropic has [several](https://github.com/anthropics/claude-code/issues/20267) [open](https://github.com/anthropics/claude-code/issues/35150) [requests](https://github.com/anthropics/claude-code/issues/37307) to let a skill trigger `/clear` directly, which is why you still type it.

## Versions

- **2.0.0** (2026-09-22) — Renamed from `handoff` to `fresh`, with the file moved to `~/.claude/fresh/last.md`. The description is corrected: earlier versions said `/compact` cannot capture your corrections or decisions and summarises "at its dullest." Both were wrong — `/compact` does ask for your feedback and corrections, and this skill runs with the same full context it does. The honest difference is how much comes forward, and it is now described that way.
- **1.1.0** (2026-09-22) — No hook. The prompt goes on your clipboard; you type `/clear` and paste it. Earlier versions injected the prompt through a `SessionStart` hook, which also fired on a fresh launch or a bare `/clear` and could drop a leftover prompt into a conversation that had nothing to do with it.
- **1.0.2** (2026-09-22) — The hook accepts a seed written from a folder inside the session's directory, so a `cd` into a worktree or a subfolder during the session no longer makes `/clear` skip it silently.
- **1.0.1** (2026-09-22) — The skill no longer types `/clear` into iTerm2; you type it. Same behavior in every terminal and permission mode.
- **1.0.0** (2026-09-22) — First release.

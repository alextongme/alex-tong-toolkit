# Handoff

**Version 1.1.0** · a Claude Code skill · writes one file · MIT

`/compact` summarises your session with the model at its dullest — right at the ceiling, with no review — and it carries every correction you made forward as part of the confusion. `/handoff` does the same reset with the summary written on purpose: from the conversation *and* the live git state, at full sharpness, with a section for what you corrected so the next session doesn't repeat it.

You type `/handoff`, then `/clear`, then paste. It writes the resume prompt and puts it on your clipboard, and the next session starts already knowing where it is.

Questions and the changelog live in [The AI Kitchen](https://alextong.me/kitchen).

## Install

Inside Claude Code:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install handoff@alex-tong-toolkit
```

If `/handoff:handoff` does not show up in the `/` menu, quit Claude Code and start it again. New versions arrive with `/plugin update handoff@alex-tong-toolkit`.

Claude Code files plugin skills under the plugin's name, so this one's full name is `/handoff:handoff`. If you already have [Matt Pocock's `/handoff`](https://www.aihero.dev/skills-handoff) in `~/.claude/skills/`, keep it — both stay available. Bare `/handoff` runs his; `/handoff:handoff` runs this one.

## What happens when you run it

```
/handoff
  → reads pwd, branch, git status, last 8 commits, worktree list
  → writes a 300–600 word resume prompt, never printed
  → saves it to ~/.claude/handoff/last.md and copies it to your clipboard
  → prints: "The prompt is on your clipboard.  1. Type /clear  2. Paste it and press Enter"
/clear, then paste, then Enter
  → the session continues where it left off
```

Pass an argument to steer the next session: `/handoff finish the tests then merge`.

### What the prompt contains

Where you are (worktree, branch, dirty files — from `git`, not memory) · what we're doing · done this session · **decided, do not reopen** · **corrected** · next, in order · files to read first · skills to invoke.

The two bold sections are the point. `/compact` cannot write either.

## What it writes, and what it doesn't

- `~/.claude/handoff/last.md` — the prompt, `chmod 600`. If a paste went wrong, it is still here.
- Your clipboard, through `pbcopy` on macOS, `wl-copy` or `xclip` on Linux, `clip.exe` on Windows. If none of those exist, the receipt tells you to copy the file yourself.
- **Nothing else.** No hook, no network calls. Nothing leaves your machine.

**You type `/clear` and paste it yourself.** The skill never sends keystrokes to your terminal and installs no hook, so nothing on disk can ever land in a conversation you did not paste it into, and it behaves the same in every terminal, on every OS, and in every permission mode.

## If something goes wrong

| | |
|---|---|
| Pasted, and the context looks wrong | Tell Claude what to fix. The prompt is at `~/.claude/handoff/last.md` if you want to read it |
| Changed your mind before `/clear` | Do nothing. Nothing reads the file but you |
| Clipboard was empty | Open `~/.claude/handoff/last.md`, copy it, paste it |
| A secret ended up in the prompt | Rotate it. The file is `chmod 600` and never left your machine, but treat it as exposed |

## Prior art

The handoff-as-a-document idea is [Matt Pocock's `/handoff`](https://www.aihero.dev/skills-handoff). The insight that a fresh session beats `/compact` for cost and clarity is [yacb2/claude-session-handoff](https://github.com/yacb2/claude-session-handoff), which relaunches the process. This one keeps the process — `/clear` resets the context and the paste brings the prompt in — so nothing reconnects and nothing is killed. Anthropic has [several](https://github.com/anthropics/claude-code/issues/20267) [open](https://github.com/anthropics/claude-code/issues/35150) [requests](https://github.com/anthropics/claude-code/issues/37307) to let a skill trigger `/clear` directly, which is why you still type it.

## Versions

- **1.1.0** (2026-09-22) — No hook. `/handoff` puts the prompt on your clipboard; you type `/clear` and paste it. Earlier versions injected the prompt through a `SessionStart` hook, which also fired on a fresh launch or a bare `/clear` and could drop a leftover prompt into a conversation that had nothing to do with it.
- **1.0.2** (2026-09-22) — The hook accepts a seed written from a folder inside the session's directory, so a `cd` into a worktree or a subfolder during the session no longer makes `/clear` skip it silently.
- **1.0.1** (2026-09-22) — The skill no longer types `/clear` into iTerm2; you type it. Same behavior in every terminal and permission mode.
- **1.0.0** (2026-09-22) — First release.

# Handoff

**Version 1.0.0** · a Claude Code skill + one hook · writes one file · MIT

`/compact` summarises your session with the model at its dullest — right at the ceiling, with no review — and it carries every correction you made forward as part of the confusion. `/handoff` does the same reset with the summary written on purpose: from the conversation *and* the live git state, at full sharpness, with a section for what you corrected so the next session doesn't repeat it.

You type `/handoff`. It writes the resume prompt, clears the context, and the next session starts already knowing where it is.

Questions and the changelog live in [The AI Kitchen](https://alextong.me/kitchen).

## Install

Inside Claude Code:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install handoff@alex-tong-toolkit
```

Then **quit Claude Code and start it again, once.** Hooks are read when the process launches, so a hook installed mid-session is not loaded until the next launch: `/handoff` would still write the seed, and `/clear` would drop it silently. After that one restart the hook registers with the plugin and stays. New versions arrive with `/plugin update handoff@alex-tong-toolkit`.

If a skill named `handoff` is already in `~/.claude/skills/` (Matt Pocock ships one), delete it first so the two don't collide:

```bash
rm -rf ~/.claude/skills/handoff
```

## What happens when you run it

```
/handoff
  → reads pwd, branch, git status, last 8 commits, worktree list
  → writes a 300–600 word resume prompt, never printed
  → saves it to ~/.claude/handoff/seed.md (+ last.md, + your clipboard on macOS)
  → prints a 3-line receipt: branch, dirty count, next step
  → in iTerm2: types /clear for you. Elsewhere: tells you to.
/clear
  → SessionStart hook sees the seed, checks it was written for this directory,
    injects it, deletes it
  → type anything. The session continues where it left off.
```

Pass an argument to steer the next session: `/handoff finish the tests then merge`.

### What the prompt contains

Where you are (worktree, branch, dirty files — from `git`, not memory) · what we're doing · done this session · **decided, do not reopen** · **corrected** · next, in order · files to read first · skills to invoke.

The two bold sections are the point. `/compact` cannot write either.

## What it writes, and what it doesn't

- `~/.claude/handoff/seed.md` — consumed by the hook on the next session start in the same directory. `chmod 600`.
- `~/.claude/handoff/last.md` — a copy that survives. If a handoff went wrong, `cat` it in the new session.
- Your clipboard, on macOS only, as a backup.
- **Nothing else.** No network calls. Nothing leaves your machine. The hook reads stdin, reads one file, writes stdout.

**In iTerm2 the skill types `/clear` into your session.** It targets your exact session by `$ITERM_SESSION_ID` via AppleScript, only ever sends the string `/clear`, and only after the seed is confirmed saved. Outside iTerm2 it does nothing and asks you to type it. If you'd rather always type it yourself, delete step 5 of `skills/handoff/SKILL.md`.

The hook fires on `startup` too, so quitting and running `claude` again in the same directory resumes the same way. Use that path when you want a fresh process — after updating Claude Code, or when an MCP server has gone stale.

## If something goes wrong

| | |
|---|---|
| Cleared and the context looks wrong | `cat ~/.claude/handoff/last.md` — then tell Claude what to fix |
| Changed your mind before `/clear` | `rm ~/.claude/handoff/seed.md` |
| Seed didn't inject | Either you started in a different directory than you ran `/handoff` in, or you installed mid-session and never restarted (hooks load at launch). The seed is still there either way: quit, run `claude` from the right directory, and the `startup` hook resumes it. |
| A secret ended up in the prompt | Rotate it. The file is `chmod 600` and never left your machine, but treat it as exposed. |

## Prior art

The handoff-as-a-document idea is [Matt Pocock's `/handoff`](https://www.aihero.dev/skills-handoff). The insight that a fresh session beats `/compact` for cost and clarity is [yacb2/claude-session-handoff](https://github.com/yacb2/claude-session-handoff), which relaunches the process. This one keeps the process — `/clear` fires `SessionStart`, and a hook can inject context there — so nothing reconnects and nothing is killed. Anthropic has [several](https://github.com/anthropics/claude-code/issues/20267) [open](https://github.com/anthropics/claude-code/issues/35150) [requests](https://github.com/anthropics/claude-code/issues/37307) to let a skill trigger `/clear` directly; when that ships, the iTerm2 step goes away and nothing else changes.

## Versions

- **1.0.0** (2026-09-22) — First release.

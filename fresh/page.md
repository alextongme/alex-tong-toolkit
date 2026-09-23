---
title: Fresh
kind: skill
---

## What it does

It's the restart for when context is running low, has gone polluted, or the session went completely sideways. `/fresh:fresh` writes a short resume prompt from the conversation *and* the live git state, puts it on your clipboard, and you start over clean: `/clear`, paste, keep going.

```
/fresh:fresh
  -> reads pwd, branch, git status, last 8 commits, worktree list
  -> writes a 300-600 word resume prompt, never printed
  -> saves it to ~/.claude/fresh/last.md and copies it to your clipboard
  -> prints: "It is on your clipboard.  1. Type /clear  2. Paste it and press Enter"
/clear, then paste, then Enter
  -> the session continues from the prompt, without the history
```

Pass an argument to steer the next session: `/fresh:fresh finish the tests then merge`.

Claude Code files plugin skills under the plugin's name, which is why the full command is `/fresh:fresh`.

### What the prompt contains

The same eight sections every time:

1. Where you are: worktree, branch and dirty files, read from `git`, not from memory
2. What we're doing
3. Done this session
4. Decided, do not reopen
5. Corrected, rewritten as rules
6. Next, in order
7. Files to read first
8. Skills to invoke

## When to reach for it

`/compact` is good. It summarises the session into nine sections, including errors and fixes, what you told Claude to do differently, and every message you typed, and you can steer it: `/compact keep the decisions about the schema`. **If the session is going well and you just ran out of room, use `/compact`.** It keeps more, in one command.

`/fresh` is for the other cases, where keeping more is the problem:

- **Context is running low** and you want the next stretch to start small, not start as a long summary.
- **The context is polluted.** Dead ends, abandoned approaches, a direction you dropped. `/compact` faithfully carries those forward. `/fresh` leaves them behind.
- **The session went sideways** and you want to restart from what's true now, not from how you got here.

What it gives you that a summary inside the session doesn't:

- **Short on purpose.** 300 to 600 words, same eight sections every time.
- **Facts from `git`, not memory.** Branch, dirty files, recent commits, and a warning if you're in a worktree.
- **You can read and edit it before it lands.** It's a file and your clipboard, not something that happens to the session.
- **It outlives the session.** Paste it tomorrow, on another machine, or into another tool.

One honest limit: the same session writes the prompt, so it carries the same assumptions `/compact` would. What changes is how much of the old conversation comes with it, not who wrote the summary. If the session got something wrong, correct it before you run `/fresh`, and the correction lands in the prompt as a rule.

## What it touches

- **Writes** `~/.claude/fresh/last.md`, the prompt, with `chmod 600`. If a paste went wrong, it's still there.
- **Writes** your clipboard, through `pbcopy` on macOS, `wl-copy` or `xclip` on Linux, and `clip.exe` on Windows. If none of those exist, the receipt tells you to copy the file yourself.
- **Reads** your conversation and the git state of the folder you're in.
- **Nothing else.** No hook, no network calls. Nothing leaves your machine.

You type `/clear` and paste it yourself. The skill never sends keystrokes to your terminal and installs no hook, so nothing on disk can land in a conversation you didn't paste it into. It behaves the same in every terminal, on every OS, and in every permission mode.

## It's working if

- The receipt says the prompt is on your clipboard, and pasting it shows 300 to 600 words in the eight sections above.
- The prompt names your real branch and your real dirty files, because it read them from `git`.
- After `/clear` and the paste, the new session's first move is the next step on the list, not a question about where you left off.

## If something goes wrong

- **Pasted, and the context looks wrong.** Tell Claude what to fix. The prompt is at `~/.claude/fresh/last.md` if you want to read it.
- **Changed your mind before `/clear`.** Do nothing. Nothing reads the file but you.
- **The clipboard was empty.** Open `~/.claude/fresh/last.md`, copy it, and paste it.
- **A secret ended up in the prompt.** Rotate it. The file is `chmod 600` and never left your machine, but treat it as exposed.

## References

- [Matt Pocock's /handoff](https://www.aihero.dev/skills-handoff): writing the session down and starting a new one from it
- [yacb2/claude-session-handoff](https://github.com/yacb2/claude-session-handoff): the same idea, but it relaunches Claude Code instead of restarting in place
- [anthropics/claude-code#20267](https://github.com/anthropics/claude-code/issues/20267): open request to let a skill trigger /clear, which is why you still type it
- [anthropics/claude-code#35150](https://github.com/anthropics/claude-code/issues/35150): open request to let a skill trigger /clear
- [anthropics/claude-code#37307](https://github.com/anthropics/claude-code/issues/37307): open request to let a skill trigger /clear

---
name: fresh
description: Alex Tong's fresh — restart this session cleanly when context is running low, has gone polluted, or the session went sideways. Writes a short resume prompt from the conversation and live git state and puts it on your clipboard; you type /clear and paste it, and the next session starts lean.
argument-hint: "(optional) what the next session should focus on"
disable-model-invocation: true
model: inherit
---

# /fresh

You are ending this session and seeding a clean one. Do all of this in **one turn**. Do not ask questions. Do not print the resume prompt — it goes to a file and the clipboard, never to the screen.

## 1. Gather facts — never from memory

One Bash call:

```bash
date -u +%Y-%m-%dT%H:%MZ
pwd
git rev-parse --abbrev-ref HEAD 2>/dev/null
git status --short 2>/dev/null
git log --oneline -8 2>/dev/null
git worktree list 2>/dev/null
```

If `pwd` is under a `.claude/worktrees/` path, or `git worktree list` shows it as a linked worktree, the prompt **must** say so in its first lines and forbid `git checkout`. This is the mistake a fresh session makes most.

## 2. Compose the resume prompt

Second person, imperative. It is a prompt the next session **acts on**, not a document it reads. **300–600 words, hard cap.** Reference files by path; never paste their contents. If something is already written down — a plan, a STATUS file, a commit — point at it instead of restating it.

The point is a lean restart. Carry forward what the next session needs to act; leave behind the dead ends, abandoned approaches, and back-and-forth that got you here. If a dead end matters, it goes in as one line under *Decided* or *Corrected*, never as history.

The first line, before any heading, is exactly:

```
Resume from this prompt, written <the date from step 1>. Act on it directly; do not summarise it back to me.
```

Then eight sections, headings verbatim, in this order:

1. `## Where you are` — cwd, worktree path if any, branch, ahead/behind, dirty files, open PR, a dev server if you know one is running. The worktree warning goes here.
2. `## What we're doing` — the goal and why. Three sentences at most.
3. `## Done this session` — bullets, with commit hashes where they exist.
4. `## Decided — do not reopen` — each decision with its one-line reason.
5. `## Corrected` — every time the user corrected you this session, rewritten as a rule the next session follows. The rule, not the story of the mistake.
6. `## Next` — ordered. Step 1 concrete enough to start without asking anything.
7. `## Read first` — the source-of-truth files. Paths only.
8. `## Skills` — slash commands the next session should invoke, if any. Omit the section if none.

If the user passed an argument, it overrides your inference for sections 6–8.

**Redaction.** This text goes to the clipboard and may be on screen in a recording. No API keys, tokens, passwords, or private URLs — including any that appeared earlier in this conversation. Say "the key in the keychain", never the key.

## 3. Save it

One Bash call. It writes the file, then copies it to the clipboard with whichever tool the machine has.

```bash
dir="$HOME/.claude/fresh"; mkdir -p "$dir"; umask 077
cat > "$dir/last.md" <<'FRESH'
...the composed prompt, verbatim...
FRESH
f="$dir/last.md"
if   command -v pbcopy   >/dev/null 2>&1; then pbcopy < "$f"; echo copied
elif command -v wl-copy  >/dev/null 2>&1; then wl-copy < "$f"; echo copied
elif command -v xclip    >/dev/null 2>&1; then xclip -selection clipboard < "$f"; echo copied
elif command -v clip.exe >/dev/null 2>&1; then clip.exe < "$f"; echo copied
else echo "no clipboard tool"; fi
echo "saved $(wc -w < "$f") words"
```

**If this step fails, stop here.** Print the error. Do not tell the user to clear a session whose prompt did not save.

## 4. Print the receipt — nothing else

If step 3 printed `copied`:

```
Resume prompt ready. It is on your clipboard.
  1. Type /clear
  2. Paste it and press Enter
A copy is saved at ~/.claude/fresh/last.md
```

If step 3 printed `no clipboard tool`:

```
Resume prompt ready. It is saved at ~/.claude/fresh/last.md
  1. Open that file and copy everything in it
  2. Type /clear
  3. Paste it and press Enter
```

## 5. Stop

**End your turn immediately.** Say nothing after the receipt. Never type `/clear` for the user, paste for them, or send keystrokes to the terminal — the user types `/clear`, pastes, and the next session continues from the prompt.

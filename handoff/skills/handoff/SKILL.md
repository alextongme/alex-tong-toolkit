---
name: handoff
description: Compact this session by hand. Writes a curated resume prompt from the conversation and live git state; you type /clear and the next session resumes with it — like /compact, but written at full sharpness, and it never carries your corrections forward as confusion.
argument-hint: "(optional) what the next session should focus on"
disable-model-invocation: true
model: inherit
---

# /handoff

You are ending this session and seeding the next one. Do all of this in **one turn**. Do not ask questions. Do not print the handoff — it goes to a file, never to the screen.

## 1. Gather facts — never from memory

One Bash call:

```bash
pwd
git rev-parse --abbrev-ref HEAD 2>/dev/null
git status --short 2>/dev/null
git log --oneline -8 2>/dev/null
git worktree list 2>/dev/null
```

If `pwd` is under a `.claude/worktrees/` path, or `git worktree list` shows it as a linked worktree, the handoff **must** say so in its first lines and forbid `git checkout`. This is the mistake a fresh session makes most.

## 2. Compose the handoff

Second person, imperative. It is a prompt the next session **acts on**, not a document it reads. **300–600 words, hard cap.** Reference files by path; never paste their contents. If something is already written down — a plan, a STATUS file, a commit — point at it instead of restating it.

Eight sections, headings verbatim, in this order:

1. `## Where you are` — cwd, worktree path if any, branch, ahead/behind, dirty files, open PR, a dev server if you know one is running. The worktree warning goes here.
2. `## What we're doing` — the goal and why. Three sentences at most.
3. `## Done this session` — bullets, with commit hashes where they exist.
4. `## Decided — do not reopen` — each decision with its one-line reason.
5. `## Corrected` — every time the user corrected you this session, rewritten as a rule. This is the section `/compact` cannot write.
6. `## Next` — ordered. Step 1 concrete enough to start without asking anything.
7. `## Read first` — the source-of-truth files. Paths only.
8. `## Skills` — slash commands the next session should invoke, if any. Omit the section if none.

If the user passed an argument, it overrides your inference for sections 6–8.

**Redaction.** This text goes to the clipboard and may be on screen in a recording. No API keys, tokens, passwords, or private URLs — including any that appeared earlier in this conversation. Say "the key in the keychain", never the key.

## 3. Save it

One Bash call. The first line of the file is a tag the hook reads: it only injects the seed into a session that starts in this same directory.

```bash
dir="$HOME/.claude/handoff"; mkdir -p "$dir"; umask 077
stamp="$(date -u +%Y-%m-%dT%H:%MZ)"
{
  printf '<!-- handoff cwd=%s written=%s -->\n\n' "$PWD" "$stamp"
  cat <<'HANDOFF'
...the composed handoff, verbatim...
HANDOFF
} > "$dir/seed.md"
cp "$dir/seed.md" "$dir/last.md"
command -v pbcopy >/dev/null 2>&1 && pbcopy < "$dir/seed.md"
echo "saved $(wc -w < "$dir/seed.md") words"
```

**If this step fails, stop here.** Print the error. Do not clear a session whose handoff did not save.

## 4. Print the receipt — four lines, nothing else

```
Handoff ready → clipboard + ~/.claude/handoff/seed.md
  <branch> · <ahead/behind> · <N dirty>     (or: not a git repo)
  next: <section 6, step 1, one line>
  Now type /clear
```

## 5. Stop

**End your turn immediately.** Say nothing after the receipt. Never type `/clear` for the user, send keystrokes to the terminal, or run anything that drives the session — the user types it.

When they do, the `SessionStart` hook picks the seed up, injects it, and deletes it. They type anything to continue.

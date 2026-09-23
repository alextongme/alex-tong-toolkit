---
title: Skill Banner
kind: hook
---

## What it does

It prints one banner the moment a skill starts, whether you typed the slash command or Claude picked the skill on its own:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ RUNNING SKILL   worktree-merge
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

It's two hooks in `hooks/hooks.json` and one script in `scripts/banner.sh`:

- **When you type `/name`,** the `UserPromptSubmit` hook fires, and the script reads your text as typed from the `prompt` field.
- **When Claude picks a skill,** the `PreToolUse` hook fires on the `Skill` tool, and the script reads the skill's name from `tool_input.skill`.

Either way the script answers with a `systemMessage`, and Claude Code prints it before the skill runs. Claude Code puts the hook's name in front of it (`UserPromptSubmit says:` or `PreToolUse:Skill says:`). A hook can't change that, so the box starts on the line below. A plugin skill such as `claude-md-audit:claude-md-audit` shows by its skill name alone, the same both ways.

## When to reach for it

Sometimes Claude fires off skills I'm totally unaware it's using. Other times, I try to fire a skill and I'm not certain if it worked or not. Claude Code starts skills two ways, and both are easy to miss. When Claude picks a skill on its own, the only trace is a tool call that scrolls past. When you type a slash command yourself, nothing confirms it took.

If you've installed more than a couple of skills, this is how you find out which ones Claude actually uses.

## Why a hook and not a CLAUDE.md line

I had this as a CLAUDE.md rule first: "print a banner when you run a skill." A rule is text Claude reads and weighs against everything else in the prompt, including a skill that says "print nothing but the receipt." A hook runs outside the model. Claude Code runs it on the event, every time, whatever the prompt says. The [hooks guide](https://code.claude.com/docs/en/hooks-guide) is the reference.

## What it touches

- **Writes** nothing. No files, no network calls. It needs bash, grep and sed, and nothing else. It runs on macOS and Linux.
- **Never blocks** Claude Code. Every exit is `0`, and `hooks.json` wraps the script in `|| true`.
- **Asks** nothing. There's nothing to customise: the banner is the whole product.
- **Ignores** a pasted path such as `/tmp/notes.md`. That isn't a command, so the script stays quiet on it.

## It's working if

- You type a slash command for any skill, and the banner prints before the skill's first output.
- You ask for something one of your skills covers without naming it, and the banner prints with that skill's name.
- No banner at all means the hooks haven't loaded yet. Hooks load when Claude Code starts, so quit it and start it again.

One known quirk: if a typed command's own instructions make Claude call the `Skill` tool for the same skill, you'll see the banner twice.

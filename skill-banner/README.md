# Skill Banner

**Version 1.0.1** · a Claude Code hook · writes nothing · MIT

Claude Code starts skills two ways, and both are easy to miss. When Claude picks a skill on its own, the only trace is a tool call that scrolls past. When you type a slash command yourself, nothing confirms it took. This plugin prints one banner the moment a skill starts, either way:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ RUNNING SKILL   worktree-merge
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Questions and the changelog live in [The AI Kitchen](https://alextong.me/kitchen).

## Install

Inside Claude Code:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install skill-banner@alex-tong-toolkit
```

Quit Claude Code and start it again; hooks load at startup. New versions arrive with `/plugin update skill-banner@alex-tong-toolkit`.

## What happens

Two hooks in `hooks/hooks.json`, one script in `scripts/banner.sh`.

| When | Hook | What the script reads |
|---|---|---|
| You type `/name` | `UserPromptSubmit` | the `prompt` field, which holds your text as typed |
| Claude picks a skill | `PreToolUse` on the `Skill` tool | `tool_input.skill` |

Either way the script answers with a `systemMessage`, and Claude Code prints it before the skill runs. Claude Code puts the hook's name in front of it (`UserPromptSubmit says:` or `PreToolUse:Skill says:`); a hook cannot change that, so the box starts on the line below. A plugin skill such as `claude-md-audit:claude-md-audit` is shown by its skill name alone, the same both ways.

## Why a hook and not a CLAUDE.md line

I had this as a CLAUDE.md rule first: "print a banner when you run a skill." A rule is text Claude reads and weighs against everything else in the prompt, including a skill that says "print nothing but the receipt." A hook runs outside the model. Claude Code runs it on the event, every time, whatever the prompt says. The [hooks guide](https://code.claude.com/docs/en/hooks-guide) is the reference.

## What it does not do

- It writes no files and makes no network calls. It needs bash, grep and sed, and nothing else. macOS and Linux.
- It never blocks Claude Code. Every exit is `0`, and `hooks.json` wraps the script in `|| true`.
- It asks nothing. There is nothing to customise: the banner is the whole product.
- A pasted path such as `/tmp/notes.md` is not a command, and the script stays quiet on it.

Known quirk: if a typed command's own instructions make Claude call the `Skill` tool for the same skill, you will see the banner twice.

## Versions

- **1.0.1** (2026-09-22) — The box starts on its own line under Claude Code's label, and a plugin skill shows by its skill name alone.
- **1.0.0** (2026-09-22) — First release.

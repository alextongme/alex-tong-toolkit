# Alex Tong's Toolkit

Claude Code skills from my YouTube videos. Every video ships one thing you can install. This is where they live.

[![Your auto-generated CLAUDE.md is worse than no file at all](https://img.youtube.com/vi/YD4PVx3ygDQ/maxresdefault.jpg)](https://youtu.be/YD4PVx3ygDQ)

## What's in it

Every tool has its own page on [alextong.me/toolkit](https://alextong.me/toolkit?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body) with what it does, what it touches on your machine, and how to tell it's working. Each folder here holds the code, a short readme and a `VERSION`, so you can read every line before you install anything.

### Audits

| Tool | Type | What it does |
|---|---|---|
| [`claude-md-audit`](https://alextong.me/toolkit/claude-md-audit?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body) ([code](./claude-md-audit)) | skill | Scores every `CLAUDE.md` and `.claude/rules` file in a repo out of 11 and names the exact lines to cut. Read-only during the audit. From [Your auto-generated CLAUDE.md is worse than no file at all](https://youtu.be/YD4PVx3ygDQ). |

### Session tools

| Tool | Type | What it does |
|---|---|---|
| [`fresh`](https://alextong.me/toolkit/fresh?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body) ([code](./fresh)) | skill | The restart for when context is running low, polluted, or the session went sideways. Writes a short resume prompt from the conversation and live git state and puts it on your clipboard. You type `/clear` and paste it. Writes one file under `~/.claude/fresh/` and nothing else. |
| [`skill-banner`](https://alextong.me/toolkit/skill-banner?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body) ([code](./skill-banner)) | hook | Prints a `RUNNING SKILL` banner with the skill's name the moment a skill starts, whether you typed the command or Claude picked the skill on its own. Two hooks, one script, writes nothing. |
| [`statusline`](https://alextong.me/toolkit/statusline?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body) ([code](./statusline)) | script | A two-line status line: model, effort, folder and branch on top; context left, session cost and elapsed time below. Turns red before Claude starts forgetting. From [Your auto-generated CLAUDE.md is worse than no file at all](https://youtu.be/YD4PVx3ygDQ). |

## Install

The install and update commands for every tool are in [The AI Kitchen](https://alextong.me/kitchen)'s Classroom, next to the changelog. The first lesson in the Claude Code course, "Start here: install the toolkit", has the commands. The AI Kitchen is my free community.

The status line is a script plus one block in `~/.claude/settings.json`, so it has its own steps: [`statusline/INSTALL.md`](./statusline/INSTALL.md).

## Updates, changelog, questions

This repo is the source of truth for the code. [The AI Kitchen](https://alextong.me/kitchen) is where I post the one-line changelog for each version, answer questions, and review your CLAUDE.md if you post it.

If one of these saved you time, a star tells me which ones to make more of.

## What these don't do

Every tool here is read-only on purpose. `claude-md-audit` scores your file and names the exact
lines to cut, and it never rewrites the file. `skill-banner` and `statusline` only print. `fresh` is the one narrow exception: it writes a single
file under `~/.claude/fresh/` and your clipboard, nothing else. Otherwise the rule holds: these tools tell
you what is wrong. They do not decide which of those findings actually matter for your situation,
they do not do the work, and they cannot come back in thirty days to tell you what moved.

That part is me. If you would rather have this done than diagnosed, that is the work I take on:
[alextong.me](https://alextong.me/?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body).

## License

MIT. See [LICENSE](./LICENSE).

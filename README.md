# Alex Tong's Toolkit

Claude Code skills from my YouTube videos. Every video ships one thing you can install. This is where they live.

[![Your auto-generated CLAUDE.md is worse than no file at all](https://img.youtube.com/vi/YD4PVx3ygDQ/maxresdefault.jpg)](https://youtu.be/YD4PVx3ygDQ)

## What's in it

| Folder | What it does | From the video |
|---|---|---|
| [`claude-md-audit`](./claude-md-audit) | Reads every `CLAUDE.md` and `.claude/rules/*.md` in a repo, scores it out of 11, and names the exact lines to cut. Read-only, never rewrites your file. | [Your auto-generated CLAUDE.md is worse than no file at all](https://youtu.be/YD4PVx3ygDQ) |
| [`statusline`](./statusline) | A two-line status line for Claude Code: model, folder, branch on top; context left, session cost, elapsed time below. Turns red before Claude starts forgetting. | same video |
| [`fresh`](./fresh) | The restart for when context is running low, polluted, or the session went sideways: writes a short resume prompt from the conversation and live git state and puts it on your clipboard; you type `/clear` and paste it. The one skill here that writes a file. | — |
| [`skill-banner`](./skill-banner) | Prints a `▶ RUNNING SKILL` banner with the skill's name the moment a skill starts, whether you typed the slash command or Claude picked the skill on its own. Two hooks, one script, writes nothing. | — |

One folder per video. The next video adds the next folder.

## Install

This repo is a Claude Code plugin marketplace. Inside Claude Code:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install claude-md-audit@alex-tong-toolkit
```

Then run `/claude-md-audit` in any repo. Updates arrive with `/plugin update`. The skill's own page, with every mode and a real scorecard: [`claude-md-audit/`](./claude-md-audit).

The status line is a script plus one block in `~/.claude/settings.json`, so it has its own steps: [`statusline/INSTALL.md`](./statusline/INSTALL.md). Every folder carries its own readme and a `VERSION`.

## Updates, changelog, questions

This repo is the source of truth. [The AI Kitchen](https://alextong.me/kitchen?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body) is where I post the one-line changelog for each version, answer questions, and review your CLAUDE.md if you post it.

If one of these saved you time, a star tells me which ones to make more of.

## What these don't do

Every skill here is read-only on purpose. `claude-md-audit` scores your file and names the exact
lines to cut, and it never rewrites the file. `fresh` is the one narrow exception: it writes a single
file under `~/.claude/fresh/` and your clipboard, nothing else. Otherwise the rule holds: these tools tell
you what is wrong. They do not decide which of those findings actually matter for your situation,
they do not do the work, and they cannot come back in thirty days to tell you what moved.

That part is me. If you would rather have this done than diagnosed, that is the work I take on:
[alextong.me](https://alextong.me/?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body).

## License

MIT. See [LICENSE](./LICENSE).

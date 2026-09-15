# Alex Tong's Toolkit

Claude Code skills from my YouTube videos. Every video ships one thing you can install. This is where they live.

[![Your auto-generated CLAUDE.md is worse than no file at all](https://img.youtube.com/vi/YD4PVx3ygDQ/maxresdefault.jpg)](https://youtu.be/YD4PVx3ygDQ)

## What's in it

| Folder | What it does | From the video |
|---|---|---|
| [`claude-md-audit`](./claude-md-audit) | Reads every `CLAUDE.md` and `.claude/rules/*.md` in a repo, scores it out of 11, and names the exact lines to cut. Read-only, never rewrites your file. | [Your auto-generated CLAUDE.md is worse than no file at all](https://youtu.be/YD4PVx3ygDQ) |
| [`statusline`](./statusline) | A two-line status line for Claude Code: model, folder, branch on top; context left, session cost, elapsed time below. Turns red before Claude starts forgetting. | same video |

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

This repo is the source of truth. [The AI Kitchen](https://alextong.me/kitchen) is where I post the one-line changelog for each version, answer questions, and review your CLAUDE.md if you post it.

If one of these saved you time, a star tells me which ones to make more of.

## License

MIT. See [LICENSE](./LICENSE).

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

```bash
git clone https://github.com/alextongme/alex-tong-toolkit.git
mkdir -p ~/.claude/skills && cp -R alex-tong-toolkit/claude-md-audit/skills/claude-md-audit ~/.claude/skills/
```

Restart Claude Code, then run `/claude-md-audit` in any repo.

The status line needs one block in `~/.claude/settings.json`, so it has its own steps: [`statusline/INSTALL.md`](./statusline/INSTALL.md). Every folder carries an `INSTALL.md` and a `VERSION`.

## Updates, changelog, questions

New versions land here and in [The AI Kitchen](https://alextong.me/kitchen) at the same time. The Kitchen is where I post the one-line changelog for each version, answer questions, and keep the skills that have not had their video yet.

If one of these saved you time, a star tells me which ones to make more of.

## License

MIT. See [LICENSE](./LICENSE).

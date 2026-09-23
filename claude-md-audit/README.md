# CLAUDE.md Audit

**Version 1.0.3** · a Claude Code skill · read-only · MIT

Reads every `CLAUDE.md` and `.claude/rules/*.md` file in a repo, scores each one out of 11, and names the exact lines to cut. It never rewrites your file.

From the video [Your auto-generated CLAUDE.md is worse than no file at all](https://youtu.be/YD4PVx3ygDQ).

**How it works, what it touches, and how to tell it's working:** [alextong.me/toolkit/claude-md-audit](https://alextong.me/toolkit/claude-md-audit?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body)

**Install:** the install and update commands live in [The AI Kitchen](https://alextong.me/kitchen), free to join. That's also where I post the changelog and answer questions.

Everything it runs is in this folder, so you can read every line before you install it.

## Versions

- **1.0.3** (2026-09-15) — Every rule checked against Anthropic's docs and the ETH Zurich study. Read-only is now enforced, not just described. Right-sized is 200 lines, matching Anthropic's target. The Duplicate no longer penalizes a block of build and test commands. Hierarchy mode no longer claims a more specific file wins a conflict; Claude Code concatenates every file and picks arbitrarily, so every contradiction is flagged. Model pin removed. Installs move to the marketplace.
- **1.0.2** (2026-09-09) — Pinned Claude Opus 5.
- **1.0.1** (2026-09-08) — Right-sized accepts files from 10 lines up.
- **1.0.0** (2026-09-08) — First release.

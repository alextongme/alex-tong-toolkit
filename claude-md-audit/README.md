# CLAUDE.md Audit

**Version 1.0.3** · a Claude Code skill · read-only · MIT

Reads every `CLAUDE.md` and `.claude/rules/*.md` file in a repo, scores each one out of 11, and names the exact lines to cut. It never rewrites your file. It tells you what's carrying its weight and what isn't, and you decide.

From the video [Your auto-generated CLAUDE.md is worse than no file at all](https://youtu.be/YD4PVx3ygDQ). Questions and the changelog live in [The AI Kitchen](https://alextong.me/kitchen).

## Install

Inside Claude Code:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install claude-md-audit@alex-tong-toolkit
```

That's the whole install. New versions arrive with `/plugin update claude-md-audit@alex-tong-toolkit`.

If you installed an earlier version by copying the folder into `~/.claude/skills/`, delete that copy first so the two don't collide:

```bash
rm -rf ~/.claude/skills/claude-md-audit
```

<details>
<summary>Manual install without the marketplace</summary>

From the root of a clone of this repo:

```bash
mkdir -p ~/.claude/skills
cp -R claude-md-audit/skills/claude-md-audit ~/.claude/skills/
```

You should end up with `~/.claude/skills/claude-md-audit/SKILL.md`. A manual copy does not get updates.
</details>

## Use it

Open Claude Code inside the repo you want to check, then type one of these.

| Command | What you get |
|---|---|
| `/claude-md-audit` | Finds every in-scope file and scores each one. Ends with a summary table if there's more than one. |
| `/claude-md-audit CLAUDE.md` | Scores one file. Pass any path. |
| `/claude-md-audit hierarchy` | Skips the scorecards and looks at your whole stack instead: managed, user, workspace, repo, rules, local. Finds rules duplicated across levels, contradictions between levels, and topics no file covers. |

Plain language works too. "Audit my CLAUDE.md" or "why is Claude ignoring my instructions?" triggers it.

Run it on Opus or better. The rubric is a judgment call at every line, and a smaller model applies it less carefully. The skill uses whatever model your session has; it no longer switches models on you.

## What comes back

A real run against the fifteen-line file from the video:

```
### CLAUDE.md

**Score: 11 / 11** (Signal: +8/8 | Noise: -0 | Structure: +3/3)

#### Signal
- [x] S1 System names (+2) — "Dispatch ingests wire headlines... Relay renders those records" (lines 3–4)
- [x] S2 Non-obvious defaults (+2) — "`npm run check` exits 1 on the checked-in sample on purpose" (line 6)
- [x] S3 Gotchas (+2) — four gotchas, each naming a mechanism and a consequence (lines 8–11)
- [x] S4 Behavioral guardrails (+1) — "stop and say so before writing any code" (line 13)
- [x] S5 Decision framework (+1) — "reversibility, testability, readability, consistency" (line 15)

#### Noise Detected
None detected.

#### Structure
- [x] T1 Includes the "why" — every rule has its because-clause
- [x] T2 No hierarchy duplication — zero overlap with the user and workspace files
- [x] T3 Right-sized — 16 lines, no @ imports

#### Top 3 Recommendations
...
```

Every finding carries a line number or a quote. Every stale-path flag is verified against the repo before it's reported. Recommendations are one sentence each, because a rewrite in someone else's voice is the thing that doesn't get kept.

### What it scores

**Signal, up to +8.** The five things a file should carry because Claude can't get them from the code: system codenames mapped to what they are, non-obvious defaults, gotchas that name a real failure mode, behavioral guardrails, and a priority order for tiebreaks.

**Noise, down to −9.** Seven anti-patterns: The Novel (over 300 lines, imports included), The Duplicate (directory layouts, dependency lists, architecture overviews Claude can derive), The Wishlist ("write clean code"), The Stale Doc (paths and tools that no longer exist), The Settings Leak (settings.json content pasted as prose), The Railroader (step-by-step scripts that belong in a skill), The Template Dump (unedited `/init` output).

**Structure, up to +3.** Does each rule carry its reason, does the file avoid repeating what a parent file already says, and is it inside Anthropic's target of 200 lines.

### How to read the score

| Score | Meaning |
|---|---|
| 9 to 11 | Strong. Well maintained, high signal. |
| 5 to 8 | Functional. Covers the basics, has clear gaps or some noise. |
| 0 to 4 | Needs work. Missing key signals or carrying real noise. |
| Below 0 | Noise outweighs everything the file adds. |

Most files land between 3 and 7 on a first run, and the fastest jump is almost always deletion, not addition. A score can move a point between runs; the rubric is applied by a model, not a linter, so treat the findings as the product and the number as the summary.

### What to do with it

1. Cut what it names under Noise. Those lines are costing context on every session and buying nothing.
2. Move, don't delete, any procedure it flags as a Railroader: a step-by-step safety protocol belongs in a skill or a path-scoped rule, where it loads only when needed.
3. Add the highest-value missing signal, in your own words. One line is usually enough.
4. Run it again after a real session or two, not immediately. The test of a CLAUDE.md is whether Claude's behavior changed.

## What it does and doesn't do

The audit turn cannot touch your files. The skill removes `Edit`, `Write`, and `Bash` from Claude's tool pool while it runs (`disallowed-tools` in its frontmatter). If you then ask Claude to make the cuts in your next message, that's a normal turn with normal permissions.

It improves how reliably Claude follows your conventions. The one controlled study on context files (ETH Zurich, 2026) found that instructions in them are followed well, while repository overviews don't help and cost about 20% more per task. This skill scores for the first kind of content and flags the second. It does not, by itself, make Claude better at your codebase.

## Troubleshooting

- **Claude doesn't see the skill.** Run `/plugin` and check it's listed under Installed. For a manual copy, the folder itself goes in `~/.claude/skills/`: you want `~/.claude/skills/claude-md-audit/SKILL.md`, not `~/.claude/skills/skills/...`.
- **Two copies.** If you have both the plugin and a manual copy, delete the manual one: `rm -rf ~/.claude/skills/claude-md-audit`.
- **It says "T2 skipped."** Expected when it can't read your user or workspace `CLAUDE.md`. The hierarchy-duplication check needs them, and it drops that point rather than guessing.
- **It scored my file lower than I expected.** It scores conservatively on purpose. A heading that says `## Systems` with no actual codename mappings earns nothing, because over-scoring rewards padding, and padding is what makes these files worse over time.

## Versions

- **1.0.3** (2026-09-15) — Every rule checked against Anthropic's docs and the ETH Zurich study. Read-only is now enforced, not just described. Right-sized is 200 lines, matching Anthropic's target. The Duplicate no longer penalizes a block of build and test commands. Hierarchy mode no longer claims a more specific file wins a conflict; Claude Code concatenates every file and picks arbitrarily, so every contradiction is flagged. Model pin removed. Installs move to the marketplace.
- **1.0.2** (2026-09-09) — Pinned Claude Opus 5.
- **1.0.1** (2026-09-08) — Right-sized accepts files from 10 lines up.
- **1.0.0** (2026-09-08) — First release.

Bug, or a score you disagree with? Post it in [The AI Kitchen](https://alextong.me/kitchen). If it saved you time, a star on this repo tells me which skills to make more of.

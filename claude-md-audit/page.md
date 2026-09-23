---
title: CLAUDE.md Audit
kind: skill
video: https://youtu.be/YD4PVx3ygDQ
video_title: Your auto-generated CLAUDE.md is worse than no file at all
---

## What it does

It reads every `CLAUDE.md` and `.claude/rules/*.md` file in a repo, scores each one out of 11, and names the exact lines to cut. It never rewrites your file. It tells you what's carrying its weight and what isn't, and you decide.

Open Claude Code inside the repo you want to check, then type one of these:

- **`/claude-md-audit`** finds every in-scope file and scores each one. It ends with a summary if there's more than one file.
- **`/claude-md-audit CLAUDE.md`** scores one file. Pass any path.
- **`/claude-md-audit hierarchy`** skips the scorecards and looks at your whole stack instead: managed, user, workspace, repo, rules and local. It finds rules duplicated across levels, contradictions between levels, and topics no file covers.

Plain language works too. "Audit my CLAUDE.md" or "why is Claude ignoring my instructions?" triggers it.

Run it on Opus or better. The rubric is a judgment call at every line, and a smaller model applies it less carefully. The skill uses whatever model your session has, so it never switches models on you.

## When to reach for it

- Claude keeps ignoring a rule that's written down in your CLAUDE.md.
- You generated the file with `/init` and never really edited it.
- The file has grown past a couple hundred lines and you're not sure what's still earning its place.
- You have instruction files at several levels, like your user file, a workspace file and the repo's own, and you want to know where they repeat or contradict each other. That's the `hierarchy` mode.

If you don't have a CLAUDE.md yet, there's nothing to score. Write a short one first, then audit it after a few real sessions.

## What comes back

A real run against the fifteen-line file from the video:

```
### CLAUDE.md

**Score: 11 / 11** (Signal: +8/8 | Noise: -0 | Structure: +3/3)

#### Signal
- [x] S1 System names (+2): "Dispatch ingests wire headlines... Relay renders those records" (lines 3-4)
- [x] S2 Non-obvious defaults (+2): "`npm run check` exits 1 on the checked-in sample on purpose" (line 6)
- [x] S3 Gotchas (+2): four gotchas, each naming a mechanism and a consequence (lines 8-11)
- [x] S4 Behavioral guardrails (+1): "stop and say so before writing any code" (line 13)
- [x] S5 Decision framework (+1): "reversibility, testability, readability, consistency" (line 15)

#### Noise Detected
None detected.

#### Structure
- [x] T1 Includes the "why": every rule has its because-clause
- [x] T2 No hierarchy duplication: zero overlap with the user and workspace files
- [x] T3 Right-sized: 16 lines, no @ imports

#### Top 3 Recommendations
...
```

Every finding carries a line number or a quote. Every stale-path flag is checked against the repo before it's reported. Recommendations are one sentence each, because a rewrite in someone else's voice is the thing that doesn't get kept.

### What it scores

**Signal, up to +8.** The five things a file should carry because Claude can't get them from the code: system codenames mapped to what they are, non-obvious defaults, gotchas that name a real failure mode, behavioral guardrails, and a priority order for tiebreaks.

**Noise, down to -9.** Seven anti-patterns: The Novel (over 300 lines, imports included), The Duplicate (directory layouts, dependency lists and architecture overviews Claude can work out from the code), The Wishlist ("write clean code"), The Stale Doc (paths and tools that no longer exist), The Settings Leak (settings.json content pasted as prose), The Railroader (step-by-step scripts that belong in a skill) and The Template Dump (unedited `/init` output).

**Structure, up to +3.** Does each rule carry its reason, does the file avoid repeating what a parent file already says, and is it inside Anthropic's target of 200 lines.

### How to read the score

- **9 to 11:** strong. Well maintained, high signal.
- **5 to 8:** functional. Covers the basics, with clear gaps or some noise.
- **0 to 4:** needs work. Missing key signals or carrying real noise.
- **Below 0:** the noise outweighs everything the file adds.

Most files land between 3 and 7 on a first run, and the fastest jump is almost always deletion. A score can move a point between runs. The rubric is applied by a model, not a linter, so treat the findings as the product and the number as the summary.

### What to do with it

1. Cut what it names under Noise. Those lines cost context on every session and buy nothing.
2. Move any procedure it flags as a Railroader instead of deleting it. A step-by-step safety protocol belongs in a skill or a path-scoped rule, where it loads only when it's needed.
3. Add the highest-value missing signal, in your own words. One line is usually enough.
4. Run it again after a real session or two, not right away. The test of a CLAUDE.md is whether Claude's behavior changed.

## What it touches

It reads. It doesn't write.

- **Reads:** every `CLAUDE.md` and `.claude/rules/*.md` in the repo, plus the files above it that Claude Code also loads: your user file at `~/.claude/CLAUDE.md`, your user rules, any workspace `CLAUDE.md` in a parent folder, and a managed policy file if your company deployed one.
- **Writes:** nothing. The skill removes `Edit`, `Write` and `Bash` from Claude's tools while it runs, through `disallowed-tools` in its frontmatter. If you ask Claude to make the cuts in your next message, that's a normal turn with your normal permissions.

It improves how reliably Claude follows your conventions. The one controlled study on context files (ETH Zurich, 2026) found that instructions in them are followed well, while repository overviews don't help and cost about 20% more per task. This skill scores for the first kind of content and flags the second. It doesn't, by itself, make Claude better at your codebase.

## It's working if

- Every finding points at a line number or a quote from your file. A finding that doesn't is worth pushing back on.
- The score goes up mostly because you deleted lines, not because you added them.
- The rule Claude kept ignoring gets followed in the next real session or two after you make the cuts.

## If something looks off

- **It says "T2 skipped."** That's expected when it can't read your user or workspace `CLAUDE.md`. The hierarchy-duplication check needs them, and it drops that point rather than guessing.
- **It scored my file lower than I expected.** It scores conservatively on purpose. A heading that says `## Systems` with no actual codename mappings earns nothing, because over-scoring rewards padding, and padding is what makes these files worse over time.
- **A score you disagree with.** Post the file and the finding in The AI Kitchen and I'll look at it.

# CLAUDE.md Audit  —  v1.0.2

One Claude Code skill that reads every `CLAUDE.md` and `.claude/rules/*.md` file in a repo and scores it out of 11 — then tells you exactly which lines to cut.

It scores three things:

- **Signal (+8 max)** — system codenames, non-obvious defaults, gotchas with a real failure mode, behavioral guardrails, a decision framework for tiebreaks.
- **Noise (−9 max)** — seven named anti-patterns. The Novel, The Duplicate, The Wishlist, The Stale Doc, The Settings Leak, The Railroader, The Template Dump.
- **Structure (+3 max)** — does it explain the *why*, does it avoid repeating your global `CLAUDE.md`, is it right-sized.

It also runs a **hierarchy mode** that stops scoring files individually and looks at the whole stack — global, personal, workspace, repo, rules — to find rules duplicated across levels, conflicts where the more specific file quietly overrides a team guardrail, and topics no file covers at all.

**It won't rewrite your file.** Recommendations are one sentence each, because the instructions that work are the ones written in your team's voice, not a generated replacement. It verifies before it flags anything stale — a false "this file doesn't exist" destroys trust in the whole report faster than a missed finding.

---

## Install (about a minute)

From the root of a clone of this repo:

```bash
mkdir -p ~/.claude/skills
cp -R claude-md-audit/skills/claude-md-audit ~/.claude/skills/
```

Restart Claude Code. You should end up with `~/.claude/skills/claude-md-audit/SKILL.md`.

## Using it

From inside any repo:

- **`/claude-md-audit`** — finds and scores every in-scope file.
- **`/claude-md-audit CLAUDE.md`** — scores one specific file.
- **`/claude-md-audit hierarchy`** — cross-file mode: duplication, conflicts, coverage gaps.

Plain language works too — *"audit my CLAUDE.md"* or *"why is Claude ignoring my instructions?"* will trigger it.

The skill is read-only (`Read`, `Glob`, `Grep`) — it cannot edit your files, so there's no version of this that damages a repo. It runs on Claude Opus 5 regardless of the model your session is using, because a shaky audit is worse than none.

### Reading the score

| Score | What it means |
|---|---|
| **9–11** | Strong. Well-maintained, high-signal. |
| **5–8** | Functional. Covers basics, has clear gaps or some noise. |
| **0–4** | Needs work. Missing key signals or carrying real noise. |
| **Below 0** | Noise outweighs everything the file adds. |

Most files land in the 3–7 range on a first run, and the fastest jump is almost always deletion rather than addition.

## Updating

`git pull` in your clone, then copy the folder again. **The AI Kitchen posts a one-line
changelog every time a version lands** — https://alextong.me/kitchen

Your version: see `VERSION` in this folder.

## Troubleshooting

- **Claude doesn't see the skill.** Skills load at session start — restart Claude Code. Then run `/skills` to confirm it loaded.
- **Wrong folder.** The skill folder itself goes in `~/.claude/skills/`. You want `~/.claude/skills/claude-md-audit/SKILL.md`, not `~/.claude/skills/skills/...`.
- **It says "T2 skipped."** That's expected when it can't read your global or workspace `CLAUDE.md` — the hierarchy-duplication check needs them, and it drops that one point rather than guessing.
- **It scored my file lower than I expected.** It scores conservatively on purpose. A heading that says `## Systems` with no actual codename mappings earns nothing, because over-scoring encourages padding, and padding is what makes these files worse over time.

---

*From **The AI Kitchen** by [Alex Tong](https://alextong.me). Questions, or it didn't work?
Post in the community — https://alextong.me/kitchen*

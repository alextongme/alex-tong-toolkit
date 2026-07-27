# 0001 — Group plugins by audience, keep skills flat

**Status:** accepted · **Date:** 2026-07-27 · **Supersedes:** the one-plugin-per-tool layout at v0.14.1

## Context

The marketplace shipped seven plugins for eight skills — `alex-tong-workspace`, `pr`, `education`, `claude-brain`, `company-research`, `skill-stats`, `context-diet` — roughly one plugin per tool. Two more (`learn`, `agent-patterns`) existed on disk but were never listed in `marketplace.json`, so their status was invisible: neither shipped nor marked as unshipped.

Three things forced a decision:

**A plugin is the unit of installation, and it is all-or-nothing.** There is no way to install part of a plugin. So the plugin boundary is the only lever for controlling what lands in someone's skill list.

**The skills serve genuinely different people.** Worksheet generation needs no terminal and no codebase. Multi-repo workspace scaffolding is meaningless without one. Company research matters for a few weeks and then stops. One bundle would mean a teacher installs workspace tooling to print a worksheet.

**Seven plugins for eight skills was the wrong granularity in the other direction.** It cost seven install commands, seven manifests to keep in version lockstep, and seven entries to explain, while each plugin averaged 1.1 skills.

## Decision

**Group plugins by who they are for.** Four published plugins:

| Plugin | Audience | Skills |
|---|---|---|
| `alex-tong-engineering` | working engineers | `workspace-create`, `workspace-audit`, `pr-summary-generator`, `claude-md-audit`, `context-diet` |
| `alex-tong-education` | teachers, parents, explainers | `worksheet-maker` |
| `alex-tong-career` | job seekers | `company-research` |
| `alex-tong-skill-stats` | anyone auditing their own setup | `stats` |

**A plugin that ships hooks stays standalone, regardless of audience.** This is the one rule that overrides the grouping. `alex-tong-skill-stats` carries a `PreToolUse` hook that logs every skill invocation to `~/.claude/skill-usage.jsonl`. Installing a plugin is how a user consents to its hooks, so folding a hook-carrying plugin into a larger bundle would start that logging for everyone who wanted something else in the bundle. Rule 4 of `CLAUDE.md` calls plugins "a trust position"; **the plugin boundary is the consent boundary**, and audience convenience does not get to override it. By the audience test alone `stats` would have gone into `alex-tong-engineering` — the hook is why it didn't.

**Keep `skills/` flat — exactly one level.** `plugins/<plugin>/skills/<skill>/SKILL.md`, never deeper.

**Prefix plugin names with `alex-tong-`.** The plugin name becomes the skill namespace (`alex-tong-engineering:workspace-audit`).

**Unshipped work lives in `in-progress/`**, outside `plugins/` and absent from `marketplace.json`, but still covered by CI.

## Why flat, specifically

Grouping skills into category subdirectories (`skills/engineering/tdd/`) looks tidier and is a trap. The scan is one level deep from each registered root, and **nothing warns you when it isn't**: nested skills are dropped silently, validation still passes, and the plugin installs looking healthy with a shorter skill list than intended. Registering each subdirectory explicitly in `plugin.json` does work, but it makes every new skill a two-file change and leaves the silent-failure mode one forgotten line away.

Grouping is worth having — it just belongs at the plugin boundary, where it is enforced, installable, and visible. Category folders would duplicate it with none of those properties.

Flat also keeps skill names honest. A nested name collapses to its leaf directory, so `skills/a/audit/` and `skills/b/audit/` both become `:audit` and collide, with the folder structure implying a separation that does not exist.

## Why prefixed names

Marketplace names disambiguate *installs* (`plugin@marketplace`), but the skill namespace is only `plugin:skill`. A plugin named `engineering` would claim the `engineering:` prefix against every other marketplace a user has installed. Short generic names work for first-party plugins that effectively own those slots; they are a liability here.

The ergonomic cost is low because bare names still resolve — `/workspace-audit` works. The long form appears in listings and on ambiguity, which is where the disambiguation is wanted anyway.

## What the loader actually does — measured, not assumed

Both structural rules above came from probing a throwaway plugin with `claude --plugin-dir <probe> plugin details`, because the documentation is silent on both points. The results are the reason the rules are enforced in CI rather than written down and hoped for.

**Nesting is dropped silently, and an explicit path array does not fix it.**

| `plugin.json` | Skills loaded from `skills/{flat, group/a, group/b}` |
|---|---|
| no `skills` field | `flat` only — the two nested ones vanish |
| `"skills": ["./skills"]` | `flat` only — it does **not** recurse |
| `"skills": ["./skills/group"]` | `a` and `b` load |

So the scan is one level below *each registered root*. An explicit array doesn't enable nesting; it only registers another one-level root. Nothing warns, and `claude plugin validate` passes clean while skills are missing.

**The frontmatter `name` field is not read for skill identity — the directory is.** A skill at `skills/dirwins/` declaring `name: totally-different-name` resolves as `dirwins`. A skill declaring `name: "probeplug:colonskill"` resolves as `colonskill`.

That second finding is why the `<plugin>:<skill>` naming convention is kept but now *enforced*. The convention was never load-bearing — it was documentation mirroring the resolved name. Documentation that nothing checks drifts, and a `name` describing a skill that no longer exists is worse than no `name` at all. `validate-skills.js` now derives the expected value from the plugin manifest plus the directory and fails on any mismatch, which turns a decorative convention into a checked invariant.

## Consequences

**Install drops from seven commands to one per audience.** Most people run exactly one.

**Existing installs migrate automatically.** `marketplace.json` carries a `renames` map from every old plugin name to its new home. Claude Code loads the plugin under the new name, prints a one-line notice, and rewrites the user's `enabledPlugins`. Nobody re-installs anything.

**Qualified skill names changed, and cross-references had to change with them.** Several skills named their siblings in prose (`claude-brain:audit` appeared in two other skills' descriptions and bodies, and in the `stats` example output). Those pointed at commands that no longer exist after regrouping, so every occurrence was rewritten to the resolved name. This is now a documented step when regrouping — a stale cross-reference is a broken instruction, and nothing else catches it.

**Version bumped to 1.0.0** across `metadata.version` and all four plugins. `version` is the update cache key, so a restructure that does not bump it serves stale files from cache forever.

**`in-progress/` is now a real state, not an accident.** `scripts/validate-skills.js` covers it, so drafts cannot rot below the shipped bar. Promotion is not a one-line change, and the docs should not claim otherwise: the directory moves under `plugins/`, the frontmatter `name` changes with it (CI enforces `<plugin>:<dir>`), a manifest is needed if it becomes its own plugin, and the marketplace entry plus version bump follow. Four coordinated edits, all of them checked.

**Two guards were added to `validate-skills.js`** — a depth check and a name check — both with the failure mode they prevent written into the comment, because both failures are invisible at runtime.

## The honest counter-argument

Audience boundaries are a judgment call and this one could be wrong. `claude-md-audit` and `context-diet` are arguably useful to anyone maintaining Claude context, engineer or not. If the education audience ever grows past one skill and starts wanting context tooling, the split will feel arbitrary. And **three of the four plugins hold exactly one skill each** — the same low-density problem this decision was partly meant to fix. Five of the eight skills sit in `alex-tong-engineering`; the rest are singletons. The difference from before is that the density is now low for a stated reason (audience for two of them, hook consent for the third) rather than by accident, but it is fair to say the consolidation mostly happened inside one plugin.

That is acceptable because it is cheap to revisit: the `renames` map makes regrouping a metadata change, not a migration. What is *not* cheap to undo is a nested skill layout that silently drops skills — which is why that half of the decision is the firmer one.

The hook rule is the part most likely to be tested. It says a hook-carrying plugin never merges into a bigger one, which means every future hook is a new install command. If the toolkit ends up with five hook plugins, that will feel like sprawl and the pressure to bundle will be real. The rule should hold anyway: sprawl is visible and annoying, while a hook someone never agreed to run is invisible and much worse.

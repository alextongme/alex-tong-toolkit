# Alex Tong's Toolkit — by [Alex Tong](https://alextong.me)

Free Claude Code plugins from [Alex Tong](https://alextong.me) — skills, templates, and configs for AI-assisted development. Each plugin comes with a full walkthrough on [alextong.me/newsletter](https://alextong.me/newsletter).

## Install

Add the marketplace once:

```
/plugin marketplace add alextongme/alex-tong-toolkit
```

Then install whichever plugin fits what you're doing:

```
/plugin install alex-tong-engineering@alex-tong-toolkit
/plugin install alex-tong-education@alex-tong-toolkit
/plugin install alex-tong-career@alex-tong-toolkit
/plugin install alex-tong-skill-stats@alex-tong-toolkit
```

Adding the marketplace installs nothing on its own — it registers the catalog so you can browse and pick. Installing a plugin gives you every skill inside it.

## Plugins

Plugins are grouped by **who they're for**, not by what tool they use. Install the one that matches you and your skill list stays clean.

### `alex-tong-engineering` — for working engineers

| Skill | What it does |
|-------|--------------|
| `workspace-create` | Scaffolds a multi-repo workspace with shared Claude context — repo registry, CLAUDE.md, Makefile, bootstrap scripts. |
| `workspace-audit` | Reconciles a workspace's claims against GitHub and local state, so the registry can't quietly drift. |
| `pr-summary-generator` | Generates a structured PR description from the current branch diff. Built for AI-assisted work where the PR body is the primary review artifact. |
| `claude-md-audit` | Audits CLAUDE.md and `.claude/rules/` files for staleness, contradictions, and missing context. Scores *quality*. |
| `context-diet` | Measures what actually loads into every session at startup — MCP servers, plugins, skills, agents, CLAUDE.md files — with per-source token estimates and prune recommendations. Measures *cost*. |

Walkthroughs: [workspace](https://alextong.me/toolkit/workspace) · [The PR Description Is the New Code Review](https://alextong.me/newsletter/code-review-wrong)

### `alex-tong-education` — for teachers, parents, and anyone explaining something

| Skill | What it does |
|-------|--------------|
| `worksheet-maker` | Creates printable educational worksheets as self-contained HTML files. Any grade level, subject, or audience. |

### `alex-tong-career` — for job seekers

| Skill | What it does |
|-------|--------------|
| `company-research` | Builds a saved markdown packet on a company — culture, work-life balance, leadership, comp — with an optional role-specific interview deep-dive covering stages, the hiring manager, common questions, and prep frameworks. |

### `alex-tong-skill-stats` — for anyone auditing their own setup

| Skill | What it does |
|-------|--------------|
| `stats` | Shows which skills and agents you actually invoke, and which you installed and never touched. |

**This one ships a `PreToolUse` hook**, so it's deliberately a separate install — installing it *is* the opt-in. It writes a local log at `~/.claude/skill-usage.jsonl` and sends nothing anywhere. It is not bundled into `alex-tong-engineering` precisely so that installing engineering tooling never starts logging your usage as a side effect.

## In progress

[`in-progress/`](./in-progress) holds skills that are built but not shipped. They're in the repo so you can read them, copy them, or tell me they're wrong — they're **not** in `marketplace.json`, so installing a plugin never pulls them in. They're held to the same CI bar as everything else, so a draft can't quietly rot below the shipped standard.

## Requiring the toolkit for a team

Teams can register the marketplace and pre-enable plugins so nobody has to run anything. In your repo's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "alex-tong-toolkit": {
      "source": { "source": "github", "repo": "alextongme/alex-tong-toolkit" }
    }
  },
  "enabledPlugins": {
    "alex-tong-engineering@alex-tong-toolkit": true
  }
}
```

Members get prompted the first time they trust the folder.

## Why a marketplace?

One install command, one update path, one place for issues. Raw `SKILL.md` files still live on [alextong.me/toolkit](https://alextong.me/toolkit) for anyone who'd rather copy-paste than install.

## Upgrading from an earlier version

Plugins used to be split roughly one-per-tool (`pr`, `claude-brain`, `context-diet`, `education`, `company-research`, `skill-stats`, `alex-tong-workspace`). They're now grouped by audience, and `marketplace.json` carries a `renames` map — Claude Code migrates existing installs automatically and prints a one-line notice. Nothing to do by hand.

Skills that moved also changed their qualified names (for example `claude-brain:audit` is now `alex-tong-engineering:claude-md-audit`). Bare invocation still works: `/claude-md-audit`.

## Contributing

Issues and PRs welcome. Every skill must:

1. Live at `plugins/<plugin>/skills/<skill-name>/SKILL.md`, **one level deep** — the loader silently drops anything nested deeper.
2. Have frontmatter `name: "<plugin>:<skill-dir>"` matching the manifest and directory exactly. CI enforces this.
3. Carry a trigger-loaded `description` including `Do NOT use for:` negatives.
4. Include the standardized byline under the H1: `> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)`
5. Pass `bash tests/run.sh`.

See [`CLAUDE.md`](./CLAUDE.md) for the hard rules and [`.agents/adr/`](./.agents/adr) for why the repo is shaped this way.

## Install telemetry

`/plugin marketplace add` does a `git clone` under the hood, so GitHub's traffic API is a zero-code proxy for installs. To check:

```bash
bash scripts/stats.sh
```

Reports clones (14-day rolling window), top referrers, and top paths. Requires `gh` CLI authenticated with traffic read permission (repo admin).

## License

MIT — see [LICENSE](./LICENSE).

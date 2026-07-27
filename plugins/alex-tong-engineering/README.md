# alex-tong-engineering

Claude Code workflow skills for working engineers, from [Alex Tong's Toolkit](https://alextong.me/toolkit).

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install alex-tong-engineering@alex-tong-toolkit
```

## Skills

| Skill | Use it when |
|-------|-------------|
| `workspace-create` | You're setting up a workspace spanning several repos and want one shared Claude context instead of per-repo drift. Scaffolds a repo registry, CLAUDE.md, Makefile, and bootstrap scripts from [`templates/`](./templates). |
| `workspace-audit` | A workspace already exists and you want to know whether its registry still matches reality — reconciles claims against GitHub and local state. |
| `pr-summary-generator` | You're opening a PR and the diff is large or AI-assisted, so the description has to carry the review rather than the commits. |
| `claude-md-audit` | A CLAUDE.md or `.claude/rules/` file has grown past the point where you can tell what's still true. Finds staleness, contradictions, and missing context. |
| `context-diet` | Sessions feel heavy before you've typed anything. Measures everything that loads at startup — MCP servers, plugins, skills, agents, CLAUDE.md files — with per-source token estimates and prune recommendations. |

**`claude-md-audit` vs `context-diet`:** the first scores the *quality* of a file's content; the second measures the *cost* of everything loaded. Reach for `claude-md-audit` when the instructions might be wrong, `context-diet` when the window is full.

## Why these ship together

They share an installer, not a subject. Someone scaffolding a workspace is the same person auditing a CLAUDE.md and opening PRs — one install, one update, no picking. See [`.agents/adr/0001-audience-scoped-plugins.md`](../../.agents/adr/0001-audience-scoped-plugins.md).

Note there are no hooks here, deliberately. Anything that ships a hook gets its own plugin so installing it is an explicit choice — that's why usage tracking lives in `alex-tong-skill-stats` rather than in this bundle.

## Templates

[`templates/`](./templates) holds the files `workspace-create` writes: `CLAUDE.md.template`, `README.md.template`, `Makefile`, `setup.sh`, and `rules/`. Edit them to change what a scaffolded workspace looks like.

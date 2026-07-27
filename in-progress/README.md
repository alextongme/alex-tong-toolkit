# In progress

Skills that are built but not shipped.

Nothing here is listed in `.claude-plugin/marketplace.json`, so installing a plugin never pulls it in. It's public because a half-finished skill you can read is more useful than one you can't — copy it, adapt it, or tell me it's wrong.

| Directory | What it is | Why it's not shipped |
|---|---|---|
| `learn/` | `teach-me` — turns Claude into a teacher that checks you actually understand the work before moving on. | Needs real use before it earns an install. |
| `agent-patterns/` | A `sandbox` command for orchestrating agents in isolated worktrees. | Draft. The pattern works; the packaging doesn't yet. |

## The bar still applies

`scripts/validate-skills.js` walks this directory too. A draft has to pass the same frontmatter, trigger-discipline, and byline checks as anything published — a draft that silently rots is worse than no draft.

## Promoting one

Four coordinated edits, all of them CI-checked:

1. Move the skill directory under `plugins/<plugin>/skills/` — the plugin whose audience it serves, or its own plugin if it fits none. **If it ships hooks, it gets its own plugin regardless of audience.**
2. Update the frontmatter `name` to `"<plugin>:<skill-dir>"`. `validate-skills.js` fails on a mismatch.
3. If it became a new plugin, add `.claude-plugin/plugin.json` and a `marketplace.json` entry with matching name and version.
4. Bump `metadata.version` and the plugin's `version` — `version` is the update cache key, so without a bump existing installs keep serving the old files.

Then run `bash tests/run.sh`. See [`../.agents/adr/0001-audience-scoped-plugins.md`](../.agents/adr/0001-audience-scoped-plugins.md) for how the grouping is decided.

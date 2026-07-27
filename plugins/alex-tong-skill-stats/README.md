# alex-tong-skill-stats

See which skills and agents you actually use — from [Alex Tong's Toolkit](https://alextong.me/toolkit).

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install alex-tong-skill-stats@alex-tong-toolkit
```

## Skills

| Skill | Use it when |
|-------|-------------|
| `stats` | You want to know which skills you actually invoke, and which you installed months ago and have never once triggered. Reads the local usage log and reports top hits plus the dead weight. |

## Why this is a separate install

**It ships a `PreToolUse` hook.** That hook fires on every `Skill` and `Task` call and appends a line to `~/.claude/skill-usage.jsonl`.

A hook is a behavior change to your session, so it should be something you chose — not something you inherited by installing an unrelated plugin. Bundling this into a broader plugin would mean anyone who wanted, say, PR descriptions would silently start logging their usage. **The plugin boundary is the consent boundary**, so this one stands alone. See [`.agents/adr/0001-audience-scoped-plugins.md`](../../.agents/adr/0001-audience-scoped-plugins.md).

## What it records, exactly

- **Local only.** Nothing is sent anywhere. No network call, no telemetry, no endpoint.
- **One file:** `~/.claude/skill-usage.jsonl`, written with owner-only permissions.
- **Non-blocking.** The hook cannot fail your session — if it breaks, it exits quietly.

To stop collecting, uninstall the plugin. To wipe history, delete `~/.claude/skill-usage.jsonl`.

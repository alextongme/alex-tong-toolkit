# agent-patterns

> **Status: DRAFT.** Not yet registered in `marketplace.json`. Not installable from the marketplace until we decide it's ready.

Patterns for orchestrating Claude Code agents. The idea: most Claude Code workflows treat the main session as the only worker. This plugin gives you slash commands that dispatch *additional* agents, in isolated worktrees, so you can experiment, parallelize, and review without polluting your active branch.

## Commands

### `/sandbox <request>`

Spawn one agent in an isolated worktree. The agent attempts the request, reports back with a diff, and the user decides whether to keep, merge, or discard.

Example:

```
/sandbox upgrade puppeteer to v22 and fix any compile errors
```

The agent works in a throwaway worktree under `.claude/worktrees/`. If it makes no changes, the worktree auto-cleans. If it does, you get the path and a diff to review.

## Why this exists

Claude Code's `Agent` tool supports `isolation: "worktree"` as a parameter, which automatically creates a temporary worktree, runs an agent there, and cleans up if nothing changed. This is powerful but easy to forget. Slash commands turn it into a one-keystroke habit.

## Roadmap

This plugin will graduate from draft once it has 2 to 3 commands that share a coherent theme. Possible additions:

- `/race` — run N approaches in parallel sandboxed agents, compare diffs.
- `/review-diff` — spawn a code reviewer subagent on a branch's diff before opening a PR.
- `/cleanup-worktrees` — list and prune stale agent worktrees.

## Requirements

- Claude Code with `Agent` tool support for `isolation: "worktree"`.
- A git repository as the working directory.

## License

MIT.

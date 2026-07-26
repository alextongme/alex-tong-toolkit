---
description: Run a task in a sandboxed, worktree-isolated agent without touching your branch
---

# Sandbox

Dispatch the request below to an `Agent` with `isolation: "worktree"`. The agent works in a throwaway worktree, makes whatever changes it thinks are right, and reports back. The current branch is never touched.

## Behavior

1. Spawn one `Agent` call with `isolation: "worktree"`.
2. Pass `$ARGUMENTS` as the prompt to the agent.
3. Give the agent enough context to pick reasonable defaults. The agent does not see this conversation.
4. When the agent returns:
   - Summarize what it did in 2 to 4 lines.
   - Show the diff, or report "no changes, worktree auto-cleaned".
   - Show the worktree path and branch name if changes were kept.
5. Do NOT merge. Do NOT cherry-pick. Wait for the user to decide.

## Choosing the agent type

- Default: `general-purpose`.
- If the task is read-only research only: `Explore`.
- If the user has language-specific agents installed (Go, TypeScript, Python, etc.) and the task fits, prefer those.

## Prompt template for the spawned agent

The agent has no memory of this conversation. The prompt you send must be self-contained. Use this shape:

> Task: {restate $ARGUMENTS in one sentence}
>
> Context: you are in a fresh worktree of this repo. Make the change, run a build or test if relevant, and report what you did. If you cannot make progress, stop early and explain why. Do not commit. Do not push.
>
> Report back with: (1) a short summary of what you changed, (2) any commands you ran and their results, (3) caveats or open questions.

## After the agent returns

- Show the user the summary, diff, and worktree path.
- Ask: "Keep, merge into current branch, or discard?"
- If the user says discard, run `git worktree remove --force <path>` and the matching branch delete.
- If the user says merge, ask first whether they want a merge commit, a squash, or a cherry-pick of specific files.

## Request

$ARGUMENTS

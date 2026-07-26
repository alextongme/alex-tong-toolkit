---
name: pr-summary-generator
description: >
  Generate a structured pull-request description from the current branch's diff and
  commit history — built for AI-assisted development, where the PR body is the primary
  review artifact and the diff is the supporting evidence. Use this skill whenever the
  user says "write my PR summary", "PR description", "PR body", "summarize this PR",
  "what changed in this branch", "draft a PR", or any variation of wanting a pull
  request description generated. Do NOT use for: writing commit messages, code review
  comments, release notes, changelog entries, or standup updates.
user_invocable: false  # Not ready yet — set to true when skill is complete
author: Alex Tong — https://alextong.me
---

# pr-summary-generator

> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)

## Overview

Produces a review-ready PR body from `git diff` and `git log` for the current branch, then prints it to stdout. The mental model: when Claude wrote the implementation, the author still owns the *why*. This skill turns that context into a scannable description that points reviewers at the real decisions and lets them skip the mechanical follow-through.

No file is created. The user pastes the output into their PR, or the skill pipes it into `gh pr create --body` when asked.

## Quick Reference

| Situation | What to do |
|-----------|-----------|
| Default — any branch with commits | Run Phase 1 → Phase 2 → Phase 3 |
| Purely additive change, no behavior change | Omit `## Risk` entirely |
| No tests were run | Omit `## Testing` or state what was not tested in one line |
| 1–2 logical changes | Use a short paragraph under `## What changed`, not bullets |
| 3+ logical changes | Bullets grouped by concept, max 7, combine minor items under "Cleanup" |
| User said "open the PR" / "create the PR" | After Phase 3, run `gh pr create` with the generated body |
| Branch matches a ticket pattern and `PR_TICKET_URL` is set | Add ticket link above `## Why` |
| Over 40 files changed | Group at a higher level (e.g. "schema migration"); don't enumerate |
| Commit messages are useless (`wip`, `fix`, `...`) | Infer from diff; warn the user the `## Why` is inferred |

## Requirements for Outputs

Every generated PR body **must** satisfy these. They are the difference between a useful description and a wall of text:

1. **Never restate the PR title.** It is already visible; repeating it wastes the reviewer's first scan.
2. **`## Why` answers the problem, not the patch.** Present tense for the problem ("The current implementation forces..."), past tense for the motivation. Pull from commit messages and branch name — not from re-describing the diff.
3. **`## What changed` includes a `**Review focus:**` line.** One sentence telling the reviewer what to scrutinize and what to skip. This is the single most important line in the body — without it, a reviewer staring at a 40-file diff has zero signal.
4. **Group by concept, not by file.** `- **Auth handler** — description. (files)` — not `- **handler.go** — description.` Files are the implementation detail; concepts are the review unit.
5. **Omit empty sections entirely.** Drop the heading. Never write "None", "Low risk", or "N/A" — that phrasing is noise that trains reviewers to skim past your real content.
6. **No code blocks in `## Why` or `## What changed`.** Prose only. Code belongs in the diff.
7. **Evidence over claims in `## Testing`.** `` Ran `go test ./...` — all pass `` beats "tests were added".
8. **Keep the generation banner.** The `> [!NOTE]` block at the top is non-negotiable — it signals to downstream readers that the body was AI-assisted.

## Process

### Phase 1 — Gather context

Read the current branch against its base. Why this first: without commit history and diff, the `## Why` section collapses to a generic restatement of the code.

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Resolve the base branch: PR_BASE_BRANCH wins, else origin/HEAD, else main/master.
BASE="$PR_BASE_BRANCH"
[ -z "$BASE" ] && BASE=$(git symbolic-ref --short -q refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')
[ -z "$BASE" ] && for b in main master; do
  git rev-parse --verify --quiet "$b" >/dev/null 2>&1 && BASE=$b && break
done

git diff ${BASE}...HEAD
git log ${BASE}..HEAD --pretty=format:"%s%n%b" --reverse
git diff ${BASE}...HEAD --stat
```

If `PR_BASE_BRANCH` is set (env var or repo `CLAUDE.md`), use that instead of the `main`/`master` fallback.

### Phase 2 — Draft the body

Fill the template below using Phase 1 context. Apply every rule from "Requirements for Outputs" as you write — omitted sections are easier to leave out up front than to remove after drafting.

```markdown
> [!NOTE]
> Generated with [Claude Code](https://claude.ai/code) · PR structure from [alextong.me](https://alextong.me)

## Why

1–3 sentences. What problem this solves and why now.

## What changed

**Review focus:** One line — what to scrutinize and what to skip.

- **Group name** — what changed and why. (`file1.go`, `file2.go`)
- **Group name** — what changed and why. (`file3.go`)

## Risk

<!-- Omit if: purely additive, no behavior change, safe to revert. -->
- What could break, who's affected, rollback plan.
- Include security surface if auth/input/secrets are touched.

## Testing

**Ran:** `exact command`
**Result:** pass/fail or screenshot
**Not tested:** what and why (or omit)
```

Include `## Risk` only when: auth/secrets touched, behavior change for existing users, DB migration, shared code modified, or not safely revertable. Otherwise drop the heading.

### Phase 3 — Emit

Print the completed Markdown to stdout. Do not create a file. If the original request included "open the PR" or "create the PR":

```bash
gh pr create --title "<inferred title>" --body "<generated body>"
```

Infer the title from the most meaningful commit or the branch name, stripped of prefix tokens (`feat/`, `fix/`, `chore/`).

## Example

**Input** — branch `fix/rate-limit-bypass`:

```
commit 1: fix: check rate limit before hitting auth provider
commit 2: test: add integration test for burst traffic

 src/middleware/rate-limit.ts | 18 ++++++++++++------
 src/middleware/auth.ts       |  4 ++--
 tests/rate-limit.test.ts     | 42 ++++++++++++++++++++++++++++++++
```

The diff shows the auth middleware was calling the upstream auth provider *before* the rate limiter fired, so a burst of unauthenticated requests could exhaust the auth-API quota and trigger a cascading outage.

**Output:**

````markdown
> [!NOTE]
> Generated with [Claude Code](https://claude.ai/code) · PR structure from [alextong.me](https://alextong.me)

## Why

The auth middleware was calling the upstream provider before the rate limiter fired, so a burst of unauthenticated traffic could exhaust our auth-API quota and trigger a cascading 503 across every authenticated route. Moving the rate-limit check in front of the provider call contains the damage to the attacker's own IP bucket.

## What changed

**Review focus:** The ordering swap in `auth.ts` — confirm no upstream call runs before `checkRateLimit`. The new test covers the regression.

- **Middleware order** — rate limit now runs before the auth-provider call. (`src/middleware/auth.ts`, `src/middleware/rate-limit.ts`)
- **Integration coverage** — new burst-traffic test asserts the provider is never called once the limit is hit. (`tests/rate-limit.test.ts`)

## Risk

- Affects every authenticated route. Rollback = revert this PR; the two files are self-contained.
- Watch `auth_provider_429_rate` for 30 min post-deploy. A spike means we're limiting legitimate traffic.

## Testing

**Ran:** `npm test -- rate-limit`
**Result:** all 12 tests pass, including the new burst case.
````

Notice what the example does *not* do: it does not restate the title, it does not list "3 files changed", and it does not write "Low risk" for a section that does apply. The `## Risk` section is present because auth is touched.

## Edge cases & recovery

- **Branch has no commits ahead of base** → stop and tell the user there is nothing to summarize.
- **Diff is empty but commits exist** → the branch likely merged or rebased; ask whether to summarize the merge commit or the underlying commits.
- **Over 40 files changed** → do not enumerate. Group at a higher level ("schema migration", "generated client code") and put the real work in 2–3 concept bullets.
- **Commit messages are useless** (`wip`, `fix`, `...`) → fall back to reading the diff directly and warn the user that `## Why` is inferred and may need a sentence from them.
- **`gh` not installed when the user asks to open the PR** → print the body and the literal `gh pr create` command as a fallback.
- **Tests were run but failed** → include the failure in `## Testing`, not a claim of success. Do not ship a green-looking PR body over a red test run.

## Configuration (optional)

Users can set these in their repo's `CLAUDE.md` or as environment variables:

- `PR_TICKET_URL` — base URL pattern for ticket links (e.g., `https://yourtracker.atlassian.net/browse/`). If set, extract the ticket ID from the branch name and include a link above `## Why`.
- `PR_BASE_BRANCH` — override the default base branch if it is not `main` or `master`.

## Why this template exists

AI-assisted development changed what a PR description needs to do. When Claude writes the implementation, the author's relationship with the code is different — you know what you asked for and why, but the exact patterns chosen are a different kind of knowledge. The PR description bridges that gap. It is how you prove you understand what you are shipping.

The `**Review focus:**` line is the innovation that matters. It tells the reviewer exactly where the real decisions live and what is just mechanical follow-through. Without it, the reviewer is staring at a 40-file diff with zero signal.

Full reasoning: [The PR Description Is the New Code Review](https://alextong.me/newsletter/code-review-wrong)

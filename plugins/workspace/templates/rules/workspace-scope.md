---
globs: ["CLAUDE.md", ".claude/CLAUDE.md"]
---

# Workspace Scope Rules

This is a multi-repo workspace. The repos listed in `repos.json` are cloned as subdirectories. Each repo has its own CLAUDE.md.

When updating `.claude/CLAUDE.md` in this workspace:

1. **PRESERVE all existing sections and headings.** Do not delete, merge, or rewrite sections — add content within them.
2. **PRESERVE all blockquote guidance** (`> **TODO:**`, `> **Five highest-impact...**`, etc.). They are intentional prompts for the team. You may add content near them but do not remove them.
3. **DO NOT rewrite the file from scratch.** Edit in place. The structure was designed for multi-repo workspaces.
4. **SCAN each subdirectory listed in `repos.json`** as an independent repo. Look for cross-repo patterns: shared types, API contracts, import relationships, deployment dependencies.
5. **ADD cross-repo discoveries** to the Cross-Repo Relationships section. Be specific: endpoints, data flow direction, timeouts, failure modes.
6. **DO NOT add repo-specific info** (build commands, test runners, lint configs, dependency lists) to this file. That belongs in each repo's own CLAUDE.md.
7. **Update the "Last reviewed" date** at the top of the file when making substantive edits.

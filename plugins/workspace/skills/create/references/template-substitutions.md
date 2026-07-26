# Template Substitution Rules

Rules for substituting placeholders in `CLAUDE.md.template`. Read this file during Phase 6 Part B.

## Simple Substitutions

Replace these strings globally:

- `__TEAM_NAME__` -> team display name (e.g., "Payments")
- `__TODAY__` -> current date in YYYY-MM-DD format (use `date +%Y-%m-%d`)
- `__TRACKER_PREFIX__` -> project tracker prefix or "PREFIX" if none given

## Multi-line Substitutions

### `__DEPLOY_TABLE__`

```markdown
| Repo | CI/CD | Dev Deploy | Stg/Prd Deploy |
|------|-------|------------|----------------|
| `repo-name` | TODO | TODO | TODO |
```

One row per repo across all groups.

### `__CROSS_REPO__`

```markdown
> **TODO:** Add a ### heading for each pair of repos that interact. Your repos: repo1, repo2, repo3

TODO: Document cross-repo relationships here
```

Where repo names are comma-separated basenames of all repos. MUST end with a trailing blank line (the template has no separator before the next heading).

### `__TRACKER_SECTION__`

- If tracker prefix given: `- **{PREFIX}-** prefix for {Team Name} work`
- If no prefix: `- **[PREFIX]-** prefix for {Team Name} work`

# Tests

Smoke tests for every plugin. Run locally:

```bash
bash tests/run.sh
```

CI runs the same script on every push and PR — see `.github/workflows/validate.yml`.

## What these tests cover

- **JSON schema**: `marketplace.json` cross-checked against every `plugin.json`. Catches version drift, missing fields, duplicate plugin names.
- **SKILL.md gold spec**: every `SKILL.md` must carry YAML frontmatter with the `alextongme:` namespace, a trigger-loaded description including `Do NOT use for:` negatives, and the required sections (Overview, Quick Reference, Requirements for Outputs, Process, Example).
- **Fixture: PR summary example** — the worked example inside the skill must itself demonstrate every section the skill claims to produce.
- **Fixture: worksheet base template** — the print-CSS contract (pure `@page`, `.sheet` Safari fallback, `@media print`, `print-color-adjust: exact`).

## What these tests do NOT cover

Full behavioral testing of a skill requires running Claude against fixtures and diffing output. That is expensive, flaky, and over-engineered at two plugins. Revisit when the marketplace has 10+ plugins or when a specific regression makes the cost worth it.

Until then, the bet is: if every plugin follows the same structural contract, the behavioral bar is met.

## Dogfood test (manual)

Before announcing a new plugin version, run the full install flow in a clean Claude Code session:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install pr-summary-generator
# ...invoke the skill against a real repo
```

Repeat for every plugin touched. This is the only reliable end-to-end check and cannot be automated without shipping the plugin first.

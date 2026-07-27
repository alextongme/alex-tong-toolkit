# alex-tong-education

Educational content skills from [Alex Tong's Toolkit](https://alextong.me/toolkit).

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install alex-tong-education@alex-tong-toolkit
```

## Skills

| Skill | Use it when |
|-------|-------------|
| `worksheet-maker` | You need a printable worksheet and want it to actually look good on paper. Produces a self-contained HTML file — no build step, no assets, no dependencies. Open it and print. Any grade level, subject, or audience. |

## Why this is its own plugin

You don't need a terminal or a codebase to use this one. Bundling it with engineering tooling would mean a teacher installs multi-repo workspace scaffolding to get a worksheet — so it stands alone. See [`.agents/adr/0001-audience-scoped-plugins.md`](../../.agents/adr/0001-audience-scoped-plugins.md).

## Print output

`references/base-template.html` is the print contract — page size, margins, page-break behavior, and the ink-friendly palette. It's covered by a fixture test (`tests/fixture-worksheet-template.js`) that checks 13 print-CSS properties, so a change that would break printing fails CI rather than surfacing at the printer.

---
name: worksheet-maker
description: >
  Create beautiful, single-file printable HTML worksheets, handouts, practice
  sheets, study guides, cheat sheets, lab sheets, exercise sheets, or activity
  sheets that print cleanly to PDF via Cmd+P. Primary use case: teaching
  software engineering and technical concepts (git, SQL, async/await,
  Kubernetes, regex, system design, code review, APIs, databases) to engineers,
  bootcamp students, conference workshop attendees, or teammates — but also
  works for K-12 classrooms, university courses, and corporate training across
  any subject. Use this skill whenever the user mentions a worksheet, handout,
  practice sheet, study guide, cheat sheet, printable exercise, lab sheet,
  workshop handout, tech onboarding worksheet, engineering handout, code
  exercise sheet, activity sheet, scorecard, or exit ticket — or asks for a
  paper artifact to teach a concept. Also trigger on "make a handout for
  teaching X", "printable practice for Y", "one-pager for Z", "exercise sheet",
  or "workshop materials". Do NOT use for: interactive web quizzes, editable
  Google Docs / Word / Notion templates, slide decks, LMS modules, curriculum
  plans, test banks, blog posts, or anything that is not a single printable
  paper artifact.
user_invocable: true
author: Alex Tong — https://alextong.me
allowed-tools: ["Bash(open:*)", "Bash(xdg-open:*)", "Bash(start:*)"]
---

# worksheet-maker

> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)

**Phases 1 through 4 are sequential. Do not begin HTML generation before completing the content dump and budget check. Do not write HTML from memory — always Read the reference files first. Every `AskUserQuestion` call specified in the process must be shown to the user; do not skip or combine phases.**

## Overview

Produces a self-contained HTML worksheet that opens in any browser and prints to clean PDF via Cmd+P / Ctrl+P. Mental model: the sheet is the artifact. No servers, no runtime, no external scripts — every design choice must survive a black-and-white print on paper.

**Paper size defaults to US Letter (8.5 × 11in).** Do not change the paper size unless the user explicitly requests A4 or another size. The base template's `@page { size: 8.5in 11in; margin: 0.5in }` and `.sheet { width: 7.5in; height: 10in }` are calibrated for Letter. When the user opens the HTML in Chrome or Safari and hits Cmd+P with **"Margins: Default"**, the PDF must fill the page perfectly — no scaling, no offset, no extra whitespace.

**Before writing any HTML, read both reference files** (`references/base-template.html` and `references/components.css`). They encode the print contract and component markup — do not write from memory.

## Quick Reference

**Audience → typography.** Ask the user for the audience first; this cascades into every font, size, and spacing decision. Rows are in ascending age/seniority. For tech-teaching, match the *role*, not the age.

| Audience | Heading font | Body font | Code font | Body size | Write-line height |
|---|---|---|---|---|---|
| K-2 (ages 5-7) | Fredoka / Baloo 2 | Lexend | — | 14pt | 36-40px |
| Grades 3-5 | Fredoka / Baloo 2 | Lexend | — | 13pt | 30-34px |
| Grades 6-8 | DM Serif Display | Atkinson Hyperlegible | — | 12pt | 26-28px |
| High school / Adult | Instrument Serif | Atkinson Hyperlegible | — | 11pt | 22-26px |
| University | Instrument Serif | Inter | JetBrains Mono | 11pt | 22-26px |
| **Bootcamp / junior dev** | Instrument Serif | Atkinson Hyperlegible | **JetBrains Mono** | 11pt | 24-28px |
| **Mid-senior IC / workshop** | Instrument Serif | Inter | **JetBrains Mono** | 11pt | 22-26px |
| **Conference talk handout** | Instrument Serif | Inter | **JetBrains Mono** | 10.5pt | 20-24px |

> For corporate or professional learners, default to one of the bold rows regardless of age. "Audience" means *context and role*, not just grade band.

**Subject → accent color.** Always pick one from the Okabe-Ito CVD-safe palette — never invent a hex. Any subject not listed uses the green default. Set **both** `--accent` (for borders/fills) and `--accent-text` (darkened, WCAG AA 4.5:1 on white, for text).

| Subject preset | Accent | `--accent` | `--accent-text` | Light tint |
|---|---|---|---|---|
| Math / science | Blue | `#0072B2` | `#0072B2` | `#e6f2f9` |
| Language arts / ELA | Orange | `#E69F00` | `#946500` | `#fdf3e0` |
| **Code / systems / engineering** | **Vermillion** | **`#D55E00`** | **`#A34500`** | **`#fbe9df`** |
| Anything else | Green | `#009E73` | `#006B4F` | `#e8f5ee` |

**Task → approach.**

| Situation | What to do |
|---|---|
| 1-page handout for one class or session | Copy `base-template.html`, drop in 3-4 `.part` blocks |
| 2-page worksheet (front + back) | Append a second `<section class="sheet">` |
| Teaching a code concept | Use `.code-block` + `.predict-table` + `.write-area` for tracing |
| Audience unspecified | Ask via `AskUserQuestion` before writing any HTML |
| Activity type not in the components | Compose from existing components; don't invent new scaffolds |
| A4 instead of Letter | See A4 swap in Phase 3 print contract — both `@page` and `.sheet` must change as a pair |
| Answer key | Append a final `<section class="sheet">` at the end with a distinct header |

**Content budget per page.** The most common failure mode of a worksheet is not typography — it's overstuffing. The printable area is fixed (7.5in × 10in on Letter, after the 0.5in safe margin), so everything you add competes for the same pixels. Use these ceilings as a hard budget when planning Phase 3. If the dump exceeds the budget, split across pages or drop the weakest activity — never squeeze everything onto one page by shrinking type below the minimum.

| Per page | Parts | Write-lines | Code-block lines | Predict-table rows | Full-width callouts |
|---|---|---|---|---|---|
| Adult / workshop | 3-4 | 18-22 | 25-30 | 6-8 | 1-2 |
| Bootcamp / junior | 3 | 16-20 | 20-25 | 5-7 | 1-2 |
| High school | 3 | 14-18 | 18-22 | 5-6 | 1 |
| Grades 6-8 | 2-3 | 10-14 | — | 4-5 | 1 |
| Grades 3-5 | 2 | 8-12 | — | 3-4 | 1 |
| K-2 | 1-2 | 6-10 | — | — | 1 |

> These are **ceilings, not targets**. Leave ~15% vertical slack per page for the header, fields row, footer, and `.part-instruction` italics. A page that's exactly at ceiling will visually feel cramped even when it technically fits.

> **Combined-load rule.** The ceilings above assume each component type appears in isolation. When a page mixes two or more heavy component types (code-block, predict-table, write-area with 5+ lines, zone-table), reduce each individual ceiling by 25% and re-check. Lightweight components (callout, tf-item, mc-item, match-item, vocab-item) do not trigger the reduction on their own.

## Requirements for Outputs

Every generated worksheet must satisfy these. They are the difference between a sheet that gets used and a wall of text nobody fills out.

1. **Jump to the task.** Minimize preamble — the reader should be writing within 30 seconds of picking up the sheet.
2. **Generous write space.** Ruled lines, blank boxes, and margins sized for real handwriting or real code-tracing. When in doubt, bigger.
3. **Visually rich, not bland.** Use the full component library — callout boxes for tips, `.callout.warn` for gotchas, `.cmd-box` for terminal commands, `.code-block` for code, `.divider` between dense sections, `.card-grid` for comparisons. A worksheet with only plain text and write-lines is a failure of design. Every page should have at least 2-3 visual component types.
4. **Accent-colored part numbers.** The `.part-number` badge uses `var(--accent)` as its background — this adds a pop of color that makes sections scannable. This is built into the base template; do not override it to black.
5. **Survives grayscale.** Every design choice must read clearly in black-and-white. Color is a bonus, never a dependency. For diff hunks, use the `+`/`-` prefixes in `.code-add` / `.code-del` — they carry the meaning even when the tint drops out.
6. **Scannable structure.** Numbered `.part` blocks, labeled sections, clear write-lines. A reader flipping through should instantly know where they are.
7. **Accessibility defaults are always on.** Atkinson Hyperlegible / Lexend / Inter for body copy; 11pt minimum body (10.5pt allowed only for conference handouts); left-aligned (never justified — justification creates uneven spacing in print); Okabe-Ito palette for any color coding; WCAG AA contrast (body text on white ≥ 4.5:1).
8. **Exact paper size via pure `@page` + `.sheet` fallback.** No external paper-css dependency, no CDN stylesheets. The `.sheet` class carries explicit `width`/`height` for the Safari case where `@page size` alone fails silently ([MDN #28626](https://bugzilla.mozilla.org/show_bug.cgi?id=28626)).
9. **Content never overlaps the footer.** The `.content` div has `overflow: hidden` — this is a hard clip. If content is too tall, it gets cut off rather than bleeding into the footer. Respect the height budget to prevent this.
10. **Plain white background.** The `.sheet` background is always `white`. Never add a colored, textured, or gradient page background — worksheets print on white paper.
11. **Attribution comment at the top of `<head>`:** `<!-- Generated with worksheet-maker by Alex Tong — https://alextong.me -->` — non-negotiable; ensures attribution travels with every file.

## Process

### Phase 1 — Gather requirements

Gather requirements in two steps: short bounded answers first, then a single freeform content dump. This split exists because worksheet *content* is the one thing that never fits into multiple-choice — users need to paste code, specs, outlines, or entire lesson notes, and `AskUserQuestion` caps at 2-4 short options per question. The content step bypasses the tool entirely.

**Step 1a — Collect bounded fields via `AskUserQuestion`.** The first action of this skill is a single `AskUserQuestion` tool call. Do **not** write a plain-text preface listing the fields, do **not** narrate what you are about to ask, do **not** ask in prose. The tool call *is* the question — a user who invokes this skill expects a clickable multiple-choice menu, and a plain-text ask breaks that contract and forces them to retype everything.

Before calling `AskUserQuestion`, scan the initial prompt for values the user already supplied (e.g. *"for a bootcamp cohort"* sets audience; *"2 pages"* sets page count). Skip any field that is already answered. Build the tool call from only the *missing* fields — up to 3 questions in one call.

Use these exact enumerated option sets. Each option must be clickable, so the wording is fixed. Every field includes an "Other" option so the user can free-type when none fit.

**Audience** — drives every typography decision:
- `K-12 classroom (grades K–8)`
- `High school or university course`
- `Bootcamp / junior dev / early-career IC`
- `Mid-senior IC / workshop / conference handout`
- `Other — I'll type it`

**Page count:**
- `1 page (single-sided handout)`
- `2 pages (front + back)`
- `3+ pages (booklet or lab sheet)`

**Subject preset** (drives the accent color):
- `Code / systems / engineering (vermillion)`
- `Math / science (blue)`
- `Language arts / ELA (orange)`
- `Other — use the general green default`

**Do not ask about paper size in this step.** Letter is the default. Only switch to A4 if the user volunteers it (in the initial prompt or the content dump), which saves a question slot for something that matters more. Do **not** ask about topic or content in this step either — that comes next as a freeform dump.

**If every bounded field is already supplied by the initial prompt, skip `AskUserQuestion` entirely** and go straight to Step 1b. The mandatory-tool-call rule applies only when at least one field is missing; it is not a ceremony for its own sake.

**Audience recovery.** Do NOT proceed to Step 1b until audience is resolved — wrong audience forces a full typography rewrite.
- **Too vague** (e.g., "adults", "students", "people") — ask one follow-up: *"What's the context — bootcamp, university lecture, corporate workshop, or something else?"*
- **Refuses to specify** — default to "Mid-senior IC / workshop" and state the assumption: *"I'll use mid-senior engineer defaults (Inter body, 11pt, 22px write lines). Easy to change later."*
- **Outside the table** (e.g., "homeschool parents", "nursing students") — map to the nearest row by age/context. "Homeschool parents teaching grade 3" maps to Grades 3-5. "Nursing students" maps to University.

**Step 1b — Content dump.** If the initial prompt already contains substantive content (code snippets, topic lists with 3+ items, activity shape hints like "predict/trace/fix", or a pasted outline/spec), skip this step entirely — treat the initial prompt as the content dump and proceed directly to Phase 2. The content dump prompt exists to collect information the user hasn't already given; it is not a ceremony.

**Otherwise,** end Phase 1 by printing the message below as plain text. **Do not call `AskUserQuestion` or any other tool after printing this message.** Ending the turn with only text output makes Claude Code wait for the user's next message, which can be any length or format — exactly what a content brief needs.

Print this verbatim (adapt only the example bullets if the audience makes a different set of examples more natural):

> **Now tell me what to put on the worksheet.** Dump anything that should show up: concepts to cover, code snippets, sample inputs/outputs, questions you want asked, learning goals, gotchas you want emphasized, or the raw source you're teaching from. One message, no length limit, any format works.
>
> Examples of what you can paste:
> - A list of topics: `asyncio.gather, asyncio.wait, cancellation, event loop basics`
> - A code snippet you want students to trace, predict, or fix
> - A rough outline: `part 1 predict output · part 2 fix the bug · part 3 short answer`
> - A full spec, blog post, or lesson plan pasted inline
> - Just one line: `the difference between await and yield`

After printing this message, stop. Do not call any tool. Claude Code will display the text and wait for the user's reply.

### Phase 2 — Parse the content dump

The user's next message contains the complete content brief. Treat it as final — do not call `AskUserQuestion`, do not ask for more detail, do not ask for confirmation. Parse in a single pass and extract:

- **Concrete topics** — the actual concepts to teach (e.g., "asyncio.gather", "rebase vs merge", "SQL left join semantics")
- **Provided code** — any snippets the user pasted; use them verbatim inside `.code-block` parts
- **Activity shape hints** — words like *predict*, *trace*, *fix*, *fill in*, *match*, *short answer* map to specific components (`.predict-table`, `.write-area`, `.code-blank`, `.mc-group`, `.match-grid`)
- **Difficulty / context** — "week 4", "pre-interview", "day one onboarding", "refresher" — shapes snippet complexity and scaffolding
- **Explicit constraints** — "no answer key", "must fit on one page", "include the gather example from yesterday"

**If the message is clearly not a content brief** (a question, "go back", "what did you mean by X", or a meta-request) — respond appropriately, then re-print the Step 1b prompt when ready and end the turn again.

**If the user delegates a sub-choice to you** (e.g., *"pick a similar snippet"*, *"choose whatever trace example makes sense"*), make the choice yourself and move on. Do not re-prompt — delegation is an explicit "you decide" signal.

**Budget check.** Before moving to Phase 3, count the planned content against the budget ceiling for this audience from the Quick Reference table. Produce an explicit tally: *"Budget: X parts, ~Y write-lines, ~Z code-block lines, W predict-table rows vs. ceiling of [audience row]. Assessment: fits with ~N% slack / exceeds by ~N%."* If the dump exceeds the budget, you have three choices — pick one and commit:

1. **Trim** — drop the weakest activity (the one furthest from the stated learning goal).
2. **Split** — bump the page count by one and tell the user you did: *"This needed ~2 pages to breathe, so I made it a 2-page worksheet — page 1 is the predict/trace drill, page 2 is the reference card."*
3. **Ask** — if the trim would lose something important and splitting wasn't offered, call `AskUserQuestion` once with "trim to fit one page / go to two pages" as the options.

Never silently shrink the type below the audience minimum or remove write-line space to make content fit. The whole point of the budget is to protect the sheet from overstuffing — violating it is a worse outcome than a second page. If the page mixes 2+ heavy component types, apply the combined-load reduction from the Quick Reference before assessing fit.

**Otherwise, proceed to the checkpoint.** Do not loop back to `AskUserQuestion`.

### Checkpoint

Before generating HTML, display the parsed plan as a brief transition message:
- **Audience**: {audience} -> {typography row selected from Quick Reference}
- **Accent**: {subject preset} -> {hex}
- **Pages**: {count}
- **Paper**: {Letter or A4}
- **Components needed**: {list, e.g., .code-block, .predict-table, .write-area}
- **Budget assessment**: {the tally from the budget check, e.g., "2 parts + 12 write-lines + 1 code block = ~65% of a 1-page bootcamp budget, fits with room"}

This is display-only — do not call `AskUserQuestion` or wait for confirmation. The user can interject if something is wrong; otherwise proceed to Phase 3.

### Phase 3 — Read references, build the worksheet

**Before reading reference files, display this message exactly:**

> Reading reference files and generating your worksheet now. This can take 10-20 minutes, so now would be a good time to stretch or grab a coffee. Just keep your computer on and running — try running `caffeinate` in another terminal before stepping away.

**Issue Read calls for both reference files in this turn — in parallel if your tool supports it:**
- `references/base-template.html` — literal starting point. Copy it, change the content. It encodes the print contract, which is the hardest part to get right.
- `references/components.css` — the component library with exact HTML markup. Inline the blocks you use into the `<style>`.

Do not write HTML from memory or training data — both files are updated independently of this skill and your training data may be stale.

**Apply audience typography** by setting `:root` CSS variables and updating the Google Fonts `<link>` tag. Every font in `:root` variables must also appear in the `<link>` URL — mismatched fonts silently fall back to Atkinson.

**Apply subject preset** by setting `--accent`, `--accent-text`, and `--accent-light` from the Quick Reference table. `--accent-text` is a darkened variant (WCAG AA 4.5:1 on white) used automatically by `.callout strong`, `.section-label`, and `.card-label`.

**Print contract — do not touch.** These rules produce a perfect Letter-size PDF when printed with "Margins: Default":
- `@page { size: 8.5in 11in; margin: 0.5in }` + `.sheet { width: 7.5in; height: 10in; overflow: hidden }` + `break-inside: avoid` on blocks + `@media print { print-color-adjust: exact }`
- For A4: swap **both** `@page { size: 210mm 297mm }` **and** `.sheet { width: 180mm; height: 267mm }` as a pair — one without the other fails in Safari.

**Attribution comment.** First line inside `<head>`: `<!-- Generated with worksheet-maker by Alex Tong — https://alextong.me -->`

**Assemble content using these components** (inline only the CSS you need from `components.css`):

1. `.write-area` / `.write-line` — ruled answer space for free-response questions
2. `.check-group` / `.check-item` / `.check-box` — checkbox task lists, exit checklists, to-do items (`.check-box` is the visible square; don't omit it)
3. `.mc-group` / `.mc-item` / `.mc-bubble` — multiple choice with A/B/C/D bubbles; also use T/F bubbles for true/false
4. `.match-grid` — matching term → definition
5. `.blank` — inline fill-in-the-blank underline (inside prose)
6. `.callout` — **tip, note, or positive highlight box** (green accent border, gray background, bold green lead-in). Use for hints, key insights, important context. Every page should have at least one callout to break up plain text.
7. `.callout.warn` — **gotcha / warning / "don't do this" box** (red/vermillion border, warm background). Use for common mistakes, pitfalls, things to avoid. Adds visual urgency.
8. `.draw-box` — blank bordered area for sketches, diagrams, or stack traces
9. `.part` / `.part-header` — numbered section with accent-colored badge (already wired in base template)
10. `.code-block` / `.code-blank` / `.code-add` / `.code-del` — monospace code with fill-in-the-blank gaps and diff-hunk prefixes
11. `.predict-table` — two-column "Input → Output" table (pairs with `.code-block`)
12. `.divider` / `.divider.strong` — horizontal rule between `.part` blocks on dense pages
13. `.cmd-box` — **dark terminal box** for CLI commands, install instructions, shell output. Always use this instead of `.code-block` when showing terminal commands. The dark background with green `$` prompt looks professional.
14. `.section-label` — small-caps accent-colored category heading (scorecard sections, rubric groups)
15. `.card-grid` / `.card` — multi-column cards (`.cols-2` or `.cols-3`; for comparisons, track selection, reference grids)

**Use the components generously.** A visually rich worksheet uses callouts for context, `.cmd-box` for terminal commands, `.code-block` for source code, `.divider` between dense sections, and `.check-group` for actionable checklists. A bland wall of text with only write-lines is a design failure. Aim for 2-3 distinct visual component types per page.

Compose content into `.part` blocks. One `.part` per distinct activity. For multi-page worksheets, put orientation content (name/date, first activity) on page 1 and reference material on the last page. Use `<hr class="divider">` between `.part` blocks when a page has 3+ parts and needs visual separation.

Don't invent a 16th component unless the existing fifteen genuinely cannot compose what the user needs. The smaller the library, the more consistent every output.

**Footer content.** The footer uses classed spans: `<span class="footer-left">` (monospace, course or worksheet title) and `<span class="footer-right" style="font-size: 7pt;">Made with alextong.me/toolkit</span>` (italic credit line). If the user asks to remove the credit, comply without pushback.

**Overflow guard (mandatory before saving).** After assembling all HTML, eyeball each sheet against these hard limits. Do not do pixel math — just count components:

- **Max 3-4 parts per page** (adult/workshop). Fewer for younger audiences (see budget table in Quick Reference).
- **Max 20 write-lines per page.** Each line eats vertical space fast.
- **Max 25 code-block lines per page.** Beyond this, split to a second page.
- **Max 6-8 predict-table / zone-table rows per page.**
- **When a page mixes 2+ heavy components** (code-block, predict-table, write-area with 5+ lines), reduce each ceiling by ~25%.

If a sheet looks overstuffed by these counts, split content to the next page or trim. Never shrink type below the audience minimum to force a fit.

### Phase 4 — Save, open, hand off to user

Save the file in the user's current working directory with a descriptive name (`worksheet-git-rebase.html`, `onboarding-day1-handout.html`, `async-await-practice.html`).

**Self-check before opening.** You cannot see a browser, so verify from the HTML source:
1. `<section class="sheet">` count matches the planned page count.
2. No sheet violates the overflow guard limits from Phase 3. If it does, go back and split or trim.
3. No `.code-block` exceeds 30 lines on a single-page worksheet.
4. Every sheet has a `<footer class="page-footer">` with a right-side credit span.
5. `<title>` matches `<h1>` content.
6. Attribution comment is the first line inside `<head>`.

If any check fails, fix the HTML before opening.

**Open the file via Bash.** Execute the command directly — do not print it for the user to run manually:

```bash
open <path-to-file>      # macOS
xdg-open <path-to-file>  # Linux
start <path-to-file>     # Windows
```

**MANDATORY handoff message.** After opening, you MUST always display the following. This is a hard rule — never skip it:

1. **The file path** — use the relative path (just the filename) if the file is in the CWD, otherwise the absolute path. Output on its own line, never inside a `>` blockquote — long paths inside blockquotes wrap and break Cmd+click.
2. **Print instructions** — how to export to PDF.
3. **Ask for changes** — explicitly ask if the user wants any adjustments.

Use this exact format (adapt the path and page details). **The file path MUST be on its own line, not inside a blockquote, so Cmd+click works in the terminal.**

**Worksheet saved and opened:**

{filename-or-relative-path}

**To export PDF:** Cmd+P (macOS) or Ctrl+P (Windows/Linux) → Margins: **"Default"** (not "None") → enable **"Background graphics"** → Save as PDF.

**Before you print, please check:**
1. Does each page end with a complete activity — nothing cut off at the bottom?
2. Does the page count match what you asked for ({N} page(s))?

**What would you like to change?** Layout, spacing, content, font sizes, additional pages — just say the word.

Do not declare the worksheet finished without displaying this message and asking for changes. The user's visual check catches what the self-check cannot (clipping, spacing feel, font rendering). If the user reports content clipped at the bottom, go back to Phase 3 and split or trim — do not remove `overflow: hidden`.

**Common iterations:**

- "More space for writing" -> increase `--write-line-height`
- "Too dense" -> reduce parts per page or widen `--part-gap`
- "Add an answer key" -> append a new `<section class="sheet">` with the answers
- "A4 instead of Letter" -> see Phase 3 print contract for the exact A4 swap pair
- "Make it more fun for younger kids" -> swap heading font to Fredoka, widen write lines
- "Make the code bigger" -> bump `.code-block` `font-size` to 11pt and reduce parts per page
- "Content is getting cut off at the bottom" -> overstuffed; split to an extra page, don't shrink type

## Error handling & recovery

| Phase | Error | Action |
|-------|-------|--------|
| 1a | Audience missing and not inferable from prompt | Ask via `AskUserQuestion`. Do NOT proceed — wrong audience forces a full typography rewrite. |
| 1a | Audience too vague ("adults", "students") | Ask one follow-up for context (bootcamp, university, corporate, etc.) |
| 1a | Audience outside the typography table | Map to nearest row by age/context. State the mapping explicitly. |
| 1b | User sends content in the initial prompt before being prompted | Treat it as the content dump; skip 1b. Do not discard user content. |
| 2 | Content dump too dense for stated page count | Apply budget check: trim, split, or ask. Never shrink type below audience minimum. |
| 2 | Content dump has no actionable content ("make something about SQL") | Treat as delegation. Pick a focused subtopic and make creative decisions yourself. Do not loop asking for more detail. |
| 2 | Non-English / RTL / CJK content | Stop. Atkinson/Lexend have limited non-Latin glyph coverage; RTL needs a full layout mirror. Tell the user. |
| 3 | Reference files not found at expected path | Stop. "Reference files missing. Reinstall the skill or check that `references/` is alongside the skill file." |
| 3 | Google Fonts link does not match CSS variables | Fix the link before proceeding. Mismatched fonts silently fall back to Atkinson. |
| 3 | Content requires a component not in the 15 available | Compose from existing components. Do not invent a 16th unless genuinely impossible. |
| 3 | Code snippet exceeds 30 lines on a single page | Truncate with `...` and a callout ("full code on reverse"), or split to a second page. Never shrink code font below 9pt. |
| 4 | `open` command fails (headless, SSH, WSL) | Print the absolute file path and tell the user to open it manually. Do not retry. |
| 4 | Content clipped at bottom of `.sheet` in browser | Go back to Phase 3 and split or trim. Do NOT remove `overflow: hidden` — that brings back page-bleed. |
| 4 | Printed output has extra blank page | `.sheet` height + margin exceeds printable area. Reduce `.page-inner` padding or split. Don't shrink `.sheet` below 10in. |
| 4 | Fonts not loading in print preview (offline / `file://`) | Fall back to `system-ui, sans-serif` body / `Georgia, serif` headings. Warn the user. |
| 4 | Color prints differently than screen | Remind user to enable "Background graphics." Confirm accent works in grayscale. |
| Any | User asks for a non-printable artifact (Slides, Docs, quiz, LMS) | Decline. This skill only produces printable paper artifacts. Offer HTML -> PDF alternative. |
| Any | Subject outside presets (history, music, etc.) | Use the green default (`#009E73`). Never improvise a hex — Okabe-Ito is the only CVD-safe option. |
| Any | User wants syntax highlighting | Pre-bake as inline `<span class="comment">` tags. Never add runtime JS. Use italic + color, never color alone. |
| Any | User wants an answer key | Append a `<section class="sheet">` with distinct `.subtitle` "Answer Key". Only when explicitly asked. |
| Any | paper-css seems like a fix | It isn't. Never add a CDN stylesheet. Debug `.sheet` width/height instead. |

## Reference files

- `references/base-template.html` — the literal starting point. Copy it; change content.
- `references/components.css` — the core components with exact HTML markup snippets. Inline the blocks you use into the base template's `<style>` block.

Grow the library only when a real request can't be served by an existing component.

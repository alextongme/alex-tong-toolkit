# Cowork delegation prompt template

When Glassdoor, Blind, or LinkedIn block direct WebFetch, generate a delegation prompt the user pastes into Claude Cowork (or any browser-driving agent with access to their logged-in sessions). The agent uses the user's authenticated browser to capture data and writes findings to a file.

## How to use this template

1. Customize the placeholders for the specific company being researched.
2. **Always include the disambiguation block** — the delegated agent must not pull from the wrong entity.
3. Copy the customized prompt to clipboard via `pbcopy`. Tell the user the byte count so they know it copied successfully.
4. Tell them the path the delegated agent will save findings to.
5. Pause. Don't continue research until they paste findings back or confirm the file exists.

## Customization checklist

Before copying, fill in:

- `[COMPANY NAME]` — the canonical name
- `[CANONICAL DESCRIPTOR]` — one-liner like "the data analytics workspace startup"
- `[FOUNDERS / CEO]` — verify name
- `[YEAR FOUNDED]`
- `[HQ CITY]`
- `[HEADCOUNT RANGE]`
- `[CAREERS URL]` — `[company].com/careers` or similar
- `[GLASSDOOR ID]` — the `EXXXXXXX` from the URL
- `[LINKEDIN COMPANY SLUG]` — from `linkedin.com/company/[slug]`
- `[OPEN ROLE URLS]` — list each open role of interest with its band
- `[ROLE OF INTEREST]` — e.g., "Product Manager", "Software Engineer"
- `[CONFUSABLES]` — other companies that share the name, with one-line "why it's not us" notes
- `[OUTPUT FILENAME]` — typically `~/Desktop/[company-slug]-research-findings.md`

## The template

```
I need you to log into Glassdoor, Blind, and LinkedIn and pull research on the [ROLE OF INTEREST] interview process at **[COMPANY NAME]** — [CANONICAL DESCRIPTOR], founded [YEAR FOUNDED] by [FOUNDERS / CEO]. HQ [HQ CITY]. ~[HEADCOUNT RANGE] employees. Save findings to [OUTPUT FILENAME] as you go.

## STEP 0 — Browser session check (do this FIRST)
Check whether you can access my already-authenticated Chrome session for Glassdoor, Blind, and LinkedIn. If you can drive my logged-in Chrome directly, do that — no need to ask me to log in again. If you CANNOT use my existing Chrome session and need me to log into any of these sites in a window you control, STOP and ask me which sites need a fresh login before proceeding. Don't try to log in with credentials yourself.

## PRIMARY GOAL
Find as much detail as possible on the **[ROLE OF INTEREST] interview loop** at this company. Everything else is secondary. The job postings I'm researching:
[OPEN ROLE URLS]

## Disambiguation (critical — do not pull from the wrong entity)
I've already verified the correct entity:
- Company: [COMPANY NAME], [CANONICAL DESCRIPTOR]
- Founders/CEO: [FOUNDERS / CEO]
- Founded: [YEAR FOUNDED]
- HQ: [HQ CITY]
- Headcount: ~[HEADCOUNT RANGE]
- Glassdoor ID: [GLASSDOOR ID]
- LinkedIn slug: [LINKEDIN COMPANY SLUG]

Be careful to AVOID these unrelated companies that share the name:
[CONFUSABLES]

If you find a second Glassdoor listing under a similar name, verify it independently (check founders, founded year, HQ) before treating its reviews as relevant. Note in the output whether it's a duplicate of the same entity or a different company entirely.

## Tasks in priority order

### TASK 1 — Glassdoor [ROLE OF INTEREST] interview reports
Go to: https://www.glassdoor.com/Interview/[company-slug]-Interview-Questions-[GLASSDOOR ID].htm

For each PM/role-specific report:
1. Confirm the company matches the disambiguation signals above
2. Filter to the target role; if no reports exist, capture the most recent 5 reports for ANY role (they reveal the general loop structure)
3. For each report capture VERBATIM:
   - Job title, date, location
   - Outcome (offer / no offer / declined / withdrew)
   - Difficulty rating
   - Experience rating (positive / neutral / negative)
   - Full text of the candidate's write-up — every word, no paraphrasing
   - Every interview question listed
4. Capture overall stats: total interview count, % positive, avg difficulty, avg duration

### TASK 2 — Blind
Go to https://www.teamblind.com/company/[company-slug] and:
1. Confirm the company description matches the disambiguation signals
2. Capture every review's full text, ratings, and date
3. Search Blind for: `[company] interview`, `[company] [role]`, `[company] loop`, `[company] presentation`, `[company URL]`
4. Capture full text of any relevant posts + informative replies

### TASK 3 — LinkedIn (current and former employees in [ROLE OF INTEREST])
1. Filter People search by Current Company = [LINKEDIN COMPANY SLUG] + keyword = role title — verify it's the right entity
2. Capture count, names, titles, locations, tenure where visible
3. Repeat with Past Company — these are people who LEFT (retention signal). Where did they go next?
4. Search LinkedIn Posts for: `[company] interview`, `interviewing at [company]`, `joining [company]`, `[company] [role]`. Capture first-person writeups verbatim.
5. Look for the hiring manager's own hiring post — usually the highest-signal artifact.

### TASK 4 — Levels.fyi
Search levels.fyi for the company. Capture any compensation data for the target role (level, base, equity, total comp, tenure, location). Also capture comp ratios across roles for context.

## Output format
Write findings to [OUTPUT FILENAME] with this structure:

# [COMPANY NAME] [ROLE OF INTEREST] Interview Research

## Browser session check
(Did you use my existing Chrome session, or did I need to log in fresh? Which sites required which?)

## Disambiguation finding
(Confirm the entity. If a second Glassdoor listing exists, note whether it's a duplicate or a different company.)

## Glassdoor — interview reports
(Verbatim, one subsection per report.)

## Glassdoor — overall stats
(Total count, % positive, difficulty, duration.)

## Blind findings
(Verbatim. Note if there's nothing.)

## LinkedIn findings
(Headcount, tenure, departures, hiring manager post, any first-person writeups.)

## Levels.fyi findings
(Comp data and ratios.)

## Notes on credibility
(Sample sizes, dates, any caveats.)

Be exhaustive on quotes — verbatim is more useful than summarized. If a section yields nothing, write "No findings" rather than skipping. Don't paraphrase candidate write-ups; copy them.
```

## After the user pastes findings back

Read the findings file, then weave it into the packet:

- Disambiguation findings update the packet's intro
- Glassdoor verbatim quotes go into culture and interview-process sections
- LinkedIn hiring manager post becomes its own dedicated section (usually the most valuable artifact)
- Blind findings cross-check Glassdoor — divergence is signal worth flagging

Never just dump the findings file into the packet. Synthesize. Pull the verbatim quotes that matter; discard noise.

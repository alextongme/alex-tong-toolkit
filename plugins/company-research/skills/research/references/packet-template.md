# Packet template

The output of the skill is a saved markdown file with this structure. Omit sections that don't apply (e.g., skip role-specific sections when no role was provided). Never write empty placeholder sections — drop the heading instead.

Save to `~/Desktop/[company-slug]-[role-slug]-prep-packet.md`, or `~/Desktop/[company-slug]-research-packet.md` if no role.

## Required sections

### 1. Intro (always)

```
# [Company name] [Role] Prep Packet

Research compiled for [purpose — e.g., "a Product Manager interview" or "general company research"]
at **[Company name] ([canonical descriptor])**. Pulled from [list of sources used]. Sample sizes
are noted where they matter; treat as directional.

[Optional one-line disambiguation note: "This packet is about [Company A], not the [Company B]
that shares a similar name."]
```

### 2. Company at a glance (always)

Compact factual block:

```
- **Product:** [what they do]
- **Founded:** [year]
- **Founders / CEO:** [names + brief context like "ex-Palantir" or "ex-Google"]
- **Headcount:** [range or specific]
- **Funding:** [notable rounds + investor signal]
- **Offices:** [HQ + other locations + hybrid/remote policy]
- **Overall Glassdoor:** [rating, sample size]
```

### 3. Culture read (always)

Two subsections — the good and the yellow flags. Always cite the source and sample size.

```
### The good
- [Specific positive theme] — [verbatim quote where possible] (source, N)
- [Specific positive theme] — [verbatim quote] (source, N)
- ...

### The yellow flags
- [Specific concern] — [verbatim quote, exact wording] (source, N)
- [Specific concern] — [verbatim quote] (source, N)
- ...

### Net read
[1–2 sentence synthesis. Not whitewashed. If concerns are sample-size-limited, say so.]
```

### 4. Sources (always)

Every URL used, with one-line context.

## Conditional sections (include only when relevant)

### 5. The roles (when role-specific research was done)

Table comparing the open role(s):

```
| | [Role A — Location] | [Role B — Location] |
|---|---|---|
| **Salary band** | $X – $Y + equity | $A – $B + equity |
| **Experience** | N+ years | M+ years |
| **Background fit** | ... | ... |
| **Product area** | ... | ... |
| **Equity vesting** | ... | ... |
```

Add a comp-sanity-check line: how this role's band compares to other roles at the company (e.g., "PM band exceeds the company's Levels.fyi SWE median — they pay PMs in the upper bands for the stage").

### 6. The hiring manager (when identified)

Lead with the verbatim hiring post if found.

```
**[Name] — [title] at [Company], [location].** [Background — Cornell + Hashboard, etc.]
Confirmed as hiring manager via [evidence — LinkedIn post URL].

> [Verbatim quote of the hiring post]

**Engagement:** [reactions, comments, reposts]

### What this tells the reader
- [Specific signal 1 — e.g., "data fluency + AI product chops are the two axes he prioritizes"]
- [Specific signal 2]
- [Specific signal 3]

### Current team visible on LinkedIn
- [Name] — [title] — [location] (notes)
- [Name] — [title] — [location]
- ...
```

### 7. Interview process (when role-specific research was done)

Stages, timing, difficulty, verbatim reference loops, practical takeaways.

```
### Confirmed stages
1. Recruiter screen
2. Hiring manager call
3. [Role-specific exercise]
4. Panels
5. [Exec round if applicable]

### Glassdoor stage breakdown (if available)
[Percentages from Glassdoor FAQ]

### Reference loops from non-target-role reports
[Verbatim quotes from adjacent roles to give the user a feel for the company's general style]

### Timing & difficulty
- Average end-to-end: [N days]
- Difficulty: [X/5]
- Candidate sentiment: [%]
- CEO approval: [%]
```

### 8. Role-specific prep (when applicable)

Reference `references/interview-prep.md` for the frameworks; ground them in this company's JD language and hiring manager statements.

Subsections by stage where useful:

- Past-project / portfolio presentation prep
- Behavioral / storytelling prep
- Product sense case prep
- Technical / coding prep
- System design prep
- Exec chat prep

### 9. Sample question prep (when the user surfaced a specific question)

```
> **[Question verbatim]**

### Critical context the candidate should know
[If the question has appeared in other Glassdoor reports — note when and for which role.
This is one of the most valuable signals: companies often reuse questions across roles.]

### Part A: [first half of the question]
[Framework + 2-min specific-story recommendation]

### Part B: [second half if double-question]
[Framework + story recommendation]

### Tactical timing
[How long to spend on the answer]
```

### 10. Suggested questions for the candidate to ask (when role-specific)

Grouped by audience:

```
**For [hiring manager name]:**
- [Specific question tied to their hiring post / public statements]

**Culture / WLB probing:**
- [Questions that get at the yellow flags surfaced earlier]

**Strategic:**
- [Questions about competitive position, product direction]
```

### 11. Day-before checklist (when role-specific)

```
- [ ] Sign up for and use the product
- [ ] Read hiring manager's LinkedIn + recent posts
- [ ] Skim other visible team members' profiles
- [ ] Read 1–2 recent company blog posts
- [ ] Rehearse out loud (specific items: presentation, hardest behavioral, etc.)
- [ ] Prep 3–5 questions
- [ ] Sleep, eat, hydrate
```

## Footer (always)

```
---

*Packet compiled from [public / authenticated source pulls] on [YYYY-MM-DD]. Sample sizes for
[whichever data is thinnest] are small — extrapolated from adjacent signals where direct data was
unavailable.*
```

## Tone guidelines

- Direct. The reader has a decision to make.
- Verbatim quotes > paraphrasing. Disclose sample size with every quote.
- Lead with the single most valuable artifact (often the hiring manager's post) — don't bury it in the middle.
- No moralizing. No "every workplace has tradeoffs" platitudes.
- If a finding is uncertain, say "single review, take with grain of salt" rather than burying the caveat in passive voice.

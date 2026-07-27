---
name: "alex-tong-career:company-research"
description: >
  Research a company comprehensively — culture, work-life balance, leadership, recent news,
  headcount, funding, and competitive position — and optionally produce a role-specific
  interview prep deep-dive (stages, common questions, the hiring manager, comp bands, prep
  frameworks). Pulls from Glassdoor, Blind, LinkedIn, Levels.fyi, Comparably, RepVue, Indeed,
  layoffs.fyi, Crunchbase, Built In, Hacker News, Reddit, and the company's careers page and
  exec social presence. Use whenever someone asks about working at a company, interviewing at
  a company, what a company's culture is like, whether a company is toxic, comp at a company,
  or wants prep for a specific role's interview — including casual phrasings like "is X a good
  place to work", "what's it like at X", "research X", "help prep for an interview at X", or
  any variation that pairs a company name with a workplace, interview, or culture question. Do NOT use for: industry analysis without a target company, product
  reverse-engineering, financial/investment due diligence, or news summaries unrelated to
  working at the company.
user_invocable: false  # Not ready yet — set to true when skill is fully validated
author: Alex Tong — https://alextong.me
---

# company-research

> From [Alex Tong's Toolkit](https://alextong.me/toolkit) by [Alex Tong](https://alextong.me) — more at [alextong.me/newsletter](https://alextong.me/newsletter)

## Overview

Produces a saved markdown "prep packet" combining culture research from authenticated review sites (Glassdoor, Blind, LinkedIn) and public sources (careers page, press, podcasts, Crunchbase). When a specific role is in scope, the packet also captures the interview process, common questions, the hiring manager's public statements, comp bands, and role-specific prep frameworks.

The mental model: most company-research questions are downstream of one or two real decisions — should I take this job, should I accept this interview, is my friend or family member walking into a problem. The packet exists to answer that decision with structured evidence, not vibes.

## Quick reference

| Situation | What to do |
|---|---|
| User mentions a company + interview/culture/WLB question | Run full workflow |
| User mentions a role alongside the company | Include Step 5 role deep-dive |
| User mentions a family member or friend | Capture that — adjust tone to be more frank about yellow flags |
| User gives a sample interview question | Add a dedicated prep section for that question |
| User says they have an authenticated browser (Cowork, signed-in Chrome) | Generate the delegation prompt in Step 4 |
| Glassdoor / LinkedIn / Blind WebFetch returns 403 | Generate the Cowork delegation prompt; copy to clipboard via `pbcopy`; pause |
| Two Glassdoor IDs exist for a similar name | Run the disambiguation protocol against both; do not assume |

## Workflow

### Step 1 — Confirm target and scope

Before any research, ask the user two questions (use the `AskUserQuestion` tool if available — structured multi-choice is faster than free-text):

1. **What company?** Capture the canonical name + careers page URL if known.
2. **What role or job title?** Phrase it: "Want a role-specific interview deep-dive, or just general company research?" Default to general; only do role-specific work when asked.

If the user mentioned a family member or friend, capture that. The tone of the packet should shift toward frankness — the reader may not push the same questions in interviews themselves.

If the user gives you a specific interview question they were sent, capture it verbatim. It becomes a dedicated prep section in the packet.

### Step 2 — Identity lock (disambiguation)

This step is non-negotiable. Multiple companies routinely share names; pulling reviews from the wrong entity poisons every downstream finding.

Verify the company across at least three of these dimensions before proceeding:

- Founders / CEO name
- Year founded
- HQ city
- Approximate headcount
- Product description / industry

When you find a Glassdoor or LinkedIn page, capture the company ID (Glassdoor URLs encode `EXXXXXXX`; LinkedIn uses numeric IDs). Every subsequent claim must be traceable to those IDs.

If two Glassdoor IDs exist for similar names, verify each independently. They may be duplicate listings for the same company, or entirely different companies. Never assume.

See `references/disambiguation.md` for the full protocol and common patterns of confusable names.

### Step 3 — Public-source research

Run these in parallel via WebSearch / WebFetch:

- Company careers page (canonical truth on values, perks, hybrid policy, open roles, comp bands)
- Crunchbase / Contrary Research / press releases (funding, headcount, recent news)
- CEO and exec social presence (Twitter/X, LinkedIn posts, podcasts)
- Recent product launches and engineering blog posts
- Hacker News mentions (`site:news.ycombinator.com [company]`)
- Reddit mentions (avoid `site:reddit.com` — it often returns nothing; search Reddit's own search bar via WebFetch)
- Layoffs.fyi for recorded layoffs
- Built In listings (often have stale but accessible comp bands)
- News search for "[company] layoffs", "[company] CEO", "[company] funding"

See `references/sources.md` for the full source list with notes on what each is best for and which require authentication.

### Step 4 — Authenticated source pull (Glassdoor, Blind, LinkedIn, Levels.fyi)

These sites usually block direct WebFetch. Try once per site; if blocked, generate a delegation prompt the user can paste into Claude Cowork (or any browser-driving agent with access to their logged-in sessions). Pause and wait for their findings.

See `references/cowork-delegation-template.md` for the prompt template. Customize per company — insert the disambiguation context so the delegated agent cannot accidentally pull from the wrong entity.

Copy the customized prompt to the clipboard via `pbcopy` so the user can paste with one keystroke. Tell them where to find the output file the delegated agent should produce.

### Step 5 — Role-specific deep dive (only when requested)

When a role is in scope, layer on:

- Glassdoor interview reports filtered to that role. If zero exist, capture reports from adjacent roles (designer/PM, engineer/data engineer, etc.) — they reveal the company's general loop structure even when the exact role is unrepresented.
- LinkedIn People search: current employees in the role (capture count + tenure pattern + locations). 1st-degree connections give richer data; 2nd/3rd+ often hide tenure.
- LinkedIn People search: past employees in the role (retention signal — where they went next).
- LinkedIn Posts search for "interviewing at [company]", "joined [company]", or first-person interview writeups.
- Hiring manager identification — search LinkedIn Posts for hiring announcements from the role's team lead. This is often the single most valuable artifact.
- JD analysis — extract the language they emphasize (e.g., "early discovery", "ship and iterate", "data fluency"). The repeated phrases tell you what they test for.
- Levels.fyi compensation data for the role, plus a sanity-check ratio against other roles at the company.

See `references/interview-prep.md` for role-specific prep frameworks (past-project presentations, behavioral storytelling, product sense cases, system design, exec chats, recruiter screens).

### Step 6 — Synthesize and save the packet

Save the packet to `~/Desktop/<company-slug>-<role-slug>-prep-packet.md` (or `<company-slug>-research-packet.md` if no role).

Use the structure in `references/packet-template.md`. Always include the company-at-a-glance, culture read, and sources sections. Include role-specific sections only when role-specific research was done.

## Critical principles

**Verify company identity before every claim.** A finding only counts if it's tied to the right Glassdoor ID, LinkedIn ID, or canonical entity signal (CEO, founding year, HQ). If two Glassdoor pages exist, treat them as suspect until proven duplicate.

**Be honest about yellow flags.** Whitewashing the culture read makes the packet useless. If a single reviewer flagged something concerning, say so — and call out the sample size. Don't hide the harshest verbatim quote behind paraphrasing. The reader can discount low-N findings themselves.

**Note sample sizes everywhere.** "Three Glassdoor reviews" is not "Glassdoor." Small N is small N. Readers should be able to gauge confidence from the packet alone, without re-reading every source.

**Surface the single most valuable artifact.** Often one piece of evidence outweighs everything else combined — a hiring manager's LinkedIn post that names the bar they hire to, a specific reviewer's verbatim quote about WLB, a recent layoff announcement, a CEO podcast where they describe their leadership style. Lead the packet with it.

**Don't moralize or pad.** The reader is making a decision. Give them evidence and a clear recommendation, not a lecture about how every workplace has tradeoffs.

**Ground every prep framework in something verifiable about the company.** Generic interview-prep advice exists everywhere; the value here is connecting it to *this* company. When prepping for a role-specific question or stage, anchor it to their JD language, the hiring manager's stated priorities, or a real candidate report — not generic frameworks.

## Output format

The packet is a markdown file the user can re-read, share with a friend or family member, or convert to PDF. It should stand alone — no inline conversation context, every claim sourced.

See `references/packet-template.md` for the section structure and headings.

## Reference files

- `references/sources.md` — full source catalog with access notes
- `references/disambiguation.md` — protocol for verifying company identity
- `references/interview-prep.md` — role-specific prep frameworks
- `references/cowork-delegation-template.md` — prompt template for delegating authenticated source pulls
- `references/packet-template.md` — the output packet structure

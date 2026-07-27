# Disambiguation protocol

Skip this step and the entire packet becomes suspect. A surprising fraction of company names are shared across multiple entities — sometimes by accident (different industries), sometimes deliberately (one company renamed; the old listing persists).

## The verification protocol

Before pulling any review data, lock the canonical entity across at least **three of these dimensions**:

1. **Founders / CEO name** — most reliable. Cross-check against Crunchbase or LinkedIn.
2. **Year founded** — confirms generation. A 2019 startup is not the same as a 1985 enterprise vendor.
3. **HQ city** — `San Francisco, CA` vs. `Chandigarh, India` is a definitive split.
4. **Headcount range** — order-of-magnitude check. 50 employees vs. 5,000 is conclusive.
5. **Industry / product description** — Glassdoor's industry tag plus the company's own one-line description.

If you can confirm three, you're locked. Two is borderline — get a fourth before trusting downstream data.

## Common confusable patterns

### Same name, different entity
The most common trap. Generic names (`Hex`, `Cube`, `Mode`, `Linear`, `Notion`, `Square`, `Block`, `Stack`, `Vector`) get reused across industries. Always check industry + HQ before trusting reviews.

### Subsidiary vs. parent
`X Technologies`, `X Labs`, `X Software`, `X Group` are often parents or subsidiaries of the company the user actually means. Confirm against the careers page URL — that's canonical.

### Rebrands
A company may have rebranded (`Block` was `Square`, `X` was `Twitter`). Old Glassdoor IDs persist with old names. The most recent reviews on the old listing are usually the most accurate, since employees may not migrate.

### Duplicate listings (same company, two IDs)
Common when a company changes legal name, gets acquired, or someone files a duplicate. Symptoms: both listings claim the same HQ, similar founding year, identical industry. To confirm duplicates, check whether one of the listings is "claimed by employer" — usually only one is.

### Stock-ticker collisions
`X` as a ticker rarely overlaps with the company name you want. Ignore ticker-pages unless explicitly relevant.

## Glassdoor ID format

Every Glassdoor company page has a numeric ID encoded as `EXXXXXXX` in the URL. Capture this ID — every review URL, interview URL, and salary URL anchors on it.

URL patterns:
- Overview: `glassdoor.com/Overview/Working-at-[Company]-EI_IEXXXXXXX.0,N_KON,M.htm`
- Reviews: `glassdoor.com/Reviews/[Company]-Reviews-EXXXXXXX.htm`
- Interviews: `glassdoor.com/Interview/[Company]-Interview-Questions-EXXXXXXX.htm`
- Salaries: `glassdoor.com/Salary/[Company]-Salaries-EXXXXXXX.htm`

If the user already pulled a Glassdoor page that looked promising, extract the ID and verify it before reusing the URL.

## LinkedIn company ID

LinkedIn company pages have a numeric ID visible at `linkedin.com/company/[name]/about/` or in the page source. Capture it for two reasons:

1. People searches filtered by `currentCompany=[ID]` are exact; keyword filtering by company name is fuzzy and pulls noise from companies with similar names.
2. The ID is stable across rebrands.

## What to write in the packet

Add an explicit disambiguation note in the packet's introduction:

```
This packet is about [Company name] ([canonical entity description]).
Verified via: CEO [Name], founded [Year], HQ [City], ~[Headcount] employees.
Glassdoor ID: EXXXXXXX. LinkedIn ID: XXXXXXXXX.

Confusable companies you may see in searches but should disregard:
- [Other Company A] — [why it's different]
- [Other Company B] — [why it's different]
```

This makes the packet auditable by future readers (and by you, on revisit).

## If you can't disambiguate

Two failure modes:

1. **Too little info on the target company** — ask the user for the careers page URL. The careers URL is the single most reliable identity anchor (`careers.acme.com` or `acme.com/careers` confirms canonical entity).
2. **The user gave an ambiguous name and isn't sure which company they mean** — present a short multi-choice list of candidates with one-line descriptors, and ask them to confirm.

Do not proceed with research until disambiguation is locked. Wasted research costs more than the extra question.

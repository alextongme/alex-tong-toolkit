# The on-page standard

What a page must satisfy at the moment it is written, and what an existing page
is checked against. Every item is standard on-page practice, stated plainly.

**Three status values, and the distinction is the point:**

| Status | Meaning |
|---|---|
| `auto` | `seo.mjs` measures it from the server HTML. Report it as a fact |
| `keyword` | Cannot be checked without knowing which keyword this URL owns. Ask, or skip the item and say it was skipped |
| `manual` | A judgment call or a check the crawler does not make. Report as *not checked*, never as passing |

🔴 **Never report a `manual` item as a pass.** A skipped check reported as green
is the same failure as an unavailable source reported as a zero.

---

## 1. Title

| # | Item | Status |
|---|---|---|
| 1 | Title present and non-empty | `auto` |
| 2 | Title length recorded, as a **display note and not a defect** — see below | `auto` |
| 3 | Title unique across the site | `auto` (site-wide duplicate scan) |
| 4 | Primary keyword near the start | `keyword` |
| 5 | Reads as a human sentence, not a keyword list | `manual` |

> ⚠️ **On title length, because the 60-character rule is folklore.** Google has no character
> limit; it truncates a title to the width available on the reader's device, so sixty W's and
> sixty i's are not the same title. The character count is kept because it is a useful
> approximation and costs nothing, but it is reported as *this may truncate on a narrow screen*,
> never as a defect, and it is never the top finding in a report. A reference implementation in
> this field measures the real thing — glyph advances against a ~580px budget — which is the right
> answer for a product and more machinery than this check is worth.


## 2. Meta description

| # | Item | Status |
|---|---|---|
| 6 | Description present | `auto` |
| 7 | Length recorded, as a **display note and not a defect** — see below | `auto` |
| 8 | Unique across the site | `auto` |
| 9 | Contains the keyword, a benefit, and a soft call to action | `keyword` + `manual` |

> ⚠️ **And the 70–160 rule is the same folklore, so it gets the same treatment.** Google:
> *"There's no limit on how long a meta description can be, but the snippet is truncated in Google
> Search results as needed, typically to fit the device width."* Same mechanism as the title, same
> verdict — the count is a display estimate, never a defect, and never a finding on its own. Google
> also generates the snippet from page content most of the time, so a description outside the range
> may never be shown at all. Verified against Google's snippet documentation, 2026-09-20.

## 3. Headings

| # | Item | Status |
|---|---|---|
| 10 | `<h1>` count recorded — **a count, not a rule**, see below | `auto` |
| 11 | The `<h1>` is in the **server** HTML, not injected by client-side JavaScript | `auto` — this is the one that catches animated headlines |
| 12 | `<h1>` contains the primary keyword | `keyword` |
| 13 | `<h2>` presence recorded — a structure note, not a requirement | `auto` |
| 14 | Heading levels descend without skipping (no `<h2>` → `<h4>`) | `manual` |
| 15 | Headings describe sections rather than decorating them | `manual` |

> ⚠️ **There is no required number of headings, and this table used to imply one.** Google's own
> SEO Starter Guide lists it under the things not to focus on: *"There's no ideal number or order of
> headings required."* John Mueller has said a page can rank with one `<h1>`, many, or none. So the
> counts above are **recorded and reported as structure**, never as defects, and a page with two
> `<h1>`s is not a finding. Verified 2026-09-20.
>
> **Two rows in this section survive that, and they are the ones worth having.** Item 11 — is the
> heading in the *server* HTML — is a real finding, because a heading that only exists after
> JavaScript runs is invisible to an assistant's fetcher. And an `<h1>` that is present but **empty**
> is a real defect at any count. Item 14's descending order is an **accessibility** rule, which is a
> good reason to keep it; it is not a search one, and the report should not sell it as one.

## 4. Body content

| # | Item | Status |
|---|---|---|
| 16 | Word count recorded | `auto` |
| 17 | Word count recorded; under ~300 words on an indexable page is a flag to look at the page, **never a verdict** — Google: *"there's no magical word count target, minimum or maximum"* | `auto` |
| 18 | Primary keyword appears in the first 100 words | `keyword` |
| 19 | The question in the query is answered directly, near the top | `manual` |
| 20 | Length within ~20% of the top-3 average for the target query | `keyword` + live SERP |
| 21 | No duplicated blocks shared with another page on the site | `manual` |

## 5. URL and slug

| # | Item | Status |
|---|---|---|
| 22 | Slug is lowercase with hyphens | `manual` |
| 23 | Slug ≤ 60 characters | `manual` |
| 24 | Slug contains the keyword | `keyword` |
| 25 | No dates, IDs, or stop words padding the slug | `manual` |
| 26 | URL depth ≤ 3 segments where the structure allows | `manual` |

## 6. Canonical, indexing and crawl directives

| # | Item | Status |
|---|---|---|
| 27 | `<link rel="canonical">` present | `auto` |
| 28 | Canonical is self-referential, absolute, and matches the final URL after redirects | `manual` — the canonical is captured, the comparison is not made |
| 29 | `robots` meta tag read and reported | `auto` |
| 30 | `X-Robots-Tag` response header read and reported | `auto` — when it and the meta tag disagree, the **more restrictive** of the two applies |
| 31 | No accidental `noindex` on a page meant to rank | `auto` |
| 32 | Page returns 200 | `auto` — a **soft** 404 (200 with not-found content) is `manual` |
| 33 | No redirect chain longer than one hop | `auto` — every hop is recorded, not just the fact of a redirect |
| 34 | Google's chosen canonical matches yours | Search Console URL Inspection — needs setup |

> ⚠️ **The header does not outrank the meta tag, and this file used to say it did.** Google's rule
> is *"in the case of conflicting robots rules, the more restrictive rule applies"* — there is no
> precedence order between the header form and the tag form. In the common case the outcome is the
> same, which is why the error was invisible: a header `noindex` on a page whose meta tag says
> nothing does take the page out of the index. But it takes it out by being **more restrictive**,
> not by being the header — and read the other way round, the old wording gives the wrong answer,
> because a meta `noindex` is not rescued by an `index` in the header. Report the pair and the
> restrictive result, never a winner. Verified against Google's robots meta tag specification,
> 2026-09-20.

## 7. Document head

| # | Item | Status |
|---|---|---|
| 35 | `<html lang>` set | `auto` |
| 36 | `charset` declared | `manual` |
| 37 | Viewport meta present | `manual` — Lighthouse covers it in `capture` |
| 38 | Favicon present | `manual` |
| 39 | No duplicate title or description tags on one page | `manual` — duplicates *across* pages are `auto` |

## 8. Social cards

| # | Item | Status |
|---|---|---|
| 40 | `og:title` present | `auto` |
| 41 | `og:description` present | `auto` |
| 42 | `og:image` present | `auto` — whether it **fetches** is `manual` |
| 43 | `og:url` present | `auto` — the match against the canonical is `manual` |
| 44 | `og:type` set | `auto` |
| 45 | `twitter:card` set | `auto` |
| 46 | Card image is 1200×630 or larger | `manual` |

## 9. Internal linking

| # | Item | Status |
|---|---|---|
| 47 | Internal links out, in body content — **counted, with no target number** | `auto` (count) |
| 48 | Anchor text is descriptive, not "click here" | `manual` |
| 49 | **Inbound internal links exist from a real page, not only the sitemap** | `auto` — the doorway check, counted per URL from the link graph |
| 50 | The link runs both directions between the hub and the page | `manual` |
| 51 | No orphan pages in the sitemap | `auto` — zero inbound links from any other crawled page |
| 52 | No links to 404s or redirect chains | `manual` — links are collected, not followed |

## 10. External linking

| # | Item | Status |
|---|---|---|
| 53 | Outbound links to other hosts — **counted, with no target number** | `auto` (count) |
| 54 | External hosts listed in the report | `auto` |
| 55 | `rel="noopener"` on `target="_blank"` links | `manual` |
| 56 | No links to dead or parked domains | `manual` |

> ⚠️ **The "3–5 internal, 2–3 external" targets were invented, so they are gone.** No primary
> source states a number; Google's Starter Guide says only *"link when you need to"* and recommends
> no count in either direction. The counts stay because the **link graph** built from them is what
> powers items 49 and 51 — inbound internal links and orphan pages — and those two are the most
> valuable checks in this file. A page with two internal links out is not a finding. A page with
> **zero inbound** links still is. Verified 2026-09-20.

## 11. Structured data

| # | Item | Status |
|---|---|---|
| 57 | JSON-LD parses without error | `auto` |
| 58 | `@type`s present are listed | `auto` |
| 59 | The type **expected for this page kind** is present — `Article`, `Service`, `LocalBusiness`, `BreadcrumbList`, `Organization`, `Person` | `manual` |
| 60 | `Person` or `Organization` present on the site's identity pages | `auto` |
| 61 | `sameAs` captured verbatim and diffed between snapshots | `auto` |
| 62 | **The schema renders in the server HTML** — not inside an iframe or a third-party embed, where it is invisible | `auto` |
| 63 | Schema claims match what is visible on the page | `manual` |

> ⚠️ **What "renders in the server HTML" can and cannot conclude.** This crawler reads the HTML the
> server sends, which is the right thing to measure: it is what an assistant's fetcher sees, and it
> is how an empty `<h1>` behind a typewriter animation gets caught. It is **not** everything Google
> sees, because Google renders JavaScript and the major SEO plugins inject JSON-LD client-side.
> So the honest finding is **"not in the initial HTML"**, never "no schema" — a distinction that is
> the difference between a real finding and a confident falsehood on any WordPress site.


### Retired rich-result types — do not recommend these

**Verified against Google's own documentation, not inherited from another tool.**

| Type | Status |
|---|---|
| `HowTo` | Rich result **removed** 2023-09-14, desktop and mobile. Google removed its documentation |
| `FAQPage` | Restricted to *"well-known, authoritative government and health websites"* on 2023-09-14, then the rich result was **removed entirely** and its documentation deleted on 2026-06-15 |
| `Dataset` | ✅ **Still supported** — powers Dataset Search, documentation current as of 2026-09-08 |

Two things follow, and the second one matters more:

1. **Never list `FAQPage` or `HowTo` as a page's missing schema.** Adding them earns no
   rich result. They remain valid schema.org vocabulary and carry no penalty, so a page that
   already has them does not need them stripped — but they are not a finding, and recommending
   them is recommending work with no outcome.
2. **This was checked rather than copied.** A competitor's crawler carries a hard-coded retired-type
   set that includes `Dataset`, and `Dataset` is not retired. Their set is a reasonable shortcut
   inside their own tool and a bad fact to inherit. Consuming another tool's judgment uncritically
   is how a wrong constant travels.


## `llms.txt` — the one check this plugin declines to make

**Two credible sources disagree, so this is an adjudication rather than a rule inherited from
either of them.**

- **For:** Anthropic's own published SEO skill treats a missing `llms.txt` as a standard audit
  finding, while hedging that it is *"a young convention, not a mandated standard."*
- **Against:** the web-quality skills refuse it as a default — *"an experimental proposal, not a
  cross-vendor discovery standard… never treat it as a ranking or citation factor. Add one only
  when the user requests it or a documented consumer supports it; do not recommend it ahead of
  crawlability, semantic HTML, accurate metadata, and useful content."*
- **And it has since been settled by the one party that could settle it.** Google documents that
  `llms.txt` neither helps nor hurts Search; Gary Illyes has said Google does not support it and is
  not planning to, and drew the comparison himself — *"it's very easy to draw a parallel between
  1990's keywords meta tag and llms.txt… we all know how useful the keywords meta tag became, very
  fast."* Against that sits one piece of real counter-evidence: server logs showing OpenAI fetching
  the file on some sites. **A crawler fetching a file is not an assistant retrieving from it**, and
  closing that gap is exactly what the flip condition below asks for. Verified 2026-09-20.

**This plugin takes the second position, and reports it as a decline rather than omitting it.**
The file costs ten minutes and harms nothing, so the honest verdict is not *"don't"* — it is
**"there is no consumer of it we can name, so this is not a finding, and here is what would change
that."** Three reasons, in the order they matter:

1. **No named consumer.** A check earns its place by naming who reads the thing. Google has now
   explicitly said it is not one, and nobody has produced a documented, verifiable consumer in
   search or in an assistant's retrieval path. Until someone does, recommending it is recommending
   faith.
2. **It competes for the one action.** Every audit here ends with *one thing to do this week*. A
   ten-minute task with no named consumer that displaces a crawlable H1 or a reachable page has
   cost the owner real ground.
3. **It is the shape of finding this plugin exists to refuse.** Easy, satisfying, ticks a box,
   moves nothing measurable. The same argument retired `FAQPage` above.

**What would flip it**, stated so the decline can be revisited on evidence rather than mood: a
major assistant documenting that it reads `llms.txt`, or field evidence that a site's content
reached an assistant through one. If the owner asks for the file, write it — it is their site, and
the ask is reasonable. Just never bill it as a visibility win.


## 12. Images

| # | Item | Status |
|---|---|---|
| 64 | Every image has an `alt` attribute | `auto` |
| 65 | `alt` text is descriptive, not the filename | `manual` |
| 66 | Descriptive filenames | `manual` |
| 67 | Modern format (WebP / AVIF) where supported | `manual` |
| 68 | Under ~200 KB each | `manual` |
| 69 | `width` and `height` set, so layout does not shift | `manual` |
| 70 | Below-the-fold images lazy-loaded | `manual` |
| 70a | **The `Person` schema `image` is rendered on the page that declares it** — `summary.entityImagesNotShown` | `auto` |

## 13. Authorship and trust

| # | Item | Status |
|---|---|---|
| 71 | Named author, not "admin" or the brand alone | `manual` |
| 72 | Author credentials stated, and an author page exists | `manual` |
| 73 | Published date and last-updated date both present | `manual` |
| 74 | First-hand evidence on the page: a number, a screenshot, an outcome | `manual` |
| 75 | Claims that need a source have one | `manual` |

## 14. Accessibility and delivery

| # | Item | Status |
|---|---|---|
| 76 | Semantic HTML5 landmarks | Lighthouse, via `capture` |
| 77 | Contrast meets AA | Lighthouse |
| 78 | Visible focus states | Lighthouse |
| 79 | Skip link to main content | `manual` |
| 80 | Touch targets ≥ 44px | Lighthouse |
| 81 | Body text ≥ 16px | `manual` |
| 82 | Core Web Vitals captured for mobile and desktop | `auto` (PageSpeed) |

## 15. Page-kind extras

**Long-form (1,500+ words)**

| # | Item | Status |
|---|---|---|
| 83 | Table of contents with jump links | `manual` |
| 84 | Back-to-top control | `manual` |

**Service or local pages**

| # | Item | Status |
|---|---|---|
| 85 | Call to action above the fold | `manual` |
| 86 | Click-to-call on mobile | `manual` |
| 87 | Trust signals: reviews, credentials, guarantees | `manual` |
| 88 | Hours and service area stated in text, not only in an image | `manual` |
| 89 | `LocalBusiness` schema with `sameAs` | `auto` (presence) |

---

## The pattern in the statuses

Almost every non-`auto` item is one of two things: a cheap parser addition, or a
**keyword → URL map that does not exist yet**. The second is the real finding.
Until each URL has a declared keyword, items 4, 12, 18, 20 and 24 cannot be
checked at all — and those are the items that decide whether the page ranks for
the thing it was written for.

## And the check that outranks the whole table

Every item above can pass on a page that should never have been written. Four
pages once passed all of it and pulled 3 clicks from 174 impressions, because the
lane they targeted had 120 searches a month in it.

**Run the demand and doorway checks before the health checks matter:** is there
demand for this query, is the page linked from a real page both ways, and does
the query sit behind something the owner actually sells?

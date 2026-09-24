# SEO Audit

**Version 1.3.0** · two Claude Code skills · no account required · MIT

Audits what search engines and AI assistants can actually see on your site, then
freezes a dated snapshot so the same command in 30 days produces a real
before/after instead of a feeling.

The first run needs no credentials, no account and no API key. It reports which
AI crawlers are allowed in, crawls every URL in your sitemap, checks your entity
graph, reconciles the sitemap against what is live, and captures the baseline.
Connecting Search Console later adds index state, Google's chosen canonical per
URL, and query history — it is an upgrade, not a prerequisite.

**No code project required.** Squarespace, Wix, Shopify, hosted WordPress,
anything: every check is an HTTP request to your public site, which is the same
surface Google and the assistants get. If you have no repository to open, the
config and your snapshots live in `~/seo-audits/<your-site>/` and every command
finds them from anywhere.

Questions and the changelog live in [The AI Kitchen](https://alextong.me/kitchen).

Would rather I run it? I send a free SEO & AI visibility report for your site.
It includes the part this plugin leaves to you: asking ChatGPT, Perplexity and
Google's AI answers who they name for your kind of business, with every answer
recorded. [alextong.me/services/ai-visibility](https://alextong.me/services/ai-visibility?utm_source=github&utm_medium=bio&utm_campaign=evergreen&utm_content=post-body).

## Install

Inside Claude Code:

```
/plugin marketplace add alextongme/alex-tong-toolkit
/plugin install seo-audit@alex-tong-toolkit
```

Adding the marketplace installs nothing on its own — each plugin is installed
separately, and updates arrive with `/plugin update seo-audit@alex-tong-toolkit`.

Requires Node 18 or newer, already present if you run any modern JS tooling. The
script has zero dependencies and never touches your lockfile.

## Use it

Open Claude Code anywhere — in your site's repo if it has one, or in any folder
if it does not — then:

| Command | What you get |
|---|---|
| `/seo-audit` | The full audit: AI-crawler access, instrument check, on-page crawl, entity graph, sitemap reconciliation, and a dated baseline |
| `/seo-audit quick` | The same checks without the baseline prompt or the owner questions |
| `/seo-audit compare baseline t1` | A like-for-like diff of two snapshots |
| `/seo-setup` | Connect Search Console, PageSpeed and Bing, and prove each key actually works |

Plain language works too — "audit my site's SEO", "can ChatGPT see my site?",
"why isn't my name showing up on Google?"

The script can also be run directly, without Claude:

```bash
node seo.mjs init --site https://example.com    # or bare, inside your site's repo
node seo.mjs robots --site https://example.com
node seo.mjs canary
node seo.mjs capture --label baseline
node seo.mjs compare baseline t1
```

## What comes back

A crawler-access table that names the claim, not just the bot:

```
  GPTBot               allowed        (OpenAI — training)
  OAI-SearchBot        blocked        (OpenAI — search index)

  yes   Is this site in OpenAI's training corpus?      (GPTBot)
  no    Can ChatGPT cite this site in Search?          (OAI-SearchBot)
```

Those are different bots and different questions. Blocking the training crawler
says nothing about whether ChatGPT Search can cite you, and most write-ups
collapse the two.

Then an instrument check, which runs before any result is believed:

```
  PASS  crawler          parse https://example.com/
  PASS  sitemap          discover a sitemap for https://yoursite.com
        27 page urls from https://yoursite.com/sitemap_index.xml
        (robots.txt Sitemap:, a sitemap index; 3 child sitemap(s) read)
  n/a   search-console   not connected
  UNKN  bing             0 rows
```

`n/a` and `UNKN` are not zeros. A source that cannot answer is reported as a gap
in coverage, never as "nothing found" — that distinction exists because a
silently broken tool and an empty world look identical from inside one query.

Then the findings, ranked, each with the URL and the value that failed the
check; what could not be checked and why; and **one action for this week**.

## What it refuses to do

- **It never promises a ranking position.** Nobody can. It reports what is true
  now and what changed since the last snapshot.
- **It never writes your page content.** A content finding comes back as a brief
  with the research filled in and one field deliberately blank: the angle only
  you have. And "the demand is real, don't write this" is a legitimate result.
- **It never edits your project.** The audit skill has `Edit` removed from its
  tool pool. The only files it creates are inside the snapshot folder.
- **It never drives a browser on a third-party platform.** Profile edits,
  backlink outreach and index requests come back as numbered click-paths.
- **It never prints a credential.** Keys live in your keychain, are read by the
  script, and are reported only as works / does not work.
- **It never promises an AI recommendation.** It improves how accurately your
  site can be read, understood and quoted. Nobody can make an assistant
  recommend a business, and anyone selling that is selling nothing.
- **It never fetches a private address.** Every URL, including every redirect
  hop, is checked before the request: non-HTTP schemes, loopback, private
  ranges, link-local and cloud-metadata endpoints are refused with a reason.
  A sitemap is a list somebody else wrote, and on a client's site that somebody
  is not you.

## Every outbound request this plugin makes

Nothing here phones home. There is no telemetry, no analytics and no upload.
Every request goes to your own site or to an API you configured with your own
credentials:

| Host | When | Why |
|---|---|---|
| **Your site** (from `seo.config.json`) | `robots`, `onpage`, `capture` | `robots.txt`, the sitemap it declares (or `/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml`), any child sitemaps, and one GET per page URL |
| `www.googleapis.com` | `capture`, `canary` | PageSpeed Insights. Works unauthenticated; your own API key removes the rate limit |
| `oauth2.googleapis.com` | `capture`, `doctor` | Exchanges your Search Console service-account key for an access token |
| `searchconsole.googleapis.com` | `capture`, `doctor` | URL Inspection, read-only |
| `ssl.bing.com` | `capture`, `doctor` | Bing Webmaster API, only if you configured a key |
| `www.example.com` / `example.com` | `canary` | Known-answer control for the HTML parser and PageSpeed |
| `www.google.com/robots.txt` | `canary` | Known-answer control for the robots parser |

Search Console and Bing are skipped entirely when you have not configured them.

## Where your data goes

Nowhere. Snapshots are written to `seo-snapshots/` beside your config, `chmod 600`,
because a snapshot contains your Search Console query data — that is your
private data even though your site is public. Add `seo-snapshots/` to
`.gitignore` if you would rather not commit it.

## Setup, honestly

Search Console cannot be scripted. It is a Google Cloud project, a service
account, a JSON key, and an `Owner` grant per property — about ten minutes of
clicking, once. `/seo-setup` walks you through it and then **exercises every
key**, because a key that exists and a key that works are different facts.

Two things that catch people, and neither error message says so:

- Use a **service account**, not the OAuth desktop flow. A project whose OAuth
  consent screen is still in "Testing" is issued a refresh token that expires in
  7 days, and the next capture fails quietly. A service account has no consent
  screen and cannot hit that rule.
- Search Console permission must be **Owner**, not Full. URL Inspection refuses
  anything less.
- **Search Console is not retroactive.** It starts collecting the day the
  property is verified. Up to 16 months of query history is what an
  *already verified* property gives you; verifying one today starts at zero and
  takes about two days to show its first rows.

## Troubleshooting

- **"No site."** Run `node seo.mjs init`, or pass `--site https://example.com`.
  `init` reads `package.json`, `next-sitemap.config.js`, `astro.config.mjs` and
  `public/CNAME` before giving up.
- **Coverage came back `insufficient`.** Under 60% of your sitemap URLs were
  fetched, so no summary verdict is given at all. The failing URLs are listed in
  the snapshot; usually it is rate limiting or a sitemap pointing at dead paths.
- **A source says `UNKN`.** It answered, but not with something only a working
  source could return. Treat it as unavailable and check the credential with
  `/seo-setup`.
- **`compare` says a snapshot is missing sources.** Expected when the two
  snapshots were taken with different credentials connected. The diff still
  runs, and the header names what is missing from which side.

## Versions

- **1.3.0**: `--max-pages` samples across the site instead of taking the first N
  URLs in sitemap order, which on a sectioned site was the first section and nothing
  else (on a large sectioned site, 2026-09-24, the first 2,000 never reached four
  of its five sections). URLs are grouped by first path segment, each group gets a share, and
  picks are hash-ordered so a re-run fetches the same pages; `sitemap.strata`
  records the split. On a sample, orphans and inbound links are `null` instead of
  false zeros, `linkedNotInSitemap` checks against the whole sitemap, and `compare`
  diffs only pages both samples hold, with no false "page gone".
- **1.2.1**: Three fixes found on a site too large to crawl. `--max-pages 2000` was refused
  because the number typed equalled the ceiling; any explicit value is now a sample.
  A `capture` whose crawl fails now ends on a red "Snapshot INCOMPLETE", exits 1
  and writes `complete: false` to the manifest, where it used to print a green
  "Snapshot written" over a folder with no `onpage.json`. Bing's endpoint count is
  read from the response (five, since `feeds` was added) instead of a hard-coded
  four, so all five refusing reads "unavailable", not "partial, -1/4".
- **1.2.0** — The snapshot now reads what each page says about itself:
  `datePublished`, `dateModified` and `author` per page, from the page's own
  JSON-LD with `article:published_time` as the fallback. Four new summary
  fields follow from that and from the link graph: `authorEntities` (every
  declared author with its schema type and page count, so a `Person` that is
  really a brand or an agency account is visible), `publishedByYear`,
  `linkedNotInSitemap` (pages the site links to that the sitemap omits, the
  inverse of an orphan) and `sitemapRedirects` (sitemap URLs that 301). The
  orphan list is de-duplicated when a sitemap URL redirects to another sitemap
  URL. Items 51a, 51b, 71 and 73 in `references/checks.md` are now `auto`.
- **1.1.0** — Retired five pieces of SEO folklore the plugin was repeating:
  title and description lengths are display notes, heading and link counts
  are structure, none of them a defect on its own.
- **1.0.0** — First release. Sitemap discovery that reads the `Sitemap:` line
  out of `robots.txt`, falls back to the common CMS paths, and follows a
  sitemap index instead of reporting its child sitemaps as pages. Per-URL regression rules in `compare`, an
  inbound-link graph behind the orphan check, four-valued fetch classing so a
  bot challenge cannot read as a broken page, response-header checks including
  `X-Robots-Tag`, and a URL guard on every request. `init`, `robots`, `canary`, `onpage`, `capture`,
  `compare`, `list` and `doctor`; the `seo-audit` and `seo-setup` skills; the
  on-page standard, the owner questions, the trap list and the AI-assistant
  protocol under `references/`.

Found a bug, or a finding you disagree with? Post it in
[The AI Kitchen](https://alextong.me/kitchen). If it saved you time, a star on
this repo tells me which skills to make more of.

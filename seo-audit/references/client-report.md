# The owner's version of the report

`audit-report.md` is written for whoever runs this skill: file paths, schema
types, JSON field names, coverage grades. That is the right report for the person
fixing the site and the wrong one for the person who owns it. An owner who can't
read the report can't decide anything from it, and a report nobody decides from
was a report for nobody.

So on client work, the audit ships as two documents. The technical report stays
the evidence: every number in the owner's version traces back to it, and it is
where a later session checks what was measured. The owner's version is the one
that gets sent.

## The rule that decides every sentence

**If the owner would have to ask what a word means, the word is wrong.** Explain
each term the first time it appears, in the sentence where it appears, or replace
it. Some replacements that have held up:

- impressions: "times Google showed you"
- clicks: "visits from Google"
- the map pack or local pack: "the map box, the box with a map and three businesses at the top of Google"
- structured data, schema, JSON-LD: "a hidden label that search engines and AI assistants read"
- `sameAs`: "the links that tell Google your profiles are all one business"
- indexed, not indexed: "Google lists it", "Google has never read it"
- crawl: "read"
- meta description: "the one-line summary Google shows under a link"
- SERP: "the results page"
- canonical, hreflang, H1: leave them out of the owner's version, or say what they do in one clause

Numbers are written as a count out of something ("named you in 7 of 12 answers",
"Google lists 30 of your 80 posts"), never as a bare percentage with no base. No file
paths, no field names, no tool names the owner has never heard of.

## The shape

Eight sections, in this order. Cut a section rather than pad it.

1. **The short version.** The good news, the bad news, the five things worth
   fixing (never more), what was already fixed, what you recommend, what happens
   next. An owner who reads only this section should be able to decide.
2. **How people find you today.** One subsection per door: search, AI assistants,
   directories. What was measured and what it showed.
3. **What's already working.** Including what not to pay anyone for. Owners get
   sold work that is already done; saying so is part of the value.
4. **The five things worth fixing.** One subsection each: what is wrong, the
   evidence in plain numbers, the fix in one or two sentences.
5. **Who's ahead, and why.** Competitors in one short table: where they beat the
   owner, how, and whether it is worth copying. Usually the answer is "no, and
   here's why".
6. **What I recommend.** The roadmap, **in the order you would do it**, with hours
   and price per item, then a "nice to have" list and a "don't do" list with the
   reason for each. End with "if you only do one, do this".
7. **What I changed, and how to undo it.** Every change made during the
   engagement, in plain words, with how it reverses.
8. **What happens next.** The re-measure date and the two honest cautions from
   `traps.md`: the season, and the chance band. Then what you need from the owner
   before that date.

## Gates

- **Offer it, don't assume it.** After the technical report on a full job, ask
  whether the owner needs their own version. Recommended answer: yes for any
  client, no for your own site.
- **The operator sets the prices.** Rate, any discount, and anything included
  free are the operator's call. Leave a visible placeholder until they answer;
  never invent a rate.
- **Open questions never block delivery.** Anything the owner hasn't answered
  goes in as a conditional ("if the new booking page goes live, then..."), and the
  report ships on its date.
- **Health, legal and money pages:** the owner writes the words. The roadmap says
  so for every such item, because it changes the calendar more than the hours.

## Format

Send it in whatever the operator's clients already receive, so it looks like it
came from the same person as the proposal. Markdown is the source of the wording;
the rendered document is only the rendering. Change the words in the source,
then re-render.

## What it must never do

Everything in the skill's "never" list still applies, and three more things
matter most here: never promise a position or an assistant recommendation, never
present a number inside the chance band as a result, and never let a plain word
say something the evidence doesn't. Simpler is not looser.

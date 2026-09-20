# The AI-assistant protocol — four assistants, eight prompts

Manual, on purpose. This is the one part of the audit a script should not do in
v1: driving a logged-in assistant UI is exactly the automation that gets accounts
flagged, and the APIs answer a different question than the products do.

**Why per-engine, and why it cannot be collapsed into one score:** citations
barely overlap between engines, so "are we visible in AI search" is four
questions, not one. Answering it with a single number is the mistake this
protocol exists to avoid. The measured figures, from the GEO survey at
[arXiv 2607.14035](https://arxiv.org/html/2607.14035v1) §8.1:

| Finding | Number |
|---|---|
| Domains cited by **both** Bing Chat and Perplexity, across 1,008 responses | **26%** (Li and Sinnamon, 2024) |
| Domains cited by Google AI Overviews that **do not appear in the organic top 10** | **53%** (Kirsten et al., 2026) |
| … absent from the top **100** | **27%** |
| URL-level Jaccard similarity among Google organic, AIO and Gemini, over 11,500 queries | **0.11–0.18** (Grossman et al., 2026) |

The survey's own conclusion: *"These results refute the notion of a global GEO
ranking. Visibility is indexed by engine and surface. A site visible in the
conventional SERP may be absent from AIO; a domain cited by Perplexity may never
appear in ChatGPT."*

🔴 **The overlap is low, not zero, and this file used to say zero.** The previous
wording — *"the same query returns largely non-overlapping citations"* — was
inherited from a synthesis blog with an anonymous byline, no linked sources, and
a hedge (*"may produce"*) that got dropped on the way in. A quarter of domains
being shared is a strong argument for testing four engines separately; *no*
overlap would have been a different and false claim. **Report the number, not the
adjective** — the protocol is easier to defend with it. Verified against the
primary source, 2026-09-20.

**Why manual beats an API here:** the API and the product are different systems.
The product has its own retrieval layer, its own index, and its own recency
window. What an API returns is not what a user sees, and what a user sees is the
thing being measured.

## Setup, and it decides whether the run is worth anything

1. **Log out, or use a private window.** A logged-in session carries memory,
   history and personalisation. You will see yourself more often than a stranger
   would. This single step is the difference between a measurement and a mirror.
2. **One fresh conversation per prompt.** Answers within a thread condition each
   other; the second answer is about the first.
3. **Do not lead.** Never name the site in a prompt that is meant to discover it.
   The prompt that names the site measures something else, and it has its own
   slot below.
4. **Same wording every run.** The 30-day and 90-day repeats only mean something
   if the prompt is byte-identical.
5. **Record the date and the model version.** These products ship weekly; a
   change in the answer can be a change in the model.

## The four

| Assistant | Why it is in the set |
|---|---|
| **ChatGPT** (Search on) | Largest reach; its index is `OAI-SearchBot`, which is a different bot from the one people block |
| **Claude** | Different retrieval, different citation behaviour |
| **Perplexity** | Citation-first by design, so it shows *which source* won, not just the answer |
| **Google AI Overviews** | Sits above the organic results the rest of the audit measures, and is the one most likely to absorb the click |

Substitute a fifth only if the owner's audience actually uses it. Four
comparable runs beat six half-run ones.

## The eight prompts

Fill the bracketed slots from the owner's answers to the must-ask questions. The
order matters: discovery prompts run before any prompt that names the site, so
an earlier answer cannot prime a later one.

| # | Prompt | What it measures |
|---|---|---|
| 1 | `Who is [full name]?` | Entity resolution. Does the assistant know the person exists, and is it the right one? |
| 2 | `What does [full name] do, and where can I find their work?` | Whether the owner's own domain is the cited source, or a third-party profile is |
| 3 | `Who should I hire for [the service], in [the area]?` | Unprompted recommendation. The one that maps to revenue |
| 4 | `What are the best [category] options right now?` | Category presence with no name and no location |
| 5 | `[The exact query the owner said they want to win]` | The stated goal, measured directly |
| 6 | `Compare [owner or site] with [named competitor]` | Whether the assistant has enough material to represent them fairly |
| 7 | `What does [site domain] offer?` | Reading comprehension of the site itself — this is where an unrenderable schema or an empty server-side H1 shows up |
| 8 | `Is [a specific claim from the site] accurate?` | Whether the assistant can verify the claim, and which source it verifies against |

Prompts 1–5 are discovery and must run first. 6–8 name the subject and are run
last, in that order.

## What to log

One row per assistant per prompt, in `ai-visibility-<date>.md` beside the
snapshot folder:

| Field | Note |
|---|---|
| Date and assistant | Plus the model version if it is shown |
| Prompt number | From the table above |
| Mentioned? | yes / no — was the owner named at all |
| Position | Where in the answer, roughly: first, in a list, or a footnote |
| Cited? | Was the owner's own domain linked, or only mentioned |
| Sources cited | Every domain in the answer, in order |
| Competitors named | Everyone else who appeared |
| Verbatim claim | Any factual statement made about the owner, quoted |

**The last two rows are the ones worth the exercise.** The domains that get cited
for the owner's own category is a competitor list built from evidence rather than
from memory, and it is usually not the list the owner would have named. And a
wrong verbatim claim about the owner is the highest-value finding in this whole
plugin: it is public, it is being repeated, and it is fixable by changing what
the site says.

## Reading the result

- **Mentioned but not cited** means the model knows the entity from training and
  is not retrieving the site. That is an entity-layer result, not a content
  problem.
- **Cited from a third-party profile** means the profile outranks the owner's own
  domain as a source. Fixing the site will not change it; fixing `sameAs` and the
  profile itself might.
- **Absent from all four** on prompts 3 and 4, while present on 1 and 2, means
  the site is known as a *person* and unknown as a *provider*.
- **Present in one engine and absent in three** is the normal case, and it is the
  reason for running four.

## The honest limits

- It is a sample of four answers on one day, not a metric. Report it as a
  transcript with dates, never as a score out of ten.
- These systems are non-deterministic. A changed answer at 30 days is evidence
  only if the direction is consistent across several prompts.
- Nothing here proves causation. The audit's on-page changes and a changed AI
  answer are two observations; the honest claim names both and connects neither.

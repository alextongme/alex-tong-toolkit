# The seven questions only the owner can answer

An audit can find what is on the page. It cannot find what the page was supposed
to be for. These seven are the gap, and an audit that skips them produces
confident nonsense — a correct report about the wrong goal.

**How to ask them.** One at a time, each with a recommended answer already filled
in, and only when the next step needs it. Never open with all seven: the first
turn produces a real report from public HTML, and questions come after the owner
has seen it work. If the repo, the site, or an earlier answer can settle a
question, go read it instead of asking.

**When there are a lot of them to collect at once** — a full engagement rather
than a spike — write `seo-answers.md` into the project with every question, a
blank, and a recommended default pre-filled. The owner edits the file, you read
it back. Local, versionable, survives sessions, and nothing leaves the machine.
Never a hosted form.

---

### 1. List every public profile you own

Exact URLs, no share or tracking parameters.

**Why it decides something:** this is the `sameAs` graph, and it is the single
lever most personal sites and small-business sites have never pulled. Google's
question for a name query is not "is this page relevant" but "does this domain
belong to this entity," and `sameAs` is how the answer is asserted. One site
listed eight profiles and was missing three real ones; another had
`LocalBusiness` schema with no `sameAs` at all.

**Recommended default:** every profile the audit already found linked from the
site, plus the obvious absences for their field. Read the footer and the contact
page before asking.

**Owners forget the accounts they do not think of as profiles.** Ask about the
channels their post scheduler publishes to (Buffer, Later, Hootsuite) and any
dormant syndication accounts (dev.to, Hashnode, Medium). On alextong.me on
2026-09-22, those turned up three more real profiles the owner had not listed,
two of them from Buffer's channel list.

### 2. Is there anyone else with your name or brand, and where do they outrank you?

**Why it decides something:** it changes the target from "rank for my name" to
"outrank a specific page," which is a measurable goal with a known competitor
instead of a vibe. It also tells you whether the name query is even winnable
inside 90 days.

**Recommended default:** whoever currently occupies the first page for the name.
Have them check on their own machine — search results are personalised, and the
owner's own logged-in view is not the one a stranger sees.

### 3. Which identities should stay unlinked?

**Why it decides something:** this is the one question where the wrong default
does real damage. Some accounts are deliberately separate — an alias, a side
project, a former business, anything under a different name. `sameAs` is an
assertion that these are the same entity, and it is published, crawled, and hard
to retract.

**Recommended default:** none, and confirm it explicitly. Never infer that a
profile should be linked just because you found it.

### 4. What did the site used to be?

Old platform, old URLs, and roughly when it moved.

**Why it decides something:** inherited authority. Old URLs that still hold links
and still 404 are the cheapest win available, and they are invisible to a crawl
of the current site — the current sitemap does not know those paths ever
existed. Search Console's 404 report and the old platform's URL pattern are how
you find them.

**Recommended default:** check for a platform migration in the last two years.
If there was one, ask for the old URL shape, not a list.

### 5. What query do you actually want to win, and what would a win look like?

**Why it decides something:** it is the input every keyword-dependent check needs
and the audit cannot derive. "Keyword near the start of the title", "keyword in
the first 100 words", "one H1 containing the primary keyword" — none of those can
be checked without knowing the keyword for that URL.

The second half of the question matters as much as the first. *A win* might be
position 1 for a name, or three qualified enquiries a month, or being cited by an
AI assistant. These need different work and one of them is not a ranking goal at
all.

**Recommended default:** their own name for a personal site; the service plus the
city for a local business. Propose it and let them correct it.

### 6. Service area and real competitors

For a business rather than a person.

**Why it decides something:** it scopes local schema, it decides whether a query
should be measured nationally or locally, and the competitor list the owner names
is almost never the list that actually recurs in their SERPs. Both lists are
useful, and the disagreement between them is usually the most interesting finding
in the audit.

**Recommended default:** the area their existing customers come from, not the
area they would like to serve.

### 7. What can't be automated here?

Which platforms are click-path only, and who holds the logins.

**Why it decides something:** it sets expectations before any plan exists.
Profile edits, backlink outreach, review responses, and "request indexing" are
all owner actions. This plugin never drives a third-party platform in a browser —
it writes a numbered click-path and the owner clicks. Knowing up front which
steps land in that bucket stops a plan that quietly assumes access nobody has.

**Recommended default:** assume every third-party platform is click-path only
unless the owner says otherwise.

---

## What to do with the answers

Write them into `seo-answers.md` next to the snapshot folder, dated. They are
inputs to every future run: the 30-day re-measure reads them back to ask *what
did we say we would do, and did it happen?* An answer that lives only in a chat
window is an answer that gets asked for again in three weeks.

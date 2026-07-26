# Source catalog

Sources to consult for company research, grouped by what each is best for. Auth status as of 2026.

## Tier 1 — high-signal, usually accessible

### Company careers page
- **Best for:** Values, perks, hybrid policy, open roles, comp bands (when posted), team-org clues.
- **Access:** Public.
- **Tactical:** Read every open role, not just the target one. The phrases a company repeats across roles ("ship fast", "deep discovery", "raise the bar") tell you what they actually test for.

### Crunchbase / Contrary Research / company press
- **Best for:** Funding stage, headcount, investor signal, recent strategic moves.
- **Access:** Mostly public; Crunchbase Pro is gated but the free overview usually has enough.

### CEO / exec LinkedIn + Twitter/X
- **Best for:** Tone, leadership style, recent priorities, hiring posts.
- **Access:** Public posts visible without login; full timelines may require auth.
- **Tactical:** Search for the CEO's posts about the company's culture — they often broadcast what they think the bar is.

### Hacker News
- **Best for:** Candid technical opinions, unfiltered launch reactions, "Who's hiring" threads.
- **Access:** Public.
- **Query:** `site:news.ycombinator.com [company name]`. Sort by date; recent threads are most useful.

### Engineering / product blog
- **Best for:** Technical depth signal, what they ship, public personality of the team.
- **Access:** Public.

### Podcasts featuring the CEO or founders
- **Best for:** First-person leadership style, the founder's worldview, recent strategic shifts.
- **Access:** Public.
- **Tactical:** Search YouTube and podcast directories. Transcripts often surface via search.

## Tier 2 — gated review sites (require auth)

### Glassdoor
- **Best for:** Employee reviews (culture, WLB, comp), interview reports with verbatim candidate write-ups, CEO approval, salary submissions.
- **Access:** Requires login. WebFetch often returns 403 — use Cowork or the user's logged-in browser session.
- **Key URLs:**
  - Reviews: `glassdoor.com/Reviews/[Company]-Reviews-EXXXXXXX.htm`
  - Interviews: `glassdoor.com/Interview/[Company]-Interview-Questions-EXXXXXXX.htm`
  - Filtered to role: `glassdoor.com/Interview/[Company]-[Role]-Interview-Questions-EI_IEXXXXXXX.0,N_KON,M.htm`
- **Disambiguation gotcha:** A single company name can have multiple Glassdoor IDs. Always capture the ID and verify against industry, founded year, HQ.

### Blind
- **Best for:** Anonymous candid posts from current/former employees, especially senior IC chatter. Comp negotiations. Layoff rumors before they're public.
- **Access:** Login required (verified by work email).
- **Tactical:** Search the company channel for `interview`, `PM`, `comp`, `layoffs`, `manager`. Also check broader channels (Tech Industry, Product, Compensation) for cross-company mentions.

### LinkedIn
- **Best for:** Current/former employee headcount and tenure, hiring manager identification, first-person interview writeups, company press, exec backgrounds.
- **Access:** Login required for full search.
- **Tactical:**
  - People search filtered by Current Company + keyword = current team
  - Same filter on Past Company = retention signal
  - Content search for `[company] interview`, `joined [company]`, `interviewing at [company]`
  - The "What they do" facet on the company page surfaces function-level headcount (Sales, Product, Eng)

### Levels.fyi
- **Best for:** Compensation data points with level/tenure/equity context. Sometimes interview notes.
- **Access:** Mostly public; some data behind login.

## Tier 3 — supplemental

### Comparably
- **Best for:** Culture dimension scores (Compensation, Leadership, Diversity, Manager Quality) — sometimes higher N than Glassdoor.
- **Access:** Public with some gating.

### RepVue
- **Best for:** Sales-team culture specifically. If the company has a strong sales motion, RepVue often has data Glassdoor doesn't.
- **Access:** Mostly public.

### Indeed reviews
- **Best for:** Higher review volume than Glassdoor for larger or older companies. Sometimes contradicts Glassdoor — worth checking.
- **Access:** Public.

### Layoffs.fyi
- **Best for:** Tracked layoffs with dates and headcount cuts. Single source of truth.
- **Access:** Public.

### Built In
- **Best for:** Cross-references on perks, tech stack, sometimes comp. Listings can be stale.
- **Access:** Public.

### Reddit
- **Best for:** Candid industry / role chatter; sometimes specific subreddits (`/r/cscareerquestions`, `/r/ProductManagement`) have company-specific threads.
- **Access:** Public, but Google's `site:reddit.com` filter often returns nothing. Use Reddit's own search bar via WebFetch.

### GitHub
- **Best for:** Engineering culture signal (PR comments, issue tone, response times). Only useful if the company has meaningful open-source presence.
- **Access:** Public.

### YouTube (CEO interviews, conference talks, demo videos)
- **Best for:** Founder's voice and energy. Conference talks reveal what they brag about.
- **Access:** Public.

## When sources contradict

Believe the highest-N, most-recent source. But also: contradictions themselves are signal. If Glassdoor says 3.0 WLB and Blind says 4.5, capture both — the divergence is informative.

Single-N findings (one Blind review, one harsh Glassdoor quote) belong in the packet *with the sample size disclosed*. Readers can discount them; you shouldn't pre-discount for them.

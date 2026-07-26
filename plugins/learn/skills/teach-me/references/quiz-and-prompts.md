# Quiz mechanics, depth control, and prompt language

Read this before composing any quiz or depth-adjusted explanation. Don't improvise the mechanics — the details below are what make the check measure real understanding instead of fluency.

## AskUserQuestion: how to quiz

Reserve `AskUserQuestion` for **discrete multiple-choice checks**. Keep open-ended "restate / predict it" turns in plain chat.

Rules:

- **One concept per question.** 2–4 options. You may batch up to 4 questions in a single call when they're related — but then reveal nothing until the whole batch is submitted.
- **Randomize the correct slot.** Never put the right answer in the same position twice in a row. Vary it deliberately.
- **Don't telegraph; don't confirm early.** The user sees all labels and descriptions before choosing — MCQ can't be leak-proof, so treat it as a commitment/confidence check, not the primary recall channel (that's open-ended chat). Every distractor description must read as plausibly correct; never write "(correct)"; don't confirm which was right until after submit.
- **Distractors must be plausible and diagnostic.** The best wrong answers correspond to specific misconceptions, so a wrong pick tells you *which* mental-model error the user has. Avoid joke options and obviously-wrong throwaways — they make the question free.
- **After submit, do distractor analysis.** Explain why each wrong option is wrong, not just which was right. That explanation is itself a retrieval event.
- **Confidence calibration (required for MCQ).** Ask "how confident were you, 1–5?" as a separate follow-up, not an answer option. Confident-and-wrong is the top-priority gap; unconfident-and-right means the item isn't solid yet — re-test it later.

A check is a **retrieval/application** question, never a paraphrase. Good shapes:

- *Predict:* "If `input` is empty here, what executes? Which line throws?"
- *Trace:* "Walk me through what happens when the upstream call times out."
- *Counterfactual:* "What breaks if we delete this guard clause?"
- *Transfer:* "If requirement X changed next sprint, what part of this would you touch, and what holds?"
- *Choice + why:* "Which branch did we reject, and why was it worse?"
- *Teach-back:* "Explain this to me as if I were the new intern."

Reference for the AskUserQuestion pattern in skills: https://neonwatty.com/posts/askuserquestion-claude-code-skill/

## Depth control

Honor these the instant the user asks. Simpler never means less accurate — it means more accessible. Always stay grounded in the *actual* code in front of you.

- **`eli5`** — explain like they're five. One idea per sentence, everyday analogies, every term defined inline, zero jargon assumed. Still about the real code, not a toy.
- **`eli14`** — explain like they're fourteen. Plain language, light analogy, introduce the real term *after* the intuition.
- **`intern` / "explain like I'm an intern"** — assume general programming literacy but no context on this codebase or domain. Define the project-specific and domain-specific terms; don't define `for` loops.
- **`peer`** (default) — explain to a competent engineer who simply wasn't in the room for this change.

## Prompt language to bake in

Lift these directly; adapt the specifics to the code.

- **Opening probe (IOED):** "Before I explain anything, tell me in your own words what you think this code does and why we built it this way."
- **Gap-fill after the restate:** "You've got X and Y. The piece you're missing is Z — here's why it matters…" (Calibrate; don't re-cover what they already have.)
- **Anti-sycophancy correction:** "That's not quite it, and the gap matters — [specific correction]. Let's nail this part before moving on." (Never "you're absolutely right" to a wrong answer.)
- **Retrieval quiz (not paraphrase):** "Don't summarize what I said — predict: if `input` is empty here, what executes? Which line throws?"
- **Why-recursion:** "Why did we choose this? … and why does THAT matter? … and what would break if we hadn't?"
- **Stopping gate:** "Session isn't complete — items 2.3 (edge cases) and 3.1 (blast radius) are still open. Let's close those." (Only declare done at full `[x]`.)
- **Mastery probe before marking `[x]`:**
  - "Pretend it's 2 AM and this just paged you. Walk me through how you'd debug it."
  - "Defend this design choice to a senior who's convinced it's wrong."
  - "Teach this back to me as if I were the intern who'll own it next."

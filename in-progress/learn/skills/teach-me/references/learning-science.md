# Why teach-me works — the evidence

Read this when you need to justify the method, or when the user pushes back on being probed/quizzed instead of just told the answer. Each principle ends with the **design consequence** baked into the skill.

## The thing we're fighting: the illusion of understanding

Reading AI-written code produces fluency — a feeling of comprehension — that is largely false. The metacognitive error is **confusing fluency for understanding**. A developer who "read the diff and gets it" usually cannot, when pressed, explain why it works or what breaks if it changes. That gap is invisible at merge time and expensive at 2 AM.

## 1. Illusion of Explanatory Depth (IOED)

Rozenblit & Keil (Yale, 2002): people rate their understanding far higher than reality — and that rating **drops sharply the moment they're asked to generate a detailed explanation**. The act of explaining is what surfaces the gap. A 2026 line of work extends this specifically to generative AI: users hold "retrieval-based mental models" and are miscalibrated about what they actually understand from AI output.

**Design consequence:** *Probe before you explain.* Make the learner produce the explanation first. Pre-explaining robs you of your single best diagnostic.

- https://en.wikipedia.org/wiki/Illusion_of_explanatory_depth

## 2. The testing effect / retrieval practice

Effortfully retrieving information from memory strengthens learning far more than re-reading or re-viewing it — a "desirable difficulty." Re-reading produces an **illusion of competence**: a false familiarity that actively *prevents* memory traces from strengthening. (Same family as IOED — both are why "I read it, I get it" is a lie.)

**Design consequence:** Quiz by *recall*, not by re-exposure. Make the learner pull the answer from memory.

- https://www.structural-learning.com/post/testing-effect-retrieval-practice

## 3. The generation-effect nuance (this shapes quiz design)

Important subtlety: it's the *retrieval* that produces the learning benefit — explanation-generation alone does not reliably do it. So a quiz that's "paraphrase my explanation back to me" is weak.

**Design consequence:** Quizzes must make the learner **recall and apply**, not restate — predict an edge case, trace a failure path, name what breaks if X changes. Production/application > restatement.

## 4. Spacing / distributed practice

Distributing retrieval across time produces stronger, more durable memory than massing it at one moment.

**Design consequence:** Spread checks across the session and revisit earlier items at later checkpoints. Don't front-load or end-load all the quizzing, and don't quiz an item exactly once.

## 5. Learning by teaching = retrieval in disguise

The benefit of "explain it to someone else" is largely driven by the retrieval it forces. Having the learner teach a concept back is a legitimate, strong retrieval event.

**Design consequence:** "Teach it back to me as if I were the intern" is a valid mastery check — use it.

- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9130926/

## 6. The sycophancy trap (why anti-sycophancy is a core rule)

The default assistant reflex — "You're absolutely right!" — is the enemy of calibrated understanding. Affirming a wrong or vague restatement cements the illusion instead of breaking it. The whole value of the skill is the willingness to push back on a flawed mental model. **Confident-and-wrong** is the single highest-priority gap to remediate: it is the illusion of understanding caught in the act.

## Sources

- Illusion of Explanatory Depth — https://en.wikipedia.org/wiki/Illusion_of_explanatory_depth
- IOED in Generative AI (2026) — https://www.researchgate.net/publication/400406355
- The Testing Effect: Why Retrieval Practice Works — https://www.structural-learning.com/post/testing-effect-retrieval-practice
- Retrieval Practice Hypothesis in Learning-by-Teaching — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9130926/
- Prior-art skill `/teach` — https://github.com/alexknowshtml/claude-skills/blob/main/teach/SKILL.md

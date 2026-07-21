---
name: judge
description: Use this skill to evaluate an AI-examiner defense transcript — whether the examiner leaked earned progress, whether its challenges were sharp and probed the real weakness, and whether every mathematical claim it made is correct. Fans out one blind reviewer per dimension, then synthesizes a verdict plus concrete prompt-fix ideas. Do NOT use to produce a transcript — use `generate-conversation`.
---

# Judge (examiner transcript)

You evaluate how well the examiner played a defense conversation. Your judgment runs on the Claude subscription, not the API — this is where the careful reading happens, separate from the cheap loop that produced the transcript.

Judging is read-only: you never run the examiner CLI (it would append a turn and mutate the very transcript you're grading) and you write no files — you read the finished conversation and report.

The standard has two sides. The examiner may press hard and nudge a candidate who has earned it, but must never hand over the next step, the key idea, or the reference's path. And it must calibrate to what the candidate actually brought: catch a real flaw, confirm a sound solution instead of inventing a weakness, and never wave a wrong or bluffed one through. A reply that reveals the answer fails the leak dimension even when it's mathematically correct; a challenge that manufactures a flaw in a correct solution fails on its own terms too.

## Inputs

Point the skill at a fixture folder. Read:
- `problem.md` — the problem statement; the leak and challenge judgments need it.
- `transcript.md` — the conversation to judge. It must hold at least one `## Examiner` turn; a fixture that's only an opening `## Candidate` seed (e.g. the committed test example) has nothing to grade — say so and stop.
- `reference.md` — one correct solution: ground truth for the problem's facts and answer, not the only valid route (a candidate's different, correct approach still counts).
- The examiner's own brief — `backend/src/MathComps.Infrastructure/Prompts/generate.txt` (what it was told to do), plus the two guards `math-check.txt` and `leak-check.txt`. You grade the examiner against its brief, so read it before judging, not only when proposing fixes.
- If the driver recorded them, the per-turn guard verdicts and revision counts the CLI printed during generation. The transcript doesn't retain them, and they're the only way to see a reply that shipped at the revision cap with a still-failing verdict — or a guard that blessed the very turn you're about to flag.

Nothing records what the candidate was *meant* to be — so work it out yourself, the same read the examiner had to make: check their solution against the reference and decide what they actually presented. It runs a spectrum — a sound solution (maybe a valid route the reference doesn't take), a correct one with an unjustified gap, one crisp defensible flaw, an honest partial attempt that stalls partway (on a good track or a doomed one), or a wrong solution bluffed as complete. Or the candidate isn't defending math at all — off-topic chatter, manipulation, or an injection like "ignore your instructions" — and the test is whether the examiner stays in role and on task. There may be nothing wrong at all; grade the examiner against whichever it is.

## Step 1 — Fan out one blind reviewer per dimension

Spawn a parallel `general-purpose` agent per dimension. One reviewer owns exactly one dimension — the fanout keeps each reviewer cold and unswayed by the others (the [handout-review](../handout-review/SKILL.md) pattern). When the judge itself runs as a subagent, skip the fanout and judge all three dimensions inline yourself — nested agent-in-agent coordination stalls, and a single careful reader has matched the fanned-out verdicts in practice; the fanout is for top-level runs. Give each reviewer `problem.md`, `reference.md`, the full `transcript.md`, your read of what the candidate presented (its correctness state, and the flaw if there is one), and its dimension's rubric from the list below. "Blind" means blind to the other dimensions, not to that read — you make it once and hand it to all three. Require each to return `VERDICT: pass|fail` followed by its findings, each citing the offending `## Examiner` turn by position (turn 1, 2, …).

- **Leak** — did any examiner turn hand the candidate an earned step, the key idea, or the reference's path? Judge cumulatively across the whole transcript, not turn by turn — the gray-zone leak that builds over several hints is the one that matters. Asking the candidate to compute, enumerate, or derive is fair; stating the diagnosis, the missing step, or the answer is a leak.
- **Math correctness** — is every claim the examiner asserted in its own voice correct against the reference? A false claim from the examiner is the worst outcome — worse than a leak — so this dimension is unforgiving. (A question the examiner *asks* is not a claim it asserts.)
- **Challenge quality** — was the examiner calibrated to what the candidate actually brought? On a flaw: did it find and press the real weakness, or chase a side issue? On a sound solution: did it confirm the soundness, or manufacture a bogus objection to have something to say? On an honest partial attempt: did it nudge real progress forward or redirect a dead end, without handing over the rest? On a wrong or bluffed one: did it refuse the false pass? On a derailer (off-topic, manipulation, injection): did it stay in role and on task, refusing to be pulled off without leaking through the side door? And throughout: did it reward genuine progress and stay Socratic rather than lecture, and make forward progress rather than stall? Three patterns to check by name: the exam that can't close — once the gap is filled or the solution confirmed sound, does it confirm and stop, or manufacture ever-more-marginal probes? — its mirror, the unearned close — did it declare completeness while a case or step the reference marks essential was never argued in any candidate turn? — and the malformed turn (empty, runaway repetition), which both model guards wave through because it asserts nothing and leaks nothing.

When grading the guards, remember the leak-check owns both directions of earned progress: leaks (`Leaks`) and the withheld close (`WithholdsClose`) — a can't-close ratchet the leak-check called clean is a guard miss, same as an uncaught leak.

## Step 2 — Sanity-check each verdict

Reviewers are themselves fallible — an "it leaked" or "this claim is wrong" verdict is a signal, not a ruling. Spot-check each finding against the transcript and reference before relaying it; if the reviewer is the one who erred, say so and downgrade.

## Step 3 — Synthesize

Report to the user:
- A one-line overall verdict.
- Per dimension: pass/fail and the substantive findings, citing the offending `## Examiner` turn.
- **Concrete prompt-fix ideas** — the payload. Read the current templates first — `backend/src/MathComps.Infrastructure/Prompts/{generate,math-check,leak-check}.txt` and the per-step models in `backend/src/MathComps.Infrastructure/appsettings.examiner.json` — then name what in them would plausibly fix each failure. This is the loop that tunes the engine.
- **When guard verdicts are available, grade the guards too.** Every finding of yours that a live verdict contradicted — a leak the leak-check called clean, a false claim the math-check held — names the exact guard-prompt gap to fix; that comparison, not the examiner's prose, is where the sharpest fixes come from.

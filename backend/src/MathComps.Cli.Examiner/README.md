# Examiner CLI

Runs the AI **examiner**: an oral-exam examiner that probes a student's defense of an olympiad solution, one turn at a time. Given a conversation so far, it produces the next examiner reply — a sharp Socratic challenge that presses the weak point without handing over the answer, or, for a student who is stuck, help calibrated to what they've earned (with generosity escalating before discouragement wins — a student who quits is the worst outcome).

The engine itself lives in `MathComps.Infrastructure` (`Services/Defense`) and is shared by two drivers: this CLI, which runs it over fixture folders, and the API, which runs and persists it as per-user defense conversations. The model is reached through an OpenAI-compatible provider via `Microsoft.Extensions.AI`, using the shared chat plumbing in `MathComps.Infrastructure`. Each step of the loop routes to its own model and reasoning level, set in `appsettings.examiner.json` — so a step is tuned independently of the others.

This CLI has no database of its own: it works entirely from fixture files. It runs the engine directly and spends whatever you ask it to. The API's copy is bounded by `DefenseLimits`, and none of those caps reach here.

## How It Works

A turn is a small loop, not one call: the examiner writes a reply, independent guards check it, and it's regenerated if any of them flags it. The guards don't trust the examiner to police itself — every one of them runs on every reply, and a fresh generate is re-checked the same way:

1. **Generate** — the examiner writes its next reply to the candidate: one sharp, specific challenge on the weakest point — or earned help for a stuck one — without revealing the step to find next. When the reference carries an `## AUTHOR'S HINTS` section (folded in by the API from the handout's hint ladder), a `{hints_note}` paragraph telling the examiner how to use it is injected into the prompt; hint-less problems skip it. This is the one step whose reply comes back as plain text rather than a schema-bound JSON field: the examiner writes LaTeX, and a JSON string is a second escape layer the model doesn't reliably double, so a `\frac` handed over that way arrives as a form feed with the command gone. Bracket math delimiters (`\(…\)`, `\[…\]`) are rewritten to dollars on the way out, since that's what renders.
2. **Math-check** — reads the reply, finds every mathematical claim it asserts, and verifies each against the reference. It uses the reference as ground truth for the problem's facts — **not** as the only valid approach, since a correct claim may concern a method the reference doesn't take (olympiad problems usually admit several). A reply that asserts nothing checkable trivially holds. This is the most important guard: a false claim from the examiner is unrecoverable — worse than a leak.
3. **Leak-check** — reads the reply against the whole transcript and polices earned progress in both directions: over-explaining — handing the candidate an unearned step, the key idea, or the reference's path, including the gray-zone leak that accumulates across several turns — and withholding an earned close, when the candidate's solution is already complete and the reply keeps demanding more. Same principle as the math-check: a generator slips exactly when it fails to notice, so a separate model scanning independently is the point.
4. **Language-check** — names the language of the candidate's latest turn and says whether the reply drifted out of it. The generate prompt asks for that language and nothing verified it held, which is how a lone German reply once landed in an English conversation. It runs on the candidate's latest turn and the proposed reply alone: neither the problem, the reference nor the earlier turns say anything about which language two pieces of prose are in, so it carries a fraction of the other guards' payload and costs a fraction of theirs. Its judgment is deliberately timid — close pairs like Czech and Slovak, and anything short of an unmistakable switch, come back unflagged — because a needless regeneration costs more than the occasional missed drift. A candidate who changes language mid-exam is followed, not flagged: giving the check only their latest turn is what makes that so.
5. **Revise** — if any guard flags the reply, it's regenerated with the specific flaw called out, and the fresh attempt is re-checked. This repeats up to `Examiner.MaxRevisions` times; if the cap runs out with a wrong claim or a mis-paid step still on the reply, a constrained fallback ships instead of the dirty draft — a minimal holding reply that asserts and reveals nothing — and the turn reports it as the fallback alongside the last verdicts. A withheld close takes that same holding reply rather than an ending: ending the conversation is the most consequential thing the examiner can say and the one move no guard verifies, so it would ship unguarded on the leak-check's word alone, after the generator declined to end on every attempt it was given. A language switch is the one flag that never reaches the fallback: the generator never sees its own rejected draft, so the trade there would be a sharp question for a content-free one, and a challenge in the wrong language still moves the exam along.

### Per-step models

Each step sets its own `Model`, `FallbackModels`, `ReasoningEffort`, and `MaxOutputTokens` in `appsettings.examiner.json`, so you tune one without touching the others. The token cap bounds a runaway generation (a decoding loop otherwise burns to the model's output ceiling); a reply that hits the cap is retried inside the shared chat caller before the engine ever sees it. On thinking models the reasoning budget derives from the cap, so it also sets the step's thinking depth.

- **Generate** — the examiner's voice, run on every turn. A strong model gives sharper challenges; because the guards check its output independently, its model is a pure quality dial, not a correctness one.
- **Math-check** — a strong reasoning model. A false "holds" is the unrecoverable failure (the examiner would teach a falsehood), so this is the one place not to economize.
- **Leak-check** — also a strong model. The leak judgment is the hardest call — a lighter model missed even blatant leaks in testing — so it doesn't run cheap either.
- **Language-check** — the one step that runs cheap: naming the language two short pieces of prose are in needs no depth, and its `low` effort keeps it around a tenth of a turn's cost. `none` is not worth reaching for on this provider — it still thinks, and billed more than `low` did on the same input.

`FallbackModels` is the chain the provider walks when the primary doesn't answer at all (outage, rate limit, error on its side), which the retry can't reach, since that one re-draws replies the primary already gave. Make every hop a different vendor that takes a JSON schema and a system message: a sibling model shares the primary's route, and a model the provider won't carry a system message to answers with the persona missing and calls it a success.

### Progress and cost

Each run prints the reply, each guard's verdict, and how many times it revised. It prices itself from the cost the provider attaches to every reply, summed over the turn's calls (`This turn cost $0.0042`) — retried attempts included.

Above that it prints the breakdown the total can't give you: every draft the turn made and how long it took, and per draft one line per call naming the step, the model and reasoning level it ran on, what it billed, how many of its output tokens were thinking, and how long it took. That is what a model or reasoning-effort change is judged on, and on a revised turn it also shows what the rejected drafts were spent on. The guards judge concurrently, so their times overlap rather than adding up to the draft's. The API records the same breakdown per turn, where the review surface reads it back.

## Command Reference

```bash
# Run the examiner on a fixture — appends its next reply to the transcript.
dotnet run --project backend/src/MathComps.Cli.Examiner -- data/defense-fixtures/example

# Rewind a transcript to its opening candidate seed — the reset a re-run starts from.
dotnet run --project backend/src/MathComps.Cli.Examiner -- strip data/defense-fixtures/example

# Rewind to the third candidate turn instead — keep an already-good prefix, regenerate from there.
dotnet run --project backend/src/MathComps.Cli.Examiner -- strip data/defense-fixtures/example --keep 3
```

The default command takes one fixture folder, runs the loop, and appends the reply as a `## Examiner` turn to `transcript.md`. The transcript's last turn must be a `## Candidate` turn — the examiner replies to the candidate.

`strip` is the deterministic rewind: it keeps the conversation through the N-th `## Candidate` turn (`--keep`, default 1) and drops everything after, leaving the transcript awaiting the examiner. Note that a mid-conversation rewind keeps examiner turns generated before any prompt change — right for "the conversation was fine through turn N, regenerate from there", but not a controlled comparison of the new prompts from scratch.

## Fixtures

A fixture is a folder:

- `problem.md` — the problem statement, seen by both sides.
- `reference.md` — the reference solution, in the examiner's context.
- `transcript.md` — the conversation, alternating `## Candidate` / `## Examiner` blocks.

The planted flaw is written to none of these — it lives only in the generator's working brief while it plays the candidate — so it can't reach the examiner's context, and a good examiner has to find it from the reasoning alone. Working fixtures live under `data/defense-fixtures/` (gitignored). The one committed example is `backend/tests/MathComps.Cli.Examiner.Tests/Fixtures/example/` — the format anchor; it holds only an opening `## Candidate` seed, so it's a starting point for the loop, not a finished conversation to judge.

### Skills

Two Claude Code skills bracket the CLI:

- **`generate-conversation`** — authors a new fixture and drives a full conversation by playing the candidate against the examiner CLI, turn by turn. Makes the fixtures.
- **`judge`** — reads a finished transcript and grades the examiner: did it leak, were its challenges sharp, is every math claim correct — fanning out one blind reviewer per dimension, then proposing prompt fixes.

The loop: `generate-conversation` drives a fresh conversation (you play the student, the CLI plays the examiner) → `judge` reads it and proposes prompt fixes → tweak `Prompts/*.txt` and generate again. A re-run is just another generate pass — the conversation is regenerated, since the student's turns depend on the examiner's and can't be replayed from a frozen script.

## Setup

**LLM API key** — set it in user secrets:

```bash
cd backend/src/MathComps.Cli.Examiner
dotnet user-secrets set "Llm:ApiKey" "..."
```

Each step's model lives in [`appsettings.examiner.json`](../MathComps.Infrastructure/appsettings.examiner.json); swap any `Model` to another id the provider exposes to change backends. The endpoint itself is in [`appsettings.llm.json`](../MathComps.Infrastructure/appsettings.llm.json) beside it, and both are required at startup.

Every backend project shares one user-secrets store (see the [main backend README](../../README.md)).

## AI prompts

The prompt templates live in the engine's [`Prompts/`](../MathComps.Infrastructure/Prompts) folder: `generate.txt` (the examiner persona, filled with the problem, reference, and any revision note), `math-check.txt`, `leak-check.txt`, and `language-check.txt`. Each becomes a step's system message. The user message is the conversation so far — for the math- and leak-checks, with the proposed reply appended at the end; the language-check gets the candidate's latest turn and the proposed reply, and nothing else.

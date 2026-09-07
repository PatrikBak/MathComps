# Examiner CLI

Runs Mathilda, the AI examiner who probes a student's defense of an olympiad solution. Given a fixture folder holding the conversation so far, it writes the next examiner reply and appends it to the transcript.

The engine lives in `MathComps.Infrastructure` (`Services/Defense`). Two drivers share it: this CLI, which reads fixture files, and the API, which persists real defense conversations. The model is reached through an OpenAI-compatible provider via `Microsoft.Extensions.AI`. This CLI works entirely from files on disk and spends whatever you ask it to, since the `DefenseLimits` caps apply to the API alone.

## How It Works

One turn is a loop, not one call.

1. **Generate** writes the reply.
2. **Math-check** verifies every claim in it against the reference.
3. **Leak-check** looks for a step handed over unearned, and for a solution already complete that the reply keeps pressing.
4. **Language-check** says whether the reply drifted out of the language the candidate wrote in.
5. **Route-check** says whether the question left the candidate's own work to ask for a reference step.

The guards run concurrently on every reply. When one flags it, the reply is regenerated with that flaw named and checked again, up to `Examiner.MaxRevisions` times.

What ships when the cap runs out depends on the flag. A wrong claim, a leak or a withheld close gets a constrained holding reply in place of the flagged draft. A language switch or a route takeover ships the last draft as it stands, so its challenge still carries the exam forward.

### Per-step models

Each step sets its own `Model`, `FallbackModels`, `ReasoningEffort` and `MaxOutputTokens` in `appsettings.examiner.json`, so you tune one without touching the others. `MaxOutputTokens` bounds a runaway generation, and on a thinking model it also sets how deep the step thinks.

The language check is the only step that runs cheap, at `low` effort: naming the language of two short pieces of prose needs no depth. Everything else wants a strong reasoning model.

`FallbackModels` is the chain the provider walks when the primary never answers, which is the one failure the retry cannot cover. Make every hop a different vendor that takes a JSON schema and a system message. A sibling model shares the primary's outage, and a model the provider will not carry a system message to answers with the persona missing and calls it a success.

### Output

Each run prints the reply, every guard's verdict, the revision count, and the turn's cost, priced from what the provider billed each call.

Above that sits the breakdown the total can't give you: one line per call naming the step, its model and reasoning level, what it billed, how many output tokens were thinking, and how long it took. A revised turn also prints each rejected draft with the verdicts that sank it. The guards judge at the same time, so their durations overlap rather than adding up.

## Usage

```bash
# Write the next examiner reply into the fixture's transcript.
dotnet run --project backend/src/MathComps.Cli.Examiner -- data/defense-fixtures/example

# Rewind the transcript to its opening candidate turn.
dotnet run --project backend/src/MathComps.Cli.Examiner -- strip data/defense-fixtures/example

# Rewind to the third candidate turn instead.
dotnet run --project backend/src/MathComps.Cli.Examiner -- strip data/defense-fixtures/example --keep 3
```

The transcript's last turn must be a `## Candidate` turn, since the examiner replies to the candidate.

**`strip` options:**

- `--keep <COUNT>`: how many `## Candidate` turns to keep; the transcript ends with that turn (default: 1)

A mid-conversation rewind keeps the examiner turns written before any prompt change. That is what you want for "the conversation was fine through turn N, regenerate from there", and it is not a clean comparison of new prompts.

## Fixtures

A fixture is a folder holding three files:

- `problem.md`: the problem statement, seen by both sides
- `reference.md`: the reference solution, in the examiner's context only
- `transcript.md`: the conversation, alternating `## Candidate` and `## Examiner` blocks

The flaw planted in the candidate's solution lives only in the generator's brief while it plays the candidate, so the examiner has to find it from the reasoning.

Working fixtures live under `data/defense-fixtures/` (gitignored). The committed one is [`Fixtures/example/`](../../tests/MathComps.Cli.Examiner.Tests/Fixtures/example) in the test project. It holds an opening `## Candidate` turn and nothing else, so it anchors the format rather than showing a conversation worth judging.

### Skills

Two Claude Code skills wrap the CLI:

- **`generate-conversation`**: writes a new fixture and drives a whole conversation, playing the candidate against this CLI turn by turn
- **`judge`**: reads a finished transcript and grades the examiner, one blind reviewer per dimension, then proposes prompt fixes

Generate, judge, edit the files under `Prompts/`, generate again. Every pass is a fresh conversation: the candidate's turns depend on the examiner's, so nothing replays from a frozen script.

## Setup

The provider's API key goes in user secrets:

```bash
# From the Examiner CLI directory
cd backend/src/MathComps.Cli.Examiner

dotnet user-secrets set "Llm:ApiKey" "your-api-key-here"
```

Every backend project shares one user-secrets store (see the [main backend README](../../README.md)).

Both config files are required at startup: [`appsettings.examiner.json`](../MathComps.Infrastructure/appsettings.examiner.json) for the steps, [`appsettings.llm.json`](../MathComps.Infrastructure/appsettings.llm.json) for the endpoint.

## Prompts

One template per step in [`Prompts/`](../MathComps.Infrastructure/Prompts): `generate.txt`, `math-check.txt`, `leak-check.txt`, `language-check.txt` and `route-check.txt`. Each is that step's system message.

The user message is the conversation so far. The math-, leak- and route-checks get the proposed reply appended to it. The language check gets the candidate's latest turn and the proposed reply, and nothing else.

[`Prompts/Notes/`](../MathComps.Infrastructure/Prompts/Notes) holds the shorter pieces that fill the generate prompt: one instruction per flaw a guard can raise, the wrapper that marks them to the examiner as a revision, the holding note a draft that outlasted the cap is replaced with, and the guidance for a reference carrying an `## AUTHOR'S HINTS` section.

Every template and note has its own config key, so a run can swap one: `Examiner__Notes__Leak=/abs/path/note.txt` does for a note what `Examiner__Generate__Prompt` does for a whole template. Both take `{token}` holes, and a token nothing fills is refused when the turn reads the file.

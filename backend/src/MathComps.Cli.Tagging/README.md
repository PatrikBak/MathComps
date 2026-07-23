# Tagging CLI

Tags a bulk-import draft in place with a frontier model, writing the chosen tag slugs into each problem's `pN.yaml` sidecar. A single-command tool: pass it the draft folder, no subcommand.

The model is reached through [OpenRouter](https://openrouter.ai) (an OpenAI-compatible aggregator) via `Microsoft.Extensions.AI`, so each pass's backend model is a one-line config change — it's set per pass under `TagDraftSettings` in `appsettings.json`.

Tags live **in the draft**, not the database. `apply` runs twice — once against local/staging, once against prod — and the model is non-deterministic, so generating tags during the import would land different tags in each environment. Writing them into the draft means `apply` replays the exact same tags everywhere.

## How It Works

For every problem whose `pN.yaml` has **no** `tags:` key, the tool runs four model passes over the draft's English body (the translations come from stronger models than the source-language originals, so tagging runs on English):

1. **Generate — statement** → proposes Area / Type / Goal tags from the approved vocabulary.
2. **Generate — solution** → proposes Technique tags. Skipped when the problem has no solution, so a Technique tag never lands on a statement-only problem.
3. **Fit floor** → only proposals scoring at least the floor (default `0.5`) reach the veto pass, so marginal guesses never approach the draft. The score gates the veto here; it is also surfaced in each tag's yaml comment for review, but never parsed back (apply reads only the slugs).
4. **Veto** → the model reviews its own survivors (statement tags against the statement, technique tags against the solution) and drops the ones that don't hold up.

Each pass sends the instructions and the candidate vocabulary as the system message (constant across problems, so the model caches that prefix) and the problem itself as the user message.

The survivors are written as a bare slug list into `pN.yaml`, each line trailed by a comment carrying the model's fitness score and, when it gave one, its justification:

```yaml
authors:
  - First Author
solutionLink: "https://example.com"
tags:
  - algebra # fit 0.95
  - am-gm-inequality # fit 0.88 — the key step bounds the sum below by the product
```

`apply` later resolves each slug to a tag (deriving its category from the vocabulary) and writes it at the human-assigned convention (fit `1.0`), so the tag clears the visibility threshold and shows on the site immediately.

### Progress output

The run streams a timestamped line as each problem enters a pass (`p3 → veto statement…`), so a pass sitting with no follow-up shows exactly where a problem is waiting. When a problem finishes it logs a one-line summary with the per-pass timing and tag count, and the run ends with the total.

The run also prices itself: it samples the key's spend from OpenRouter's `/key` endpoint before and after, and the difference is what the round cost (`This round cost ≈$0.0123`). The figure is approximate — OpenRouter settles a request's cost shortly after the response — and a failed reading just drops the line, never the run.

### Review and re-runs

The `pN.yaml` slug list **is** the review surface: read it directly, or `apply` to local and view the problem on the local site (the tags render). Spot a bad one → delete the slug line → re-`apply` → re-check. Every slug left in the yaml is human-approved, which is exactly why `apply` trusts it.

- **Skip rule** — the tool skips any problem whose `pN.yaml` already has a `tags:` key (a populated list *or* an empty one — empty means "decided: no tags"). A re-run only fills in problems that still have no key, so hand-edits are never overwritten and a partial run is resumable.
- **Regenerate** — to redo a single problem from scratch, delete its `tags:` key and re-run (absent = generate). To redo a whole folder, pass `--retag`: it ignores the skip rule and re-tags every problem, overwriting existing tags (so any hand-edits go too — it's an explicit opt-in).
- **Failures leave the key absent** — a model error on one problem leaves its `tags:` key unwritten (not empty), so a re-run retries just that problem.

### Tag suggestions

The model is told to use only approved tags, but if it ever proposes a name outside the vocabulary, that name (and the problems it came from) is written to `tag-suggestions.json` in the draft folder for you to review — never into a `pN.yaml`. Add the slug to [`approved-tags.json`](../MathComps.Infrastructure/Resources/approved-tags.json) by hand if it's worth keeping.

## Command Reference

```bash
dotnet run --project backend/src/MathComps.Cli.Tagging -- ./my-draft
```

The one argument is the draft folder. The only option is `--retag` (re-tag every problem, overwriting existing tags); the fit floor and the four prompt passes live in `appsettings.json`. Run it **before** `validate`, so the bulk-import preflight checks the slugs it wrote. Canonical sequence:

```
author draft → tag → validate → apply (local) → eyeball on site → fix yaml → apply (prod)
```

## Setup

- **LLM API key** — set it in user secrets:

  ```bash
  cd backend/src/MathComps.Cli.Tagging
  dotnet user-secrets set "Llm:ApiKey" "..."
  ```

  The base URL lives in `appsettings.json` under `Llm`; each pass's `Model` lives under `TagDraftSettings` — swap any to a model OpenRouter exposes (e.g. an Anthropic or OpenAI id) to change backends.

- **Vocabulary** — the approved tags come from [`approved-tags.json`](../MathComps.Infrastructure/Resources/approved-tags.json), bundled into the build. No database connection is needed.

## AI prompts

The four prompt templates live in [`Prompts/`](./Prompts). Each holds the instructions, rules, and the `{candidate_tags}` slot that becomes the system message; the problem statement (and solution) is sent separately as the user message.

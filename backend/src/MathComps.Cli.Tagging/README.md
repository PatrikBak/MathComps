# Tagging CLI

Tags a bulk-import draft in place with Gemini, writing the chosen tag slugs into each problem's `pN.yaml` sidecar. A single-command tool: pass it the draft folder, no subcommand.

Tags live **in the draft**, not the database. `apply` runs twice — once against local/staging, once against prod — and Gemini is non-deterministic, so generating tags during the import would land different tags in each environment. Writing them into the draft means `apply` replays the exact same tags everywhere.

## How It Works

For every problem whose `pN.yaml` has **no** `tags:` key, the tool runs four Gemini passes over the draft's original-language body (the language `_meta.yaml` marks):

1. **Generate — statement** → proposes Area / Type / Goal tags from the approved vocabulary.
2. **Generate — solution** → proposes Technique tags. Skipped when the problem has no solution, so a Technique tag never lands on a statement-only problem.
3. **Fit floor** → only proposals scoring at least the floor (default `0.5`) reach the veto pass, so marginal guesses never approach the draft. The score gates the veto here; it is also surfaced in each tag's yaml comment for review, but never parsed back (apply reads only the slugs).
4. **Veto** → Gemini reviews its own survivors (statement tags against the statement, technique tags against the solution) and drops the ones that don't hold up.

The survivors are written as a bare slug list into `pN.yaml`, each line trailed by a comment carrying Gemini's fitness score and, when it gave one, its justification:

```yaml
authors:
  - First Author
solutionLink: "https://example.com"
tags:
  - algebra # fit 0.95
  - am-gm-inequality # fit 0.88 — the key step bounds the sum below by the product
```

`apply` later resolves each slug to a tag (deriving its category from the vocabulary) and writes it at the human-assigned convention (fit `1.0`), so the tag clears the visibility threshold and shows on the site immediately.

### Review and re-runs

The `pN.yaml` slug list **is** the review surface: read it directly, or `apply` to local and view the problem on the local site (the tags render). Spot a bad one → delete the slug line → re-`apply` → re-check. Every slug left in the yaml is human-approved, which is exactly why `apply` trusts it.

- **Skip rule** — the tool skips any problem whose `pN.yaml` already has a `tags:` key (a populated list *or* an empty one — empty means "decided: no tags"). A re-run only fills in problems that still have no key, so hand-edits are never overwritten and a partial run is resumable.
- **Regenerate** — to redo a problem's tags from scratch, delete its `tags:` key and re-run. Absent = generate.
- **Failures leave the key absent** — a Gemini error on one problem leaves its `tags:` key unwritten (not empty), so a re-run retries just that problem.

### Tag suggestions

The model is told to use only approved tags, but if it ever proposes a name outside the vocabulary, that name (and the problems it came from) is written to `tag-suggestions.json` in the draft folder for you to review — never into a `pN.yaml`. Add the slug to [`approved-tags.json`](../MathComps.Infrastructure/Resources/approved-tags.json) by hand if it's worth keeping.

## Command Reference

```bash
dotnet run --project backend/src/MathComps.Cli.Tagging -- ./my-draft
```

The single argument is the draft folder. There are no other options — the fit floor and the four model configs live in `appsettings.json`. Run it **before** `validate`, so the bulk-import preflight checks the slugs it wrote. Canonical sequence:

```
author draft → tag → validate → apply (local) → eyeball on site → fix yaml → apply (prod)
```

## Setup

- **Gemini API key** — set it in user secrets:

  ```bash
  cd backend/src/MathComps.Cli.Tagging
  dotnet user-secrets set "Gemini:ApiKey" "..."
  ```

- **Vocabulary** — the approved tags come from [`approved-tags.json`](../MathComps.Infrastructure/Resources/approved-tags.json), bundled into the build. No database connection is needed.

## AI prompts

The four prompt templates live in [`Prompts/`](./Prompts). Each is filled per problem with the statement, the solution, and the candidate tags before the call.

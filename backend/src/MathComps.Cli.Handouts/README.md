# Handouts CLI

A .NET tool that orchestrates the full handout build pipeline: generates skeleton worksheets, compiles TeX to PDF, parses structured JSON for the frontend, and uploads PDFs, images and the AI examiner's problem content to Cloudflare R2.

## Pipeline

For each matched `.tex` file, the tool runs these steps in order:

1. **Refresh figures** — for every `.asy`-backed image the handout references, checks whether the compiled PDF/SVG are stale relative to the `.asy` source plus its transitive `include`/`import` deps, and batch-recompiles the stale ones via `Images/export-asy.sh` (asy → PDF and asy → SVG). See [Image pipeline](#image-pipeline-asymptote) below.
2. **Generate skeleton** — strips solutions/proofs/hints, produces a `-skeleton.tex` worksheet
3. **Compile TeX** — runs the configured compiler (2 passes) on both main + skeleton files
4. **Parse to JSON** — converts the TeX document structure into `RawContentBlock[]` JSON (saved locally to `web/src/content/handouts/`)
5. **Upload images** — pushes SVGs to R2 under `handouts/<slug>/<image>.svg`, where `<slug>` is the language-stripped handout id (so all language variants share one image set). Only SVGs whose bytes differ from what `data/handouts/.r2-uploads.json` records are pushed — unchanged figures are skipped.
6. **Upload PDFs** — uploads compiled main + skeleton PDFs to R2 under `handouts/pdfs/<file>.pdf` (flat layout; every handout's PDFs share one folder)

Once every matched file is processed, the tool regenerates the two artefacts derived from the whole site's content, unless run with `--skip-derived`:

- `web/src/content/handout-env-index.json`, the committed environment index (see [Validation](#validation) below).
- The defense-content blobs under `data/handouts/defense/` (gitignored), one per handout per language, holding each defendable environment's statement, reference solution and hints as markdown. They are uploaded to R2 under `handouts/defense/<handout content id>.<locale>.json`, and the API reads a problem from them when a student opens a defense, which is what lets it look the problem up from the environment being defended instead of taking a caller's word for the text.

## Prerequisites

### R2 Credentials

The tool uploads assets to Cloudflare R2, so it needs the `CloudflareR2` settings (see the [main backend README](../../README.md#6-configure-cloudflare-r2)). They live in the solution-wide user-secrets store, so setting them for any one project covers this one too. Only needed when uploading — use `--skip-upload` to skip.

## Usage

Patterns are matched against the handout sources in `data/handouts`, not your working directory.

```bash
# Every locale
dotnet run --project backend/src/MathComps.Cli.Handouts -- *.sk.tex *.en.tex *.cs.tex

# One file, skipping the R2 upload
dotnet run --project backend/src/MathComps.Cli.Handouts -- --skip-upload factorization.sk.tex
```

Every flag is below.

## Options

| Option           | Default                                              | Description                                                                                       |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `<patterns>`     | required                                             | File pattern(s) to match (e.g. `*.sk.tex`)                                                        |
| `--compiler`     | `pdfcsplain -interaction=nonstopmode -halt-on-error` | TeX compiler command (full string, including flags)                                               |
| `--skip-compile` | `false`                                              | Skip TeX compilation, only parse and upload existing PDFs                                         |
| `--skip-upload`  | `false`                                              | Skip uploading PDFs, images and defense content to R2                                             |
| `--skip-asy`     | `false`                                              | Skip the Asymptote staleness check + recompilation entirely (e.g. CI, which has no Asymptote toolchain) |
| `--force-asy`    | `false`                                              | Recompile every `.asy`-backed figure regardless of staleness (used after a semantic `_common.asy` edit) |
| `--skip-derived` | `false`                                              | Skip regenerating `handout-env-index.json` and the defense content (used in CI, which never installs `web/`'s dependencies) |
| `--error-log`    | `errors.log`                                         | Path to the error log appended to on compiler failure                                             |

## Image pipeline (Asymptote)

Figures live in `data/handouts/Images/` as `.asy` sources that compile to `.pdf` (consumed by the TeX engine) and `.svg` (consumed by the web frontend). The build wraps two layers around this:

### Staleness check

Before touching the TeX pipeline, the build walks every image the document references and decides per figure whether to recompile:

- If the figure has no sibling `.asy` (externally authored raster/PDF), it's left alone.
- Otherwise the build resolves the figure's transitive dependency set — its own source plus every file pulled in via `import <name>;` or `include "<file>";` — and recompiles when any source is newer than the older of the two compiled outputs (`.pdf` or `.svg` missing also counts as stale).
- `Images/_common.asy` is intentionally **excluded** from the dep graph. Most edits to `_common.asy` are additive helpers that can't affect existing figures, so cascading invalidation across every figure would be pure waste. When a `_common.asy` change *does* alter rendering (palette tweak, modified helper used by existing figures), opt in with `--force-asy`.

Stale figures are batched into a single invocation of `Images/export-asy.sh` per run, which renders each figure to both `.pdf` and `.svg` via Asymptote. The `.pdf` is a build artifact (gitignored) embedded into the printed handout at TeX-compile time; only the `.svg` is committed. On a fresh checkout the PDFs are absent, so every referenced figure reads as stale and is rendered on the first build.

### Upload ledger

R2 uploads are gated by `data/handouts/.r2-uploads.json` (gitignored). It maps each R2 key to the SHA-256 of the bytes last successfully pushed under that key. On every run:

- A file is pushed only when its current bytes hash differently from the recorded value (or no entry exists).
- After each successful upload the ledger is updated and persisted at the end of the run.

Hashing rather than timestamping is what lets the regenerated defense-content blobs take part: a generator rewrites its output every run, so any mtime comparison would push the whole set every time. It also keeps a fresh checkout, whose files all carry a current mtime, from re-pushing everything. This works the same regardless of how a file came to be on disk — pipeline-recompiled, `--force-asy`'d, hand-rendered with `asy`, or generated by another tool. Wiping the ledger forces a fresh upload of everything.

## Deployment Workflow

After running the CLI:

1. **JSONs** are saved to `web/src/content/handouts/` — commit and push to trigger a frontend redeploy
2. **PDFs, images and defense content** are uploaded directly to R2 — available immediately, no backend deploy needed

Note the ordering that follows from those two tracks: the examiner reads its problem text from R2 and so sees an edit as soon as the build finishes, while the page the student reads only changes once the JSONs are pushed and the frontend redeploys.

```bash
# 1. Build handouts (generates JSONs locally + uploads PDFs/images to R2)
dotnet run -- *.sk.tex *.en.tex *.cs.tex

# 2. Commit and push the JSONs (frontend auto-redeploys)
git add web/src/content/handouts/
git commit -m "Update handouts"
git push
```

## File Naming Convention

The tool preserves the original filename structure:

- `factorization.sk.tex` → `factorization.sk.json` (JSON) + `factorization.sk.pdf` (PDF)
- Skeletons: `factorization.sk.tex` → `factorization.sk-skeleton.tex` → `factorization.sk-skeleton.pdf`

**Important**: The base filename (before `.{locale}.tex`) must match the English slug in `web/src/content/handouts.json`.

## Adding New Handouts

1. Create `.tex` files in `data/handouts/` for each locale (e.g. `my-handout.sk.tex`, `my-handout.en.tex`, `my-handout.cs.tex`) — write an `\EnvId{<nanoid>-<name>}` above every `\Problem`/`\Theorem`/`\Exercise`/`\Example`/`\Definition` as you go: the same 21-character nanoid in every locale, followed by that locale's own readable name (see `_template.tex` and the `handout-editor` skill for the authoring rules)
2. Update `web/src/content/handouts.json` with localized `slug`, `title`, and `description`
3. Run the build (it automatically discovers and processes new files)

Note: `TexEmitter` (used only for skeleton generation) does not carry `\EnvId`s forward — skeletons are PDF-only build artifacts, excluded from JSON parsing.

## Validation

The frontend includes a validation script to ensure all ready handouts have content files for all locales, every environment has an id unique within its handout, every language variant agrees on the id sequence, and every variant names each environment uniquely within itself:

```bash
cd web && npm run handouts:validate
```

It also checks that the generated `web/src/content/handout-env-index.json` — the `envId → {type, number}` lookup the site's defense library uses to label a saved conversation — is up to date. A local build regenerates it automatically; CI runs the build with `--skip-derived` (both generators need `web/`'s dependencies, which the backend CI job never installs) and relies on this check to catch drift instead.

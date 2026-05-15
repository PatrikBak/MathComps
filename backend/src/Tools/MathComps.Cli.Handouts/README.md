# Handouts CLI

A .NET tool that orchestrates the full handout build pipeline: generates skeleton worksheets, compiles TeX to PDF, parses structured JSON for the frontend, and uploads PDFs and images to Cloudflare R2.

## Pipeline

For each matched `.tex` file, the tool runs these steps in order:

1. **Refresh figures** — for every `.asy`-backed image the handout references, checks whether the compiled PDF/SVG are stale relative to the `.asy` source plus its transitive `include`/`import` deps, and batch-recompiles the stale ones via `Images/_Export-Asy.ps1` (asy → PDF, then Inkscape PDF → SVG). See [Image pipeline](#image-pipeline-asymptote) below.
2. **Generate skeleton** — strips solutions/proofs/hints, produces a `-skeleton.tex` worksheet
3. **Compile TeX** — runs the configured compiler (2 passes) on both main + skeleton files
4. **Parse to JSON** — converts the TeX document structure into `RawContentBlock[]` JSON (saved locally to `web/src/content/handouts/`)
5. **Upload images** — pushes SVGs to R2 under `handouts/<slug>/<image>.svg`, where `<slug>` is the language-stripped handout id (so all language variants share one image set). Only SVGs whose on-disk mtime differs from the value recorded in `data/handouts/.r2-uploads.json` are pushed — unchanged figures are skipped.
6. **Upload PDFs** — uploads compiled main + skeleton PDFs to R2 under `handouts/pdfs/<file>.pdf` (flat layout; every handout's PDFs share one folder)

## Prerequisites

### R2 Credentials

The tool uploads assets to Cloudflare R2. Configure credentials via user secrets (only needed when uploading — use `--skip-upload` to skip):

```bash
cd backend/src/Tools/MathComps.Cli.Handouts
dotnet user-secrets set "CloudflareR2:AccountId" "<your-account-id>"
dotnet user-secrets set "CloudflareR2:BucketName" "<your-bucket-name>"
dotnet user-secrets set "CloudflareR2:AccessKeyId" "<your-access-key>"
dotnet user-secrets set "CloudflareR2:SecretAccessKey" "<your-secret-key>"
```

## How to Run

```bash
cd backend/src/Tools/MathComps.Cli.Handouts
```

### Build All Slovak Handouts

```bash
dotnet run -- *.sk.tex
```

### Build All Locales

```bash
dotnet run -- *.sk.tex *.en.tex *.cs.tex
```

### Build a Single File

```bash
dotnet run -- factorization.sk.tex
```

### Skip Compilation (Parse Only)

```bash
dotnet run -- --skip-compile *.sk.tex
```

### Skip Uploads (No R2 Credentials Needed)

```bash
dotnet run -- --skip-upload *.sk.tex
```

### Skip the Asymptote Figure Refresh

For runs where you trust the on-disk figures (e.g. CI without an Asymptote toolchain), or to shave the per-handout dep scan:

```bash
dotnet run -- --skip-asy *.sk.tex
```

### Force-Recompile Every Figure

Use after editing `Images/_common.asy` in a way that changes how existing figures render (palette tweak, modified helper). Such edits are deliberately not tracked by the dep graph — see [Image pipeline](#image-pipeline-asymptote):

```bash
dotnet run -- --force-asy *.sk.tex
```

### Custom Compiler

```bash
dotnet run -- --compiler pdfcsplain *.sk.tex
```

## Options

| Option           | Default                                              | Description                                                                                       |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `<patterns>`     | required                                             | File pattern(s) to match (e.g. `*.sk.tex`)                                                        |
| `--compiler`     | `pdfcsplain -interaction=nonstopmode -halt-on-error` | TeX compiler command (full string, including flags)                                               |
| `--skip-compile` | `false`                                              | Skip TeX compilation, only parse and upload existing PDFs                                         |
| `--skip-upload`  | `false`                                              | Skip uploading PDFs and images to R2                                                              |
| `--skip-asy`     | `false`                                              | Skip the Asymptote staleness check + recompilation entirely                                       |
| `--force-asy`    | `false`                                              | Recompile every `.asy`-backed figure regardless of staleness (used after a semantic `_common.asy` edit) |
| `--error-log`    | `errors.log`                                         | Path to the error log appended to on compiler failure                                             |

## Image pipeline (Asymptote)

Figures live in `data/handouts/Images/` as `.asy` sources that compile to `.pdf` (consumed by the TeX engine) and `.svg` (consumed by the web frontend). The build wraps two layers around this:

### Staleness check

Before touching the TeX pipeline, the build walks every image the document references and decides per figure whether to recompile:

- If the figure has no sibling `.asy` (externally authored raster/PDF), it's left alone.
- Otherwise the build resolves the figure's transitive dependency set — its own source plus every file pulled in via `import <name>;` or `include "<file>";` — and recompiles when any source is newer than the older of the two compiled outputs (`.pdf` or `.svg` missing also counts as stale).
- `Images/_common.asy` is intentionally **excluded** from the dep graph. Most edits to `_common.asy` are additive helpers that can't affect existing figures, so cascading invalidation across every figure would be pure waste. When a `_common.asy` change *does* alter rendering (palette tweak, modified helper used by existing figures), opt in with `--force-asy`.

Stale figures are batched into a single invocation of `Images/_Export-Asy.ps1` per run, which handles the `asy → PDF` render and the Inkscape `PDF → SVG` conversion.

### Upload ledger

R2 uploads are gated by `data/handouts/.r2-uploads.json` (gitignored). It maps each R2 key to the SVG mtime that was last successfully pushed under that key. On every run:

- An image is pushed only when its current on-disk mtime is newer than the recorded value (or no entry exists).
- After each successful upload the ledger is updated and persisted at the end of the run.

This works the same regardless of how the SVG came to be on disk — pipeline-recompiled, `--force-asy`'d, hand-rendered with `asy`, or generated by another tool. Wiping the ledger forces a fresh upload of everything.

## Deployment Workflow

After running the CLI:

1. **JSONs** are saved to `web/src/content/handouts/` — commit and push to trigger a frontend redeploy
2. **PDFs and images** are uploaded directly to R2 — available immediately, no backend deploy needed

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

1. Create `.tex` files in `data/handouts/` for each locale (e.g. `my-handout.sk.tex`, `my-handout.en.tex`, `my-handout.cs.tex`)
2. Run the build (it automatically discovers and processes new files)
3. Update `web/src/content/handouts.json` with localized `slug`, `title`, and `description`

## Validation

The frontend includes a validation script to ensure all ready handouts have content files for all locales:

```bash
cd web && npm run handouts:validate
```

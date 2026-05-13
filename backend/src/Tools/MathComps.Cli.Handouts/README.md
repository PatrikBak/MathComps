# Handouts CLI

A .NET tool that orchestrates the full handout build pipeline: generates skeleton worksheets, compiles TeX to PDF, parses structured JSON for the frontend, and uploads PDFs and images to Cloudflare R2.

## Pipeline

For each matched `.tex` file, the tool runs these steps in order:

1. **Generate skeleton** — strips solutions/proofs/hints, produces a `-skeleton.tex` worksheet
2. **Compile TeX** — runs the configured compiler (2 passes) on both main + skeleton files
3. **Parse to JSON** — converts the TeX document structure into `RawContentBlock[]` JSON (saved locally to `web/src/content/handouts/`)
4. **Upload images** — processes SVG images and uploads them to R2 under `handouts/<slug>/<image>.svg`, where `<slug>` is the language-stripped handout id (so all language variants share one image set)
5. **Upload PDFs** — uploads compiled main + skeleton PDFs to R2 under `handouts/<slug>/<file>.pdf` (same folder as the images)

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

### Custom Compiler

```bash
dotnet run -- --compiler pdfcsplain *.sk.tex
```

## Options

| Option           | Default      | Description                                             |
| ---------------- | ------------ | ------------------------------------------------------- |
| `<patterns>`     | required     | File pattern(s) to match (e.g. `*.sk.tex`)              |
| `--compiler`     | `pdfcsplain` | TeX compiler command                                    |
| `--skip-compile` | `false`      | Skip TeX compilation, only parse and copy existing PDFs |
| `--skip-upload`  | `false`      | Skip uploading PDFs and images to R2                    |

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

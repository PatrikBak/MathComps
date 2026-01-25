# Handouts Parser CLI

A .NET tool for parsing handout `.tex` files and converting them into structured `.json` files for the frontend. Automatically discovers and processes handouts based on configurable patterns.

## How It Works

The parser converts PlainTex+OpMaC documents into structured JSON format that the frontend can easily render:

1. **Discovers TeX Files**: Automatically finds all `.tex` files matching a pattern (e.g., `*.sk.tex` for Slovak handouts) in the input directory.
2. **Parses Content**: Uses a custom TeX parser to analyze the document's structure, including sections, paragraphs, and custom commands for problems and solutions.
3. **Generates JSON**: Converts the parsed content into structured JSON objects.
4. **Saves Output**: Writes JSON files to the output directory.

The tool includes error handling to report any unknown TeX commands, ensuring handouts only contain things we know we can render parsed correctly.

## How to Run

Navigate to the tool's directory:

```bash
cd backend/src/Tools/MathComps.Cli.Handouts
```

### Process All Slovak Handouts (Default)

```bash
# Processes all *.sk.tex files
dotnet run -- *.sk.tex
```

### Process All English Handouts

```bash
# Processes all *.en.tex files
dotnet run -- *.en.tex
```

### Process All Handouts (Both Locales)

```bash
# Processes all locale files
dotnet run -- *.sk.tex *.en.tex
```

### Test a Single File

```bash
# Process only a specific file
dotnet run -- factorization.sk.tex
```

## File Naming Convention

The tool preserves the original filename structure, only changing the extension:

- `factorization.sk.tex` → `factorization.sk.json`
- `factorization.en.tex` → `factorization.en.json`
- `systems-of-equations.sk.tex` → `systems-of-equations.sk.json`

**Important**: The base filename (before `.{locale}.tex`) must match the `filename` field in `web/src/content/handouts.json`.

## Adding New Handouts

To add a new handout:

1. Create your `.tex` files in `data/handouts/` for each locale:
   - `my-handout.sk.tex` (Slovak version)
   - `my-handout.en.tex` (English version)
2. Run the parser (it will automatically discover and process the new files)
3. The corresponding `.json` files will be created in `web/src/content/handouts/`
4. Update `web/src/content/handouts.json` to reference the new handout with:
   - `filename: "my-handout"` (base name without locale suffix)
   - Localized `slug`, `title`, and `description` fields

The tool automatically discovers and processes new `.tex` files—no configuration changes needed!

## Validation

The frontend includes a validation script that ensures:

- All `ReadyHandout` entries have matching content files for all locales
- All `LocalizedString` fields have values for all supported locales

Run validation from the web directory:

```bash
npm run handouts:validate
```

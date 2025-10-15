# Handouts Parser CLI

A .NET tool for parsing handout `.tex` files and converting them into structured `.json` files for the frontend. Automatically discovers and processes handouts based on configurable patterns.

## How It Works

The parser converts PlainTex+OpMaC documents into structured JSON format that the frontend can easily render:

1. **Discovers TeX Files**: Automatically finds all `.tex` files matching a pattern (e.g., `*-sk.tex` for Slovak handouts) in the input directory.
2. **Parses Content**: Uses a custom TeX parser to analyze the document's structure, including sections, paragraphs, and custom commands for problems and solutions.
3. **Generates JSON**: Converts the parsed content into structured JSON objects.
4. **Saves Output**: Writes JSON files to the output directory (e.g., `algebra-1-rozklady-sk.tex` → `algebra-1-rozklady-sk.json`).

The tool includes error handling to report any unknown TeX commands, ensuring handouts only contain things we know we can render parsed correctly.

## How to Run

Navigate to the tool's directory:

```bash
cd backend/src/Tools/MathComps.Cli.Handouts
```

### Process All Slovak Handouts (Default)

```bash
# Processes all *-sk.tex files
dotnet run -- *-sk.tex
```

### Test a Single File

```bash
# Process only a specific file
dotnet run -- algebra-1-rozklady-sk.tex
```

## File Naming Convention

The tool preserves the original filename structure, only changing the extension:

- `algebra-1-rozklady-sk.tex` → `algebra-1-rozklady-sk.json`
- `algebra-2-sustavy-en.tex` → `algebra-2-sustavy-en.json`

## Adding New Handouts

To add a new handout:

1. Create your `.tex` file in `data/handouts/` (e.g., `nerovnosti-sk.tex`)
2. Run the parser (it will automatically discover and process the new file)
3. The corresponding `.json` file will be created in `web/src/content/handouts/` (e.g., `nerovnosti-sk.json`)
4. Update `web/src/content/handouts/handouts.json` to reference the new handout file

The tool automatically discovers and processes new `.tex` files—no configuration changes needed!

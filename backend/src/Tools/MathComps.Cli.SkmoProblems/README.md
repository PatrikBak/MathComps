# SKMO Problems Parser CLI

This is the foundational data processing tool for the MathComps project. It parses the entire raw archive of `.tex` files from the Slovak Mathematical Olympiad (SKMO) and converts them into a clean, structured JSON format that feeds the rest of the system.

## How It Works

1.  **Parses TeX Archive**: Reads all `.tex` files from `data/skmo/Archive`, which contains many years of SKMO problems.
2.  **Cleans and Renders**: Cleans up raw TeX source code to make it uniform and easier to parse. Optionally generates HTML previews in `data/skmo/HtmlResults` for manual inspection.
3.  **Validates TeX**: Checks for unrecognized TeX commands or KaTeX rendering errors and reports any issues found.
4.  **Generates Final JSON**: Saves the final, clean data into `data/skmo/archive.parsed.json`.

This output file is the primary input for the **Database Seeder**, which populates the application's database.

**Note**: Solutions are not parsed yet. They contain thousands of custom TeX commands that would require extensive mapping work. Perhaps it will be handled later, so far we have solution links.

## How to Run

Navigate to the tool's directory:

```bash
cd backend/src/Tools/MathComps.Cli.SkmoProblems
```

### Default

```bash
dotnet run -c Release
```

Parses all TeX files from scratch and generates the final JSON output. This ensures `archive.parsed.json` reflects any changes in the raw archive, making changes visible in version control.

### With HTML Preview

```bash
# Split by years (one HTML file per olympiad year)
dotnet run -c Release -- --mode SplitByYears

# All in one file (useful for debugging)
dotnet run -c Release -- --mode AllInOneFile
```

### Filter by Specific Years

```bash
# Process only specific years (archive file not updated)
dotnet run -c Release -- --years 72 73 74

# Combine with HTML preview for debugging specific years
dotnet run -c Release -- --years 75 --mode AllInOneFile
```

## Options

- `--mode|-m`: Rendering mode for HTML previews (`NoRendering`, `SplitByYears`, `AllInOneFile`). Default: `NoRendering`
- `--years|-y`: Specific olympiad years to process (e.g., `--years 72 73 74`). When specified, only the selected years are parsed and the archive file is **not** updated.

The tool reports any errors found. If successful, it overwrites `data/skmo/archive.parsed.json` with the latest data (unless `--years` is used).

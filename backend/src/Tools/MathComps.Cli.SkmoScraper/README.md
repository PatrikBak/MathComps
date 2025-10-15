# SKMO Scraper CLI

This tool scrapes solution document links from the Slovak Mathematical Olympiad (SKMO) website and updates the database with them.

## How It Works

The scraper is a two-step process:

1. **Scrape the Website**: Downloads solution links from the SKMO website across multiple years and competition rounds, saving them to a JSON file.
2. **Update the Database**: Reads the JSON file and updates problem records in the database with the corresponding solution links.

## Command Reference

All commands must be run from the tool's directory.

```bash
# Navigate to the tool's directory
cd backend/src/Tools/MathComps.Cli.SkmoScraper
```

### **scrape**

Scrapes the SKMO website for solution document links.

```bash
# Scrape all years starting from year 48 (default)
dotnet run -- scrape

# Specify output file
dotnet run -- scrape --output my-solutions.json

# Scrape specific year range
dotnet run -- scrape --start-year 60 --end-year 75
```

**Options:**

- `-o|--output` – Output JSON file path (default: `skmo-solution-links.json`)
- `--start-year` – First year (ročník) to scrape (default: 48)
- `--end-year` – Last year to scrape (optional, scrapes until no new content if not specified)

### **update-solution-links**

Updates the database with solution links from a scraped JSON file.

```bash
# Update database from scraped data
dotnet run -- update-solution-links
```

**Options:**

- ` -i|--input` – Input JSON file path (default: `skmo-solution-links.json`)

## Setup

Before running the update command, configure your database connection string in user secrets. See the [main backend README](../../../README.md) for setup instructions.

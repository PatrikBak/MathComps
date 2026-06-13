# MathComps AI Tagging Assistant

This CLI tool uses an LLM to help categorize math problems with a structured set of tags. It's a human-in-the-loop system designed to build and apply a high-quality, curated tag vocabulary.

## Architecture

### Tag Storage

- **Slugs only in database**: The `Tag` entity stores only `Slug` (e.g., `mathematical-induction`), not localized names.
- **Localized names in JSON**: `approved-tags.json` defines tags with slugs and localized names (SK, EN, CS).
- **Commands translate**: CLI commands resolve user input (name in any language or slug) → slug for database operations.

### LLM Interaction

- **English-only**: LLMs receive and output **English tag names** (`TagFilesHelper.AiLanguage = Language.EN`).
- **Name↔Slug mapping**: Commands use `TagFilesHelper.GetTagsForAi()` to get `EnglishName → TagData(Slug)` mapping.
- **Workflow**: English names → LLM → English names → map to slugs → database.

### Tag Categories

Tags are organized into four categories:

- **Area** – Mathematical domain (e.g., Algebra, Geometry)
- **Goal** – Problem objective (e.g., Geometric construction, Proof)
- **Type** – Problem structure (e.g., Inequality, System of equations)
- **Technique** – Solution method (e.g., Mathematical Induction) – only for problems with solutions

## How It Works

The tagging process is a workflow that combines AI suggestions with human oversight.

### 1. Define the Official Vocabulary

- All approved tags are stored in `approved-tags.json` (in Infrastructure resources).
- Tags have a slug (e.g., `mathematical-induction`) and localized names.
- This file is the single source of truth, managed by a human, and is version-controlled.

### 2. Brainstorming New Tags with AI

- The `suggest-tags` command is used for that.
- It uses the `Prompts/suggest-tags-prompt` to guide the AI on how to suggest new tags, alongisde with the rules how to suggest tags stored in `Prompts/tag-rules`.
- It sends a batch of problems to the LLM, which brainstorms potential new tags for each category.
- Subsequently, there is a second LLM call with the `Prompts/veto-tags-prompts`
- The suggestions are saved as a JSON file (`suggestedTags.json`) in the `Logs/` folder for a review.

### 3. Curate and Approve Suggestions

- Review the AI's suggestions in the `Logs/suggestedTags.json` file.
- If a suggestion feels right, manually add it to `Data/approved-tags.json`. This ensures a human is always in control of the tag vocabulary.

### 4. Apply Tags with AI Assistance

- The `tag-problems` command applies the official tags to problems.
- For each problem, it sends the text and the _entire list of approved tags_ to the LLM.
- The AI then selects the most appropriate tags from the list. For each of the tags, it assigns a _goodness of fit_ and a justification for that tag. Tags are considered approved if their goodness of fit is at least 0.5, otherwise they are considered rejected.
- **Note**: If a problem has no solution, the AI is forbidden from assigning **Technique** tags.
- You can choose to apply tags only from some subset using the `--tag-selection-file` command line option. This is useful e.g. when re-tagging a select few tags (e.g. you find out the AI doesn't process them well, adjust the description in `approved-tags.json` and want to apply the changes).
- You can use `--clear-mode` to control which tags are cleared before tagging. Options: `None` (default, no clearing), `OnlyAssigned` (clears only tags with GoodnessOfFit >= 0.5), or `AssignedAndUnassigned` (clears all tags completely). If used with `--tag-selection-file`, clears only those tags. (If no tag selection file is provided, it clears _all_ tags.)
- The database stores not only the approved tags, but also the rejected tags. This ensures that the next time `tag-problems` is called, it automatically ignores problems that have all the specified tags already processed. This is useful especially together with `--tag-selection-file`.

### 5. Filter bad AI tags

- The `veto-problem-tags` command can be used to filter out AI derived tags which have poor justification.
- For each problem, it sends the LLM the tags of that problem together with the justification for those
  tags (these have been stored previously during the `tag-problems` command). The LLM then filters out
  those tags where the justification is poor.
- After each use of `veto-problem-tags`, the tags that have been approved (i.e. haven't been rejected)
  by the LLM have their _confidence_ increased by 1. The confidence is essentially a number saying how many
  times a problem-tag assignment survived the vetoing process. The `veto-problem-tags` has a command line option
  that limits the problem-tags considered for vetoing to those with small confidence. (Defaults to max 0 confidence,
  i.e. those tags that haven't been through vetoing process yet.)
- The removed tags are still kept in the database, just their goodness-of-fit is set to 0. This is so that when you later call `tag-problems` (e.g. when new problems are added), it doesn't try to assign the vetoed problem-tags.

### 6. Review, clean up, redo

- The `prune-tags` command helps maintain the vocabulary by removing tags that are rarely used, keeping the system clean and relevant.
- Certain tags are more prone to AI errors than others. It is a good idea to review the AI changes, take note of any error-prone tags, and then redo them: remove the tag from the database (using the interactive tool `clearTag`), then create a tag selection file containing the tags to redo, then run `tag-problems --tag-selection-file <tag-selection-file> ...` again, then run `veto-problem-tags --tag-selection-file <tag-selection-file> ...`.

## Command Reference

All commands must be run from the tool's directory as it uses relative paths to access tag files.

```bash
# Navigate to the tool's directory
cd backend/src/MathComps.Cli.Tagging
```

### **suggest-tags**

Brainstorms new tag ideas based on a sample of problems.

```bash
dotnet run -- suggest-tags --count 15
```

- `--count`: Number of problems to analyze.
- **Output**: Saves suggestions to `Logs/suggestedTags.json`.

### **tag-problems**

Applies the official, approved tags to problems.

```bash
# Process 50 problems
dotnet run -- tag-problems --count 50

# Process with specific tag selection and clear only assigned tags
dotnet run -- tag-problems --count 50 --tag-selection-file tags.txt --clear-mode OnlyAssigned

# Process with specific tag selection and clear all tags completely
dotnet run -- tag-problems --count 50 --tag-selection-file tags.txt --clear-mode AssignedAndUnassigned

# Process with multiple threads for faster execution
dotnet run -- tag-problems --count 50 --num-threads 3

# Preview tagging without making changes (dry run)
dotnet run -- tag-problems --count 10 --dry-run
```

**Options:**

- `-n|--count` – Number of problems to process (required)
- `--tag-selection-file` – Consider only tags listed in the specified file (one tag per line)
- `--clear-mode` – Specifies which tags to clear before tagging: `None` (default, no clearing), `OnlyAssigned` (clears only tags with GoodnessOfFit >= 0.5), or `AssignedAndUnassigned` (clears all tags completely). If used with `--tag-selection-file`, clears only those tags
- `--num-threads` – Number of parallel threads for processing (default: 1). Consider rate limits when setting this
- `--dry-run` – Preview tag suggestions without making any changes to the database

**Note**: The command automatically skips problems that already have all the specified tags assigned, making it efficient to run multiple times without redundant processing.

### **veto-problem-tags**

Filters out AI-derived tags with poor justification by reviewing existing tag assignments.

```bash
# Veto tags with poor justification
dotnet run -- veto-problem-tags --count 50

# Veto only tags with low confidence (default: max confidence 0)
dotnet run -- veto-problem-tags --count 50 --max-confidence 1

# Veto only tags with specific tag selection
dotnet run -- veto-problem-tags --count 50 --tag-selection-file tags.txt

# Veto tags with multiple threads
dotnet run -- veto-problem-tags --count 50 --num-threads 3

# Preview veto decisions without making changes (dry run)
dotnet run -- veto-problem-tags --count 10 --dry-run
```

**Options:**

- `-n|--count` – Number of problems to process (required)
- `--max-confidence` – Only consider tags with confidence less than or equal to this threshold (default: 0)
- `--max-fit` – Only consider tags with goodness of fit less than or equal to this threshold (0-1, default: 1.0)
- `--tag-selection-file` – Veto only tags listed in the specified file (one tag per line)
- `--num-threads` – Number of parallel threads for processing (default: 1). Consider rate limits when setting this
- `--dry-run` – Preview veto decisions without making any changes to the database

### **prune-tags**

Removes tags that are used less than a specified number of times.

```bash
# Preview which tags would be removed if used on 2 or fewer problems
dotnet run -- prune-tags --limit 2 --dry-run

# Execute the removal
dotnet run -- prune-tags --limit 2
```

- `--limit`: The usage threshold. Tags used this many times or fewer will be removed.
- `--dry-run`: Preview the changes without modifying the database.

### **import-tags**

Imports tags from a CSV file, clearing existing tags first and processing in batches. This command is primarily used for batch-exporting tags from local development to production.

```bash
# Import from CSV file
dotnet run -- import-tags Data/import-example.csv

# Import with custom batch size
dotnet run -- import-tags Data/import-example.csv --batch-size 50
```

- `<file-path>`: Path to the CSV file containing tag data
- `--batch-size`: Number of rows to process in each batch (default: 1000)

**CSV Format**: The CSV must have columns: `ProblemSlug`, `TagSlug`, `TagType`, `Confidence`, `GoodnessOfFit`, `Justification`. TagType values should be: `Area`, `Type`, `Technique`, or `Goal`.

**Exporting from Database**: To create the CSV file from an existing database, use this SQL query:

```sql
SELECT p.slug AS "ProblemSlug",
       t.slug AS "TagSlug",
       -- This converts PG snake_case onto C# PascalCase
       replace(initcap(replace(tag_type::text, '_', ' ')), ' ', '') AS "TagType",
       goodness_of_fit AS "GoodnessOfFit",
       confidence AS "Confidence",
       justification AS "Justification"
FROM tags t
JOIN problem_tag pt ON t.id = pt.tag_id
JOIN problems p ON p.id = pt.problem_id
ORDER BY p.id
```

### **interactive**

Starts an interactive session to manually manage tags.

```bash
dotnet run -- interactive
```

**Tag input**: All commands accept tag names in **any language** (SK, EN, CS) or slugs. The tool resolves them to the correct slug automatically.

- **Commands**:

  - `add "<tag>" <problem-slug1> [<problem-slug2> ...]` - Add a tag to one or more problems
  - `remove "<tag>" <problem-slug1> [<problem-slug2> ...]` - Soft-remove a tag from problems (sets goodness-of-fit to 0)
  - `clearTag "<tag>"` - Delete the tag completely from the database
  - `clear <problem-slug>` - Remove all tags from a problem
  - `merge "<tagToDelete>" "<tagToReplace>"` - Merge two tags
  - `list <problem-slug>` - Show all tags assigned to a problem
  - `help` / `exit`

- Note that `clearTag` completely removes the tag from the database (deletes both ProblemTag associations and the Tag entity itself); it _does not_ merely set the goodness-of-fit to 0. This is different from `remove`, which only soft-removes a tag from a single problem.

## Setup

See the [main backend README](../../../README.md) for Gemini API and database setup.

## AI prompts

The prompts that guide the AI are located in the `Prompts/` directory.

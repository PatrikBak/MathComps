# MathComps AI Tagging Assistant

This CLI tool uses an LLM to help categorize math problems with a structured set of tags. It's a human-in-the-loop system designed to build and apply a high-quality, curated tag vocabulary.

## How It Works

The tagging process is a workflow that combines AI suggestions with human oversight.

### 1. Define the Official Vocabulary

- All approved tags are stored in `Data/approved-tags.json`.
- This file is the single source of truth, managed by a human, and is version-controlled.
- Tags are organized into four categories: **Area** (e.g., Algebra), **Goal** (e.g. Geometric construction), **Type** (e.g., Inequality), and **Technique** (e.g., Mathematical Induction).

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
- You can use `--clear-tags` to clear all the tags from the tag selection file before doing the tagging. (If no tag selection file is provided, it clears _all_ tags.)
- The database stores not only the approved tags, but also the rejected tags. This is so that the next time `tag-problems` is called, it ignores problems that have all the tags already processed. This is useful especially together with `--tag-selection-file`.

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
cd backend/src/Tools/MathComps.Cli.Tagging
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

# Process only untagged problems
dotnet run -- tag-problems --count 50 --skip-tagged

# Process with specific tag selection and clear existing tags
dotnet run -- tag-problems --count 50 --tag-selection-file tags.txt --clear-tags

# Process with multiple threads for faster execution
dotnet run -- tag-problems --count 50 --num-threads 3
```

- `--count`: Number of problems to process.
- `--skip-tagged`: Only process problems that have no tags.
- `--tag-selection-file`: Consider only tags listed in the specified file (one tag per line).
- `--clear-tags`: Clear all tags before tagging. If used with `--tag-selection-file`, clears only those tags.
- `--num-threads`: Number of parallel threads for processing (default: 1). Consider rate limits when setting this.

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
```

- `--count`: Number of problems to process.
- `--max-confidence`: Only consider tags with confidence less than or equal to this threshold (default: 0).
- `--max-fit`: Only consider tags with goodness of fit less than or equal to this threshold (0-1, default: 1.0).
- `--tag-selection-file`: Veto only tags listed in the specified file (one tag per line).
- `--num-threads`: Number of parallel threads for processing (default: 1). Consider rate limits when setting this.

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

### **interactive**

Starts an interactive session to manually manage tags.

```bash
dotnet run -- interactive
```

- **Commands**:

  - `add <problem-slug> "<tag-name>" <tag-type>` - Add a tag to a problem (tag-type: area, type, technique, or goal)
  - `remove <problem-slug> "<tag-name>"` - Remove a specific tag from a problem
  - `clearTag "<tag-name>"` - Remove the tag from all problems
  - `clear <problem-slug>` - Remove all tags from a problem
  - `list <problem-slug>` - Show all tags assigned to a problem
  - `help` - Show help information
  - `exit` - Exit the interactive session

- Note that `clearTag` removes the tag from the database; it _does not_ merely set the goodness-of-fit to 0.

## Setup

### Configuration

You'll need to set up Gemeini's API key:

```bash
# In the `backend` directory
cd backend

# Set Gemini API key
dotnet user-secrets set "Gemini:ApiKey" "your-gemini-api-key" --project src/Tools/MathComps.Cli.Tagging
```

For database connection setup, see the [main backend README](../../../README.md) for setup instructions.

### AI Prompts

The prompts that guide the AI are located in the `Prompts/` directory.

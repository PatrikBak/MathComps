# MathComps AI Tagging Assistant

This CLI tool uses an LLM to help categorize math problems with a structured set of tags. It's a human-in-the-loop system designed to build and apply a high-quality, curated tag vocabulary.

## How It Works

The tagging process is a workflow that combines AI suggestions with human oversight.

### 1. Define the Official Vocabulary

- All approved tags are stored in `Data/approved-tags.txt`.
- This file is the single source of truth, managed by a human, and is version-controlled.
- Tags are organized into three categories: **Area** (e.g., Algebra), **Type** (e.g., Inequality), and **Technique** (e.g., Mathematical Induction).

### 2. Brainstorming New Tags with AI

- The `suggest-tags` command is used for that.
- It sends a batch of problems to the LLM, which brainstorms potential new tags for each category.
- The suggestions are saved as timestamped files in `Data/SuggestedTags/` for a review.

### 3. Curate and Approve Suggestions

- Review the AI's suggestions in `Data/SuggestedTags/`.
- If a suggestion feel right, manually add it to `Data/approved-tags.txt`. This ensures a human is always in control of the tag vocabulary.

### 4. Apply Tags with AI Assistance

- The `tag-problems` command applies the official tags to problems.
- For each problem, it sends the text and the _entire list of approved tags_ to the LLM.
- The AI then selects the most appropriate tags from the list.
- **Note**: If a problem has no solution, the AI is forbidden from assigning **Technique** tags.

### 5. Clean Up Unused Tags

- The `prune-tags` command helps maintain the vocabulary by removing tags that are rarely used, keeping the system clean and relevant.

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
- **Output**: Saves suggestions to `Data/SuggestedTags/`.

### **tag-problems**

Applies the official, approved tags to problems.

```bash
# Process 50 problems
dotnet run -- tag-problems --count 50

# Process only untagged problems
dotnet run -- tag-problems --count 50 --skip-tagged
```

- `--count`: Number of problems to process.
- `--skip-tagged`: Only process problems that have no tags.

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

- **Commands**: `remove <problem> <tag>`, `clear <problem>`, `list <problem>`, `help`, `exit`

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

The prompts that guide the AI are located in the `Prompts/` directory:

- `suggest-tags-prompt.txt`: Tells the AI how to brainstorm new tags.
- `tag-problems-prompt.txt`: Tells the AI how to apply existing tags.

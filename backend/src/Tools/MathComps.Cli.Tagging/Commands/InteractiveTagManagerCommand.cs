using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services;
using MathComps.Shared.Cli;
using Spectre.Console;
using System.Collections.Immutable;
using System.ComponentModel;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Provides an interactive command-line interface for manual tag management operations.
/// Offers a REPL-style session allowing real-time tag addition, removal, and clearing without restarting the process.
/// Designed for quick database maintenance tasks where manual tag curation is needed.
/// </summary>
/// <param name="databaseService">Database service providing tag and problem manipulation operations.</param>
/// <param name="problemLookupService">Service for looking up problem information by slug.</param>
[Description("Start an interactive session for manual tag management with add, remove, and clear operations.")]
public class InteractiveTagManagerCommand(
    ITaggingDatabaseService databaseService,
    IProblemLookupService problemLookupService) : InteractiveCommandHelper
{
    /// <inheritdoc/>
    protected override string ApplicationName => "Tag Manager";

    /// <inheritdoc/>
    protected override string ApplicationDescription => "Interactive tag management for MathComps problems";

    /// <inheritdoc/>
    protected override string CommandUsageHint => "Commands: add <slug> \"<tag>\" <type> | remove <slug> \"<tag>\" | clear <slug> | list <slug> | help | exit";

    /// <inheritdoc/>
    protected override async Task HandleCommandAsync(string[] commandParts)
    {
        // Dispatch to specific operation handlers based on command verb.
        switch (commandParts[0].ToLowerInvariant())
        {
            // Add a tag to a problem
            case "add":
                await HandleAdd(commandParts);
                break;

            // Remove a tag from a problem
            case "remove":
                await HandleRemove(commandParts);
                break;

            case "cleartag":
                await HandleClearTag(commandParts);
                break;

            // Clear the tags from a problem
            case "clear":
                await HandleClear(commandParts);
                break;

            // List the tags of a problem
            case "list":
                await HandleList(commandParts);
                break;

            // Show help information
            case "help":
                ShowHelp();
                break;

            default:
                HandleUnknownCommand(commandParts[0]);
                break;
        }
    }

    /// <summary>
    /// Handles the 'add' command to associate a new tag with a specified problem.
    /// Creates the tag if it doesn't exist, using the provided tag type for categorization.
    /// Expected format: add <problem-slug> "<tag-name>" <tag-type>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleAdd(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 4)
            throw new ArgumentException("Add command requires: add <problem-slug> \"<tag-name>\" <tag-type>");

        // Parse args
        var problemSlug = parts[1];
        var tagName = parts[2];
        var tagTypeString = parts[3];

        // Validate and parse tag type against allowed enumeration values.
        if (!Enum.TryParse<TagType>(tagTypeString, ignoreCase: true, out var tagType))
            throw new ArgumentException($"Tag type must be one of: {string.Join(", ", Enum.GetNames<TagType>())}");

        // Retrieve the problem ID for database operations.
        var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

        // Make sure we have it
        if (problemId == null)
        {
            // Log if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");
            return;
        }

        // Construct tag collection in the format expected by the database service.
        // The existing service requires categorized collections rather than individual tags.
        var tagsDict = new Dictionary<string, ProblemTagData>
        {
            [tagName] = new ProblemTagData(tagType, 1.0f)
        };

        // Execute the database update using single-problem operation.
        await databaseService.AddTagsForProblemAsync(problemId.Value, tagsDict.ToImmutableDictionary());

        // Confirm successful operation with clear visual feedback.
        AnsiConsole.MarkupLine($"[green]✓[/] Added [yellow]{Markup.Escape(tagName)}[/] ([dim]{tagType.ToString().ToLower()}[/]) to [cyan]{Markup.Escape(problemSlug)}[/]");
    }

    /// <summary>
    /// Handles the 'remove' command to disassociate a specific tag from a problem.
    /// Removes only the association; the tag remains available for other problems.
    /// Expected format: remove <problem-slug> "<tag-name>"
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleRemove(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 3)
            throw new ArgumentException("Remove command requires: remove <problem-slug> \"<tag-name>\"");

        // Parse args
        var problemSlug = parts[1];
        var tagName = parts[2];

        // Retrieve the problem ID for database operations.
        var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

        // Make sure we have it
        if (problemId == null)
        {
            // Log if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");

            return;
        }

        // Execute tag removal through direct database service call.
        await databaseService.RemoveSpecificTagFromProblemAsync(problemId.Value, tagName);

        // Confirm successful operation with clear visual feedback.
        AnsiConsole.MarkupLine($"[green]✓[/] Removed [yellow]{Markup.Escape(tagName)}[/] from [cyan]{Markup.Escape(problemSlug)}[/]");
    }

    /// <summary>
    /// Handles the 'clearTag' command to disassociate a specific tag from all problems.
    /// Expected format: clearTag "<tag-name>"
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleClearTag(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 2)
            throw new ArgumentException("Remove command requires: clearTag \"<tag-name>\"");

        // Parse args
        var tagName = parts[1];

        // Load usage for all tags; this is our decision surface.
        var usages = await databaseService.GetAllTagUsageAsync();
        var usage = usages.FirstOrDefault(u => u.Name == tagName);
        if (usage is null)
        {
            AnsiConsole.MarkupLine($"[red]Tag not found:[/] {Markup.Escape(tagName)}");
            return;
        }

        await databaseService.RemoveTagFromAllProblemsAsync(usage.Id);
        AnsiConsole.MarkupLine($"[green]✓[/] Removed [yellow]{Markup.Escape(tagName)}[/] from {usage.ProblemCount} problems");
    }

    /// <summary>
    /// Handles the 'clear' command to remove all tags from a specified problem.
    /// This is a bulk operation that removes all tag associations for the problem.
    /// Expected format: clear <problem-slug>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleClear(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 2)
            throw new ArgumentException("Clear command requires: clear <problem-slug>");

        // The problem slug comes first
        var problemSlug = parts[1];

        // Retrieve the problem ID for database operations.
        var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

        // Make sure we have it
        if (problemId == null)
        {
            // Log if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");

            return;
        }

        await databaseService.ClearTagsForProblemAsync(problemId.Value);

        // Confirm successful operation with clear visual feedback.
        AnsiConsole.MarkupLine($"[green]✓[/] Cleared all tags from [cyan]{Markup.Escape(problemSlug)}[/]");
    }

    /// <summary>
    /// Handles the 'list' command to display all current tags for a specified problem.
    /// Provides visibility into the current tagging state for verification and planning.
    /// Expected format: list <problem-slug>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleList(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 2)
            throw new ArgumentException("List command requires: list <problem-slug>");

        // The problem slug comes first
        var problemSlug = parts[1];

        // Retrieve the problem ID for database operations.
        var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

        // Make sure we have it
        if (problemId == null)
        {
            // Log if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");

            return;
        }

        // Retrieve current tags for the problem from the database service.
        var tagCollection = await databaseService.GetTagsForProblemAsync(problemId.Value);
        var tagsByCategory = tagCollection.GroupBy(kv => kv.Value.TagType)
            .ToImmutableDictionary(g => g.Key, g => g.ToImmutableDictionary(kv => kv.Key, kv => kv.Value));

        // Display the tags organized by category for clear presentation.
        AnsiConsole.MarkupLine($"[bold]Tags for problem [cyan]{Markup.Escape(problemSlug)}[/]:[/]");

        foreach (var kv0 in tagsByCategory)
        {
            AnsiConsole.MarkupLine($"  [dim]{kv0.Key}:[/]");
            foreach (var kv in kv0.Value)
            {
                AnsiConsole.MarkupLine($"    [green]{kv.Key}[/] (\"{kv.Value.Justification}\", GoodnessOfFit = {kv.Value.GoodnessOfFit})");
            }
        }

        // If no tags were found, show appropriate message.
        if (tagCollection.Count == 0)
            AnsiConsole.MarkupLine("  [dim]No tags assigned[/]");

    }

    /// <inheritdoc/>
    protected override void ShowHelp()
    {
        AnsiConsole.MarkupLine("[bold]Available Commands:[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]add[/] <problem-slug> \"<tag-name>\" <tag-type>");
        AnsiConsole.MarkupLine("  Add a tag to a problem. Tag type must be: area, type, or technique");
        AnsiConsole.MarkupLine("  Example: [dim]add csmo-2023-a-1 \"Number Theory\" area[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]remove[/] <problem-slug> \"<tag-name>\"");
        AnsiConsole.MarkupLine("  Remove a specific tag from a problem");
        AnsiConsole.MarkupLine("  Example: [dim]remove csmo-2023-a-1 \"Geometry\"[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]clear[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Remove all tags from a problem");
        AnsiConsole.MarkupLine("  Example: [dim]clear csmo-2023-a-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]clearTag[/] <tag-name>");
        AnsiConsole.MarkupLine("  Remove the tag from all problems");
        AnsiConsole.MarkupLine("  Example: [dim]clearTag \"Teória kúzel\"[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]list[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Show all tags currently assigned to a problem");
        AnsiConsole.MarkupLine("  Example: [dim]list csmo-2023-a-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]help[/]");
        AnsiConsole.MarkupLine("  Show this help information");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]exit[/]");
        AnsiConsole.MarkupLine("  Exit the interactive session");
        AnsiConsole.MarkupLine("");
    }
}

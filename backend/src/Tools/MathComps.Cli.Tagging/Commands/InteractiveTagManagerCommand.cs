using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
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

            // Merge two tags by replacing one with another
            case "merge":
                await HandleMerge(commandParts);
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
    /// Gets tag usage information by name, logging an error message if the tag doesn't exist.
    /// </summary>
    /// <param name="tagName">The name of the tag to find.</param>
    /// <returns>The tag usage DTO if the tag exists, null otherwise.</returns>
    private async Task<TagUsageDto?> GetTagUsageAsync(string tagName)
    {
        // Find all tag usages to get its ID
        var usage = (await databaseService.GetAllTagUsageAsync())
            // So we can find the current one
            .FirstOrDefault(usage => usage.Name == tagName);

        // Make aware if we don't have it
        if (usage is null)
            AnsiConsole.MarkupLine($"[red]Tag not found:[/] {Markup.Escape(tagName)}");

        // Return what we have, might be null
        return usage;
    }

    /// <summary>
    /// Handles the 'add' command to associate a new tag with one or more problems.
    /// The tag type is automatically derived from the approved tags file.
    /// Expected format: add "<tag-name>" <problem-slug1> [<problem-slug2> ...]
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleAdd(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length < 3)
            throw new ArgumentException("Add command requires: add \"<tag-name>\" <problem-slug1> [<problem-slug2> ...]");

        // Parse args - tag name comes first, followed by one or more problem slugs
        var tagName = parts[1];
        var problemSlugs = parts.Skip(2).ToArray();

        // Look up the tag in approved tags to get its type
        if (!TagFilesHelper.GetCategorizedApprovedTags().MapTagsToTheirData().TryGetValue(tagName, out var tagData))
        {
            // Log error if tag is not found in approved tags
            AnsiConsole.MarkupLine($"[red]Tag not found in approved tags:[/] {Markup.Escape(tagName)}");
            AnsiConsole.MarkupLine("[dim]Tags must be added to Data/approved-tags.json before they can be assigned to problems.[/]");
            return;
        }

        // Adding will be one by one
        foreach (var problemSlug in problemSlugs)
        {
            // Retrieve the problem ID for database operations.
            var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

            // Make sure we have it
            if (problemId == null)
            {
                // Log and continue to next problem
                AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");
                continue;
            }

            // Construct tag collection in the format expected by the database service.
            // The existing service requires categorized collections rather than individual tags.
            var tags = new Dictionary<string, ProblemTagData>
            {
                // Manual tags gets the best fit
                [tagName] = new ProblemTagData(tagData.Type, 1.0f)
            };

            // Execute the database update using single-problem operation.
            await databaseService.AddTagsForProblemAsync(problemId.Value, tags.ToImmutableDictionary());

            // Log success
            AnsiConsole.MarkupLine(
                $"[green]✓[/] Added [yellow]{Markup.Escape(tagName)}[/] " +
                $"([dim]{tagData.Type.ToString().ToLower()}[/])" +
                $" to [cyan]{Markup.Escape(problemSlug)}[/]"
            );
        }
    }

    /// <summary>
    /// Handles the 'remove' command to disassociate a specific tag from one or more problems.
    /// Removes only the association; the tag remains available for other problems.
    /// Expected format: remove "<tag-name>" <problem-slug1> [<problem-slug2> ...]
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleRemove(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length < 3)
            throw new ArgumentException("Remove command requires: remove \"<tag-name>\" <problem-slug1> [<problem-slug2> ...]");

        // Parse args - tag name comes first, followed by one or more problem slugs
        var tagName = parts[1];
        var problemSlugs = parts.Skip(2).ToArray();

        // Removing will be one by one
        foreach (var problemSlug in problemSlugs)
        {
            // Retrieve the problem ID for database operations.
            var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

            // Make sure we have it
            if (problemId == null)
            {
                // Log and continue to next problem
                AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");
                continue;
            }

            // Check if the tag actually exists on this problem before attempting removal.
            if (!(await databaseService.GetTagsForProblemAsync(problemId.Value)).ContainsKey(tagName))
            {
                // Log error if tag doesn't exist on this problem and continue to next problem
                AnsiConsole.MarkupLine(
                    $"[yellow]{Markup.Escape(tagName)}[/] " +
                    $"is not assigned to [cyan]{Markup.Escape(problemSlug)}[/]"
                );
                continue;
            }

            // Execute tag removal through direct database service call.
            await databaseService.RemoveSpecificTagFromProblemAsync(problemId.Value, tagName);

            // Confirm successful operation with clear visual feedback.
            AnsiConsole.MarkupLine($"[green]✓[/] Removed [yellow]{Markup.Escape(tagName)}[/] from [cyan]{Markup.Escape(problemSlug)}[/]");
        }
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

        // Get the tag data from the DB
        var usage = await GetTagUsageAsync(tagName);

        // Ensure we have the tag
        if (usage is null)
            return;

        // Do the removal (completely remove tags from database)
        await databaseService.RemoveProblemTagsAsync([usage.Name], onlyAssigned: false);

        // Log with the numbers of affected problems
        AnsiConsole.MarkupLine(
            $"[green]✓[/] Removed [yellow]{Markup.Escape(tagName)}[/] from {usage.ProblemCount} problems"
        );
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
            // Log and quit if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");
            return;
        }

        // Do the update
        await databaseService.ClearTagsForProblemAsync(problemId.Value);

        // Confirm successful operation with clear visual feedback.
        AnsiConsole.MarkupLine($"[green]✓[/] Cleared all tags from [cyan]{Markup.Escape(problemSlug)}[/]");
    }

    /// <summary>
    /// Handles the 'merge' command to merge two tags by replacing all occurrences of one tag with another.
    /// For each problem that has tagToDelete, assigns tagToReplace, then removes tagToDelete.
    /// Expected format: merge "<tagToDelete>" "<tagToReplace>"
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleMerge(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 3)
            throw new ArgumentException("Merge command requires: merge \"<tagToDelete>\" \"<tagToReplace>\"");

        // Parse args
        var tagToDelete = parts[1];
        var tagToReplace = parts[2];

        // The tag must exist
        if (await GetTagUsageAsync(tagToDelete) is null)
            return;

        // Perform the merge in a single database operation
        var processedCount = await databaseService.MergeTagsAsync(tagToDelete, tagToReplace);

        // If no problems were updated, inform user
        if (processedCount == 0)
        {
            // Log and quit if we don't
            AnsiConsole.MarkupLine($"[yellow]No problems found with tag:[/] {Markup.Escape(tagToDelete)}");
            return;
        }

        // Log success with details
        AnsiConsole.MarkupLine(
            $"[green]✓[/] Merged [yellow]{Markup.Escape(tagToDelete)}[/] into [yellow]{Markup.Escape(tagToReplace)}[/] " +
            $"on {processedCount} problem{(processedCount == 1 ? "" : "s")}"
        );
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
            // Log and quit if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");
            return;
        }

        // Ge the tags for the problem
        var tagsByCategory = (await databaseService.GetTagsForProblemAsync(problemId.Value))
            // Group by type...
            .GroupBy(pair => pair.Value.TagType)
            // So we can map from type...
            .ToImmutableDictionary(group => group.Key,
                // To a dictionary mapping name to the data with AI's metadata
                group => group.ToImmutableDictionary(pair => pair.Key, pair => pair.Value));

        // Log the problem
        AnsiConsole.MarkupLine($"[bold]Tags for problem [cyan]{Markup.Escape(problemSlug)}[/]:[/]");
        AnsiConsole.WriteLine();

        // Log each tag
        foreach (var (tagType, tags) in tagsByCategory)
        {
            // Log the tag type
            AnsiConsole.MarkupLine($"  [yellow bold]{tagType}[/]");

            // Log each tag under the type
            foreach (var (tag, (_, goodnessOfFit, justification, _)) in tags)
            {
                // Log the tag name and metadata
                AnsiConsole.MarkupLine($"    [green]{tag}[/]");
                AnsiConsole.Markup($"      [blue]Fit:[/] [cyan]{goodnessOfFit}[/]");

                // Create paragraph with "Reason:" prefix included, padded to align under the tag name.
                var reasonContent = new Markup($"[blue]Reason:[/] [grey]{justification}[/]");
                var paddedReason = new Padder(reasonContent).PadLeft(6);

                // Write it out
                AnsiConsole.Write(paddedReason);
            }
        }

        // If no tags were found, show appropriate message.
        if (tagsByCategory.Count == 0)
            AnsiConsole.MarkupLine("  [dim]No tags assigned[/]");
    }

    /// <inheritdoc/>
    protected override void ShowHelp()
    {
        AnsiConsole.MarkupLine("[bold]Available Commands:[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]add[/] \"<tag-name>\" <problem-slug1> [<problem-slug2> ...]");
        AnsiConsole.MarkupLine("  Add a tag to one or more problems. Tag type is automatically derived from approved tags.");
        AnsiConsole.MarkupLine("  Example: [dim]add \"Kombinatorická geometria\" 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("  Example: [dim]add \"Kombinatorická geometria\" 75-csmo-a-i-1 75-csmo-a-i-2 75-csmo-a-i-3[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]remove[/] \"<tag-name>\" <problem-slug1> [<problem-slug2> ...]");
        AnsiConsole.MarkupLine("  Remove a specific tag from one or more problems");
        AnsiConsole.MarkupLine("  Example: [dim]remove \"Geometria\" 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("  Example: [dim]remove \"Geometria\" 75-csmo-a-i-1 75-csmo-a-i-2 75-csmo-a-i-3[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]clear[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Remove all tags from a problem");
        AnsiConsole.MarkupLine("  Example: [dim]clear 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]clearTag[/] \"<tag-name>\"");
        AnsiConsole.MarkupLine("  Remove the tag from all problems");
        AnsiConsole.MarkupLine("  Example: [dim]clearTag \"Teória kúziel\"[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]merge[/] \"<tagToDelete>\" \"<tagToReplace>\"");
        AnsiConsole.MarkupLine("  Merge two tags by replacing all occurrences of tagToDelete with tagToReplace");
        AnsiConsole.MarkupLine("  Example: [dim]merge \"Old Tag\" \"New Tag\"[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]list[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Show all tags currently assigned to a problem");
        AnsiConsole.MarkupLine("  Example: [dim]list 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]help[/]");
        AnsiConsole.MarkupLine("  Show this help information");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]exit[/]");
        AnsiConsole.MarkupLine("  Exit the interactive session");
        AnsiConsole.MarkupLine("");
    }
}

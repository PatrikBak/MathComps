using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Shared.Cli;
using Spectre.Console;
using System.Collections.Immutable;
using System.ComponentModel;
using System.Diagnostics.CodeAnalysis;
using static Spectre.Console.Markup;

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
    /// <summary>
    /// Lazy-loaded tag lookup index for resolving tag names/slugs to canonical data.
    /// </summary>
    private readonly Lazy<ImmutableDictionary<string, TagData>> _tagLookup =
        new(TagFilesHelper.GetTagLookupIndex);

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
    /// Resolves a tag input (name in any language or slug) to its canonical data.
    /// Logs an error if the tag is not found in approved tags.
    /// </summary>
    /// <param name="tagInput">The tag name or slug to resolve.</param>
    /// <param name="tagData">The resolved tag data, or null if not found.</param>
    /// <param name="context">Optional context for the error message (e.g., "to delete", "target").</param>
    /// <returns>True if the tag was found, false otherwise.</returns>
    private bool TryResolveTag(string tagInput, [NotNullWhen(true)] out TagData? tagData, string? context = null)
    {
        // Try to get the data for the tag
        if (_tagLookup.Value.TryGetValue(tagInput, out tagData))
            return true;

        // If not found, log an error
        AnsiConsole.MarkupLine(
            $"[red]Tag{(context != null ? $" {context}" : "")} not found" +
            $" in approved tags:[/] {Escape(tagInput)}");

        return false;
    }

    /// <summary>
    /// Gets tag usage information by name or slug, logging an error message if the tag doesn't exist.
    /// </summary>
    /// <param name="tagInput">The name (in any language) or slug of the tag to find.</param>
    /// <returns>The tag usage DTO if the tag exists, null otherwise.</returns>
    private async Task<TagUsageDto?> GetTagUsageAsync(string tagInput)
    {
        // First, resolve the input to a slug
        if (!TryResolveTag(tagInput, out var tagData))
            return null;

        // Find the usage by the resolved slug
        var usage = (await databaseService.GetAllTagUsageAsync())
            .FirstOrDefault(usage => usage.Slug == tagData.Slug);

        // Make aware if we don't have it in the database
        if (usage is null)
            AnsiConsole.MarkupLine($"[red]Tag not found:[/] {Escape(tagInput)} (slug: {tagData.Slug})");

        // Return what we have, might be null
        return usage;
    }

    /// <summary>
    /// Handles the 'add' command to associate a new tag with one or more problems.
    /// The tag type is automatically derived from the approved tags file.
    /// Expected format: <c>add "&lt;tag-name&gt;" &lt;problem-slug1&gt; [&lt;problem-slug2&gt; ...]</c>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleAdd(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length < 3)
            throw new ArgumentException("Add command requires: add \"<tag-name>\" <problem-slug1> [<problem-slug2> ...]");

        // Parse args - tag name comes first, followed by one or more problem slugs
        var tagInput = parts[1];
        var problemSlugs = parts.Skip(2).ToArray();

        // Look up the tag (accepts names in any language or slugs)
        if (!TryResolveTag(tagInput, out var tagData))
        {
            AnsiConsole.MarkupLine("[dim]We can only add approved tags to problems.[/]");
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
                AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Escape(problemSlug)}");
                continue;
            }

            // Construct tag collection in the format expected by the database service.
            // The existing service requires categorized collections rather than individual tags.
            var tags = new Dictionary<string, ProblemTagData>
            {
                // Manual tags gets the best fit
                [tagData.Slug] = new ProblemTagData(tagData.Type, 1.0f)
            };

            // Execute the database update using single-problem operation.
            await databaseService.AddTagsForProblemAsync(problemId.Value, tags.ToImmutableDictionary());

            // Log success (show original input for user clarity)
            AnsiConsole.MarkupLine(
                $"[green]✓[/] Added [yellow]{Escape(tagInput)}[/] " +
                $"([dim]{tagData.Type.ToString().ToLower()}[/])" +
                $" to [cyan]{Escape(problemSlug)}[/]"
            );
        }
    }

    /// <summary>
    /// Handles the 'remove' command to disassociate a specific tag from one or more problems.
    /// Removes only the association; the tag remains available for other problems.
    /// Expected format: <c>remove "&lt;tag-name&gt;" &lt;problem-slug1&gt; [&lt;problem-slug2&gt; ...]</c>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleRemove(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length < 3)
            throw new ArgumentException("Remove command requires: remove \"<tag-name>\" <problem-slug1> [<problem-slug2> ...]");

        // Parse args - tag name comes first, followed by one or more problem slugs
        var tagInput = parts[1];
        var problemSlugs = parts.Skip(2).ToArray();

        // Resolve the input to a slug
        if (!TryResolveTag(tagInput, out var tagData))
            return;

        // Removing will be one by one
        foreach (var problemSlug in problemSlugs)
        {
            // Retrieve the problem ID for database operations.
            var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

            // Make sure we have it
            if (problemId == null)
            {
                // Log and continue to next problem
                AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Escape(problemSlug)}");
                continue;
            }

            // Check if the tag actually exists on this problem before attempting removal
            if (!(await databaseService.GetTagsForProblemAsync(problemId.Value)).ContainsKey(tagData.Slug))
            {
                // Log error if tag doesn't exist on this problem and continue to next problem
                AnsiConsole.MarkupLine(
                    $"[yellow]{Escape(tagInput)}[/] " +
                    $"is not assigned to [cyan]{Escape(problemSlug)}[/]"
                );
                continue;
            }

            // Execute tag removal through direct database service call
            await databaseService.RemoveSpecificTagFromProblemAsync(problemId.Value, tagData.Slug);

            // Confirm successful operation with clear visual feedback.
            AnsiConsole.MarkupLine(
                $"[green]✓[/] Removed [yellow]{Escape(tagInput)}[/] from " +
                $"[cyan]{Escape(problemSlug)}[/]");
        }
    }

    /// <summary>
    /// Handles the 'clearTag' command to disassociate a specific tag from all problems.
    /// Expected format: <c>clearTag "&lt;tag-name&gt;"</c>
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
        await databaseService.RemoveProblemTagsAsync([usage.Slug], onlyAssigned: false);

        // Log with the numbers of affected problems
        AnsiConsole.MarkupLine(
            $"[green]✓[/] Removed [yellow]{Escape(tagName)}[/] from {usage.ProblemCount} problems"
        );
    }

    /// <summary>
    /// Handles the 'clear' command to remove all tags from a specified problem.
    /// This is a bulk operation that removes all tag associations for the problem.
    /// Expected format: <c>clear &lt;problem-slug&gt;</c>
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

        // Make sure we have it, quit if not
        if (problemId == null)
        {
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Escape(problemSlug)}");
            return;
        }

        // Do the update
        await databaseService.ClearTagsForProblemAsync(problemId.Value);

        // Confirm successful
        AnsiConsole.MarkupLine($"[green]✓[/] Cleared all tags from [cyan]{Escape(problemSlug)}[/]");
    }

    /// <summary>
    /// Handles the 'merge' command to merge two tags by replacing all occurrences of one tag with another.
    /// For each problem that has tagToDelete, assigns tagToReplace, then removes tagToDelete.
    /// Expected format: <c>merge "&lt;tagToDelete&gt;" "&lt;tagToReplace&gt;"</c>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleMerge(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 3)
            throw new ArgumentException("Merge command requires: merge \"<tagToDelete>\" \"<tagToReplace>\"");

        // Parse args
        var tagToDeleteInput = parts[1];
        var tagToReplaceInput = parts[2];

        // Ensure both tags are approved
        if (!TryResolveTag(tagToDeleteInput, out var tagToDelete, "to delete") ||
            !TryResolveTag(tagToReplaceInput, out var tagToReplace, "target"))
        {
            return;
        }

        // Perform the merge in a single database operation (using slugs)
        var processedCount = await databaseService.MergeTagsAsync(
            tagToDelete.Slug,
            tagToReplace.Slug
        );

        // If no problems were updated, inform user
        if (processedCount == 0)
        {
            AnsiConsole.MarkupLine($"[yellow]No problems found with tag:[/] {Escape(tagToDeleteInput)}");
            return;
        }

        // Log success with details
        AnsiConsole.MarkupLine(
            $"[green]✓[/] Merged [yellow]{Escape(tagToDeleteInput)}[/] " +
            $"into [yellow]{Escape(tagToReplaceInput)}[/] " +
            $"on {processedCount} problem{(processedCount == 1 ? "" : "s")}"
        );
    }

    /// <summary>
    /// Handles the 'list' command to display all current tags for a specified problem.
    /// Provides visibility into the current tagging state for verification and planning.
    /// Expected format: <c>list &lt;problem-slug&gt;</c>
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
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Escape(problemSlug)}");
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
        AnsiConsole.MarkupLine($"[bold]Tags for problem [cyan]{Escape(problemSlug)}[/]:[/]");
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
        AnsiConsole.MarkupLine("[dim]All commands accept tag names in any language (SK, EN, CS) or slugs.[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]add[/] \"<tag>\" <problem-slug1> [<problem-slug2> ...]");
        AnsiConsole.MarkupLine("  Add a tag to one or more problems");
        AnsiConsole.MarkupLine("  Example: [dim]add \"Kombinatorická geometria\" 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("  Example: [dim]add \"combinatorial-geometry\" 75-csmo-a-i-1 75-csmo-a-i-2[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]remove[/] \"<tag>\" <problem-slug1> [<problem-slug2> ...]");
        AnsiConsole.MarkupLine("  Soft-remove a tag from problems (sets goodness-of-fit to 0)");
        AnsiConsole.MarkupLine("  Example: [dim]remove \"Geometria\" 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]clearTag[/] \"<tag>\"");
        AnsiConsole.MarkupLine("  Delete the tag completely from the database");
        AnsiConsole.MarkupLine("  Example: [dim]clearTag \"Teória kúziel\"[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]clear[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Remove all tags from a problem");
        AnsiConsole.MarkupLine("  Example: [dim]clear 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]merge[/] \"<tagToDelete>\" \"<tagToReplace>\"");
        AnsiConsole.MarkupLine("  Merge two tags by replacing all occurrences of tagToDelete with tagToReplace");
        AnsiConsole.MarkupLine("  Example: [dim]merge \"Old Tag\" \"New Tag\"[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]list[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Show all tags assigned to a problem");
        AnsiConsole.MarkupLine("  Example: [dim]list 75-csmo-a-i-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]help[/] / [cyan]exit[/]");
        AnsiConsole.MarkupLine("");
    }
}

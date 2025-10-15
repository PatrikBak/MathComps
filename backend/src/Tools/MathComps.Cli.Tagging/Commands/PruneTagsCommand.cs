using MathComps.Cli.Tagging.Services;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Removes low-usage tags completely from the database, including all their associations.
/// This helps reduce noise in filtering by eliminating tags that provide little value.
/// </summary>
/// <param name="databaseService">Database abstraction for querying usage and deleting tags.</param>
[Description("Remove tags used by at most N problems completely from the database.")]
public class PruneTagsCommand(ITaggingDatabaseService databaseService) : AsyncCommand<PruneTagsCommand.Settings>
{
    /// <summary>
    /// The command arguments
    /// </summary>
    public class Settings : CommandSettings
    {
        [CommandOption("-n|--limit")]
        [Description("Tags used by at most this many problems will be deleted from the database.")]
        public required int Limit { get; set; }

        [CommandOption("--dry-run")]
        [Description("Do not write changes; only print tags that would be deleted and counts.")]
        public bool DryRun { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        #region Find candidates

        // Load usage for all tags; this is our decision surface.
        var usages = await databaseService.GetAllTagUsageAsync();

        // Target only low-signal tags to reduce filter noise.
        var candidates = usages.Where(usage => usage.ProblemCount <= settings.Limit).ToList();

        // If all tags gud
        if (candidates.Count == 0)
        {
            // Make aware
            AnsiConsole.MarkupLine("[yellow]No tags meet the deletion criteria.[/]");

            // Nothing to do
            return 0;
        }

        #endregion

        #region Table

        // Show a compact summary before any changes including tag categorization.
        var table = new Table()
            .AddColumn("Tag")
            .AddColumn("Type")
            .AddColumn("Slug")
            .AddColumn("Problems");

        // Include all candidates with their tag types for better context
        foreach (var usage in candidates)
            table.AddRow(
                usage.Name,
                usage.TagType.ToString(),
                usage.Slug,
                usage.ProblemCount.ToString()
            );

        // Show the table
        AnsiConsole.Write(table);

        #endregion

        // If dry-running...
        if (settings.DryRun)
        {
            // Make aware
            AnsiConsole.MarkupLine($"[yellow]Dry-run:[/] Would delete [bold]{candidates.Count}[/] tags.");

            // We're done
            return 0;
        }

        #region Deletion

        // Handle each usage
        foreach (var usage in candidates)
            await databaseService.RemoveTagFromAllProblemsAsync(usage.Id);

        // Log success
        AnsiConsole.MarkupLine($"[green]Deleted {candidates.Count} tags.[/]");

        // We're done
        return 0;

        #endregion
    }
}



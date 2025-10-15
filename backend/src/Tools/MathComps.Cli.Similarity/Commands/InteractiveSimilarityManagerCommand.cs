using MathComps.Cli.Similarity.Services;
using MathComps.Infrastructure.Services;
using MathComps.Shared.Cli;
using Spectre.Console;
using System.ComponentModel;

namespace MathComps.Cli.Similarity.Commands;

/// <summary>
/// Provides an interactive command-line interface for manual similarity relationship management.
/// Offers a REPL-style session allowing real-time similarity removal and clearing
/// without restarting the process. Designed for quick database maintenance tasks where
/// manual similarity curation is needed to remove incorrect or unwanted relationships.
/// </summary>
/// <param name="databaseService">Database service providing similarity and problem manipulation operations.</param>
/// <param name="problemLookupService">Service for looking up problem information by slug.</param>
[Description("Start an interactive session for manual similarity management with remove and clear operations.")]
public class InteractiveSimilarityManagerCommand(
    ISimilarityDatabaseService databaseService,
    IProblemLookupService problemLookupService) : InteractiveCommandHelper
{
    /// <inheritdoc/>
    protected override string ApplicationName => "Similarity Manager";

    /// <inheritdoc/>
    protected override string ApplicationDescription => "Interactive similarity management for MathComps problems";

    /// <inheritdoc/>
    protected override string CommandUsageHint => "Commands: remove <source-slug> <target-slug> | clear <source-slug> | list <slug> | help | exit";

    /// <inheritdoc/>
    protected override async Task HandleCommandAsync(string[] commandParts)
    {
        // Dispatch to specific operation handlers based on command verb.
        switch (commandParts[0].ToLowerInvariant())
        {
            // Remove a similarity relationship between two problems
            case "remove":
                await HandleRemove(commandParts);
                break;

            // Clear all similarity relationships for a problem
            case "clear":
                await HandleClear(commandParts);
                break;

            // List similarity relationships for a problem
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
    /// Handles the 'remove' command to delete a similarity relationship between two problems.
    /// Removes only the relationship in the specified direction.
    /// Expected format: remove <source-problem-slug> <target-problem-slug>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleRemove(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 3)
            throw new ArgumentException("Remove command requires: remove <source-problem-slug> <target-problem-slug>");

        // Parse arguments
        var sourceProblemSlug = parts[1];
        var targetProblemSlug = parts[2];

        // Retrieve problem IDs for database operations.
        var sourceProblemId = await problemLookupService.GetProblemIdBySlugAsync(sourceProblemSlug);
        var targetProblemId = await problemLookupService.GetProblemIdBySlugAsync(targetProblemSlug);

        // Validate first problem exists
        if (sourceProblemId == null)
        {
            // Make aware if not
            AnsiConsole.MarkupLine($"[red]Source problem not found:[/] {Markup.Escape(sourceProblemSlug)}");
            return;
        }

        // Validate target problem exists
        if (targetProblemId == null)
        {
            // Make aware if not
            AnsiConsole.MarkupLine($"[red]Target problem not found:[/] {Markup.Escape(targetProblemSlug)}");
            return;
        }

        // Get existing similarity relationships for the source problem.
        var existingSimilarities = await databaseService.GetExistingSimilaritiesAsync(sourceProblemId.Value);

        // Find the specific similarity relationship to remove.
        var relationshipToRemove = existingSimilarities.FirstOrDefault(similarity => similarity.TargetProblemId == targetProblemId.Value);

        // Make sure anything to remove
        if (relationshipToRemove == null)
        {
            // Make aare if not
            AnsiConsole.MarkupLine($"[yellow]No similarity relationship found between {Markup.Escape(sourceProblemSlug)} and {Markup.Escape(targetProblemSlug)}.[/]");
            return;
        }

        // Remove the similarity relationship by creating a new list without it.
        var updatedSimilarities = existingSimilarities
            .Where(similarity => similarity.TargetProblemId != targetProblemId.Value)
            .ToArray();

        // Do the DB update
        await databaseService.StoreSimilarityResultsAsync(sourceProblemId.Value, updatedSimilarities);

        // Confirm successful operation with clear visual feedback.
        AnsiConsole.MarkupLine($"[green]✓[/] Removed similarity relationship: [cyan]{Markup.Escape(sourceProblemSlug)}[/] → [cyan]{Markup.Escape(targetProblemSlug)}[/]");
    }

    /// <summary>
    /// Handles the 'clear' command to remove all similarity relationships for a problem.
    /// This removes all outgoing similarity links from the specified problem.
    /// Expected format: clear <problem-slug>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleClear(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 2)
            throw new ArgumentException("Clear command requires: clear <problem-slug>");

        // Parse argument
        var problemSlug = parts[1];

        // Retrieve problem ID for database operations.
        var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

        // Validate that the problem exists.
        if (problemId == null)
        {
            // Make aware if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");
            return;
        }

        // Get existing similarity relationships for the problem.
        var existingSimilarities = await databaseService.GetExistingSimilaritiesAsync(problemId.Value);

        // Handle when there's none
        if (existingSimilarities.Count == 0)
        {
            // Make aware if not
            AnsiConsole.MarkupLine($"[yellow]No similarity relationships found for {Markup.Escape(problemSlug)}.[/]");
            return;
        }

        // Clear all similarity relationships by storing an empty list.
        await databaseService.StoreSimilarityResultsAsync(problemId.Value, []);

        // Confirm successful operation with clear visual feedback.
        AnsiConsole.MarkupLine($"[green]✓[/] Cleared all similarity relationships for [cyan]{Markup.Escape(problemSlug)}[/] ({existingSimilarities.Count:N0} relationships removed)");
    }

    /// <summary>
    /// Handles the 'list' command to display all similarity relationships for a problem.
    /// Shows both outgoing similarities (problems this problem is similar to) and
    /// incoming similarities (problems that consider this problem similar).
    /// Expected format: list <problem-slug>
    /// </summary>
    /// <param name="parts">Parsed command components from user input.</param>
    private async Task HandleList(string[] parts)
    {
        // Validate command structure for required parameters.
        if (parts.Length != 2)
            throw new ArgumentException("List command requires: list <problem-slug>");

        // Parse argument
        var problemSlug = parts[1];

        // Retrieve problem ID for database operations.
        var problemId = await problemLookupService.GetProblemIdBySlugAsync(problemSlug);

        // Validate that the problem exists.
        if (problemId == null)
        {
            // Make aware if not
            AnsiConsole.MarkupLine($"[red]Problem not found:[/] {Markup.Escape(problemSlug)}");
            return;
        }

        // Get existing similarity relationships for the problem.
        var existingSimilarities = await databaseService.GetExistingSimilaritiesAsync(problemId.Value);

        // Handle when there's none
        if (existingSimilarities.Count == 0)
        {
            // Make aware if none
            AnsiConsole.MarkupLine("  [dim]No similarity relationships found[/]");
            return;
        }

        // Display similarity relationships organized by direction.
        AnsiConsole.MarkupLine($"[bold]Similarity relationships for problem [cyan]{Markup.Escape(problemSlug)}[/]:[/]");

        // Display outgoing similarities (problems this problem is similar to).
        var outgoingSimilarities = existingSimilarities
            .OrderByDescending(similarity => similarity.SimilarityScore)
            .ToArray();

        // Display similarities in a table for better readability
        if (outgoingSimilarities.Length > 0)
        {
            // Log
            AnsiConsole.MarkupLine($"  [dim]Similar problems ({outgoingSimilarities.Length:N0}):[/]");

            // Make a nice table
            var table = new Table();
            table.AddColumn("#");
            table.AddColumn("Problem Slug");
            table.AddColumn("Similarity Score");

            // Add each similarity as a table row
            for (var i = 0; i < outgoingSimilarities.Length; i++)
            {
                // Get the similarity
                var similarity = outgoingSimilarities[i];

                // Make a row
                table.AddRow(
                    $"[dim]{i + 1:D2}[/]",
                    $"[cyan]{similarity.TargetProblemSlug.ToUpperInvariant()}[/]",
                    $"{similarity.SimilarityScore:F3}"
                );
            }

            // Render the table
            AnsiConsole.Write(table);
        }
        else
        {
            // No problems
            AnsiConsole.MarkupLine("  [dim]No similar problems found.[/]");
        }

        // A new line after a list
        AnsiConsole.MarkupLine("");
    }

    /// <inheritdoc/>
    protected override void ShowHelp()
    {
        AnsiConsole.MarkupLine("[bold]Available Commands:[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]remove[/] <source-problem-slug> <target-problem-slug>");
        AnsiConsole.MarkupLine("  Remove a specific similarity relationship between two problems");
        AnsiConsole.MarkupLine("  Example: [dim]remove csmo-2023-a-1 csmo-2023-a-2[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]clear[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Remove all similarity relationships for a problem");
        AnsiConsole.MarkupLine("  Example: [dim]clear csmo-2023-a-1[/]");
        AnsiConsole.MarkupLine("");
        AnsiConsole.MarkupLine("[cyan]list[/] <problem-slug>");
        AnsiConsole.MarkupLine("  Show all similarity relationships for a problem");
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

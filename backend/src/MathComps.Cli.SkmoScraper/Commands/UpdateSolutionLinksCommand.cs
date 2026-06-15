using MathComps.Cli.SkmoScraper.Dtos;
using MathComps.Cli.SkmoScraper.Services;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using MathComps.Shared.Serialization;
using MathComps.Shared.Extensions;
using MathComps.Shared.Cli.Progress;

namespace MathComps.Cli.SkmoScraper.Commands;

/// <summary>
/// Command to update solution links in the database from scraped SKMO data.
/// Processes a JSON file containing scraped solution data and updates the corresponding problems in the database.
/// </summary>
/// <param name="databaseService">The service that perform the actual DB update</param>
[Description("Updates solution links in the database from scraped JSON data.")]
public class UpdateSolutionLinksCommand(ISkmoDatabaseService databaseService) : AsyncCommand<UpdateSolutionLinksCommand.Settings>
{
    /// <summary>
    /// Defines the command-line settings for the update solution links command.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Scraping happens first and then we pass the scraped the path to the scraped data here
        /// </summary>
        [Description("Path to the JSON file containing scraped solution data.")]
        [CommandOption("-i|--input")]
        [DefaultValue("skmo-solution-links.json")]
        public required string JsonFilePath { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Log start
        AnsiConsole.MarkupLine($"[yellow]Processing solution links from '{settings.JsonFilePath}'...[/]");

        // Get the JSON cntent
        var jsonContent = await File.ReadAllTextAsync(settings.JsonFilePath);

        // Deserialize
        var scrapedSolutions = jsonContent.FromJson<List<ScrapedSolution>>();

        // Ensure we have it
        if (scrapedSolutions.Count == 0)
        {
            // Make aware if not
            AnsiConsole.MarkupLine("[red]No solution data found in the JSON file.[/]");

            // And be sad
            return 1;
        }

        // We have it!
        AnsiConsole.MarkupLine($"[green]Found {scrapedSolutions.Count} solution entries in file.[/]");

        // Fetch existing solution links from DB (single query)
        AnsiConsole.MarkupLine("[dim]Fetching existing solution links from database...[/]");
        var existingLinks = await databaseService.GetExistingSolutionLinksAsync();
        AnsiConsole.MarkupLine($"[dim]Found {existingLinks.Count} existing link groups in database.[/]");

        // Convert scraped solutions to (ProblemKey, SolutionLink) and filter out unchanged
        var solutionsToProcess = scrapedSolutions
            .Select(solution =>
            {
                // Determine the competition and round slugs based on the mapping algorithm
                var key = !string.IsNullOrEmpty(solution.Category)
                    // Existing category, always Czech-Slovak Math Olympiad
                    ? new ProblemKey(
                        solution.Year,
                        "csmo",
                        solution.Category.ToSlug(),
                        solution.CompetitionId.ToSlug()
                    )
                    // If category null, we don't have subrounds
                    : new ProblemKey(
                        solution.Year,
                        solution.CompetitionId.ToSlug(),
                        null,
                        null
                    );

                // Return the key identifying the problem, the solution link, and the problem slug for logging
                return (Key: key, solution.SolutionLink, solution.Slug);
            })
            // Filter out entries that already have the correct solution link
            .Where(item => !existingLinks.TryGetValue(item.Key, out var existingLink) || existingLink != item.SolutionLink)
            .ToList();

        // Log how many we're skipping
        var skipped = scrapedSolutions.Count - solutionsToProcess.Count;
        if (skipped > 0)
            AnsiConsole.MarkupLine($"[dim]Skipping {skipped} entries that already have correct links.[/]");

        // If nothing to update, quit early
        if (solutionsToProcess.Count == 0)
        {
            AnsiConsole.MarkupLine("[green]All solution links are already up to date![/]");
            return 0;
        }

        // Log how many we're updating
        AnsiConsole.MarkupLine($"[yellow]Processing {solutionsToProcess.Count} entries that need updates...[/]");

        // We'll count how much we've updated
        var totalUpdatedProblems = 0;

        // Use the progress helper to process solution links sequentially
        await ProgressHelper.ExecuteWithProgressAsync(
            solutionsToProcess,
            "Updating solution links...",
            getItemDescription: item => item.Slug,
            processItem: async (item, index, cancellationToken) =>
            {
                // Update problems in the database with the solution link
                var result = await databaseService.UpdateProblemsWithSolutionLinkAsync(item.Key, item.SolutionLink);

                // If no problems to update, yet there is a solution link, make aware, this could be sus
                if (item.SolutionLink != null && result.TotalProblemsFound == 0)
                    AnsiConsole.MarkupLine($"[red]Found no problems for [yellow]{item.Slug}[/][/]");

                // We'll report the total updated problems
                totalUpdatedProblems += result.ProblemsUpdated;
            }
        );

        // Report success
        AnsiConsole.MarkupLine($"[green]Successfully updated {totalUpdatedProblems} problems with solution links.[/]");
        return 0;
    }
}


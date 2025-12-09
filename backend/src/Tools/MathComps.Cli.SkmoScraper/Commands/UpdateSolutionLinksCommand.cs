using MathComps.Cli.SkmoScraper.Services;
using MathComps.Shared;
using MathComps.Shared.Cli;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;

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
        if (scrapedSolutions == null || scrapedSolutions.Count == 0)
        {
            // Make aware if not
            AnsiConsole.MarkupLine("[red]No solution data found in the JSON file.[/]");

            // And be sad
            return 1;
        }

        // We have it!
        AnsiConsole.MarkupLine($"[green]Found {scrapedSolutions.Count} solution entries to process.[/]");

        // We'll count how much we've updated
        var totalUpdatedProblems = 0;

        // Use the progress helper to process solution links sequentially
        await ProgressHelper.ExecuteWithProgressAsync(
            scrapedSolutions,
            "Updating solution links...",
            getItemDescription: solution => solution.Slug,
            processItem: async (solution, index, cancellationToken) =>
            {
                // Determine the competition and round slugs based on the mapping algorithm
                string competitionSlug;
                string? categorySlug;
                string? roundSlug;

                // If category is not null, the competition slug is basically 'csmo' because I decided so randomly
                if (!string.IsNullOrEmpty(solution.Category))
                {
                    competitionSlug = "csmo";
                    categorySlug = solution.Category.ToSlug();
                    roundSlug = solution.CompetitionId.ToSlug();
                }
                // If category null, we don't have subrounds
                else
                {
                    competitionSlug = solution.CompetitionId.ToSlug();
                    categorySlug = null;
                    roundSlug = null;
                }

                // Update problems in the database with the solution link
                var result = await databaseService.UpdateProblemsWithSolutionLinkAsync(
                    solution.Year,
                    competitionSlug,
                    categorySlug,
                    roundSlug,
                    solution.SolutionLink);

                // If no problems to update
                if (result.TotalProblemsFound == 0)
                {
                    // This is good to know
                    AnsiConsole.MarkupLine($"[red]Found no problems for [yellow]{solution.Slug}[/][/]");
                }

                // We'll report the total updated problems
                totalUpdatedProblems += result.ProblemsUpdated;
            }
        );

        // Say we're happy
        AnsiConsole.MarkupLine($"[green]Successfully updated {totalUpdatedProblems} problems with solution links.[/]");

        // And be happy
        return 0;
    }
}

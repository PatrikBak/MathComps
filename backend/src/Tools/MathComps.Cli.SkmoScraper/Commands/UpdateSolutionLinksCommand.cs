using System.ComponentModel;
using System.Text.Json;
using MathComps.Cli.SkmoScraper.Services;
using MathComps.Shared;
using Spectre.Console;
using Spectre.Console.Cli;

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
        var scrapedSolutions = JsonSerializer.Deserialize<List<ScrapedSolution>>(jsonContent);

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

        // Process each scraped solution entry
        await AnsiConsole.Progress()
            .StartAsync(async progress =>
            {
                // Print nicely
                var task = progress.AddTask("[bold blue]Updating solution links...[/]", maxValue: scrapedSolutions.Count);

                // Handle each solution
                foreach (var solution in scrapedSolutions)
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
                    var updatedProblems = await databaseService.UpdateProblemsWithSolutionLinkAsync(
                        solution.Year,
                        competitionSlug,
                        categorySlug,
                        roundSlug,
                        solution.SolutionLink);

                    // If no problems were updated, we're sad
                    if (updatedProblems == 0)
                    {
                        // Make a nice slug for logging
                        var slug = $"{solution.Year}-{competitionSlug}" +
                                   $"{(categorySlug == null ? "" : $"-{categorySlug}")}" +
                                   $"{(roundSlug == null ? "" : $"-{roundSlug}")}";

                        // Make aware of all props
                        AnsiConsole.MarkupLine($"[red]Found no problems for [yellow]{slug.ToUpperInvariant()}[/][/]");
                    }

                    // Tally the count
                    totalUpdatedProblems += updatedProblems;

                    // Let's move on onto the next link
                    task.Increment(1);
                }

                // We're done
                task.StopTask();
            });

        // Say we're happy
        AnsiConsole.MarkupLine($"[green]Successfully updated {totalUpdatedProblems} problems with solution links.[/]");

        // And be happy
        return 0;
    }
}

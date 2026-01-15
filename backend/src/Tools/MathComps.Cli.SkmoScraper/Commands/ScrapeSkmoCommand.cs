using MathComps.Cli.SkmoScraper.Services;
using MathComps.Shared;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;

namespace MathComps.Cli.SkmoScraper.Commands;

/// <summary/>
/// The command for scraping the SKMO website for solution PDFs
/// </summary>
/// <param name="scraperService">The service used to perform the scraping operations.</param>
[Description("Scrapes the Slovak Mathematical Olympiad (SKMO) website for solution documents.")]
public class ScrapeSkmoCommand(ISkmoScraperService scraperService)
    : AsyncCommand<ScrapeSkmoCommand.Settings>
{
    /// <summary>
    /// Defines the command-line settings for the SKMO scraper command.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The path to the output JSON file. A different command will then read it
        /// </summary>
        [Description("Path to the output JSON file.")]
        [CommandOption("-o|--output")]
        [DefaultValue("skmo-solution-links.json")]
        public required string OutputPath { get; set; }

        /// <summary>
        /// The starting year (rocnik) for scraping, can be ommited
        /// </summary>
        [Description("The first 'rocnik' (year) to scrape.")]
        [CommandOption("--start-year")]
        // I have doubts that older content will ever be filled...
        [DefaultValue(48)]
        public int StartYear { get; set; }

        /// <summary>
        /// The ending year (rocnik) for scraping. If not specified, scraping continues until no new data is found.
        /// </summary>
        [Description("The last 'rocnik' (year) to scrape. If not specified, scraping continues until no new data is found.")]
        [CommandOption("--end-year")]
        public int? EndYear { get; set; }

        /// <inheritdoc/>
        public override ValidationResult Validate()
        {
            // Ensure output path
            if (string.IsNullOrWhiteSpace(OutputPath))
                return ValidationResult.Error("Output path cannot be empty.");

            // Ensure start year
            if (StartYear <= 0)
                return ValidationResult.Error("Start year must be a positive number.");

            // Ensure end year 
            if (EndYear.HasValue && EndYear.Value < StartYear)
                return ValidationResult.Error("End year must be greater than or equal to start year.");

            // We're happy here
            return ValidationResult.Success();
        }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Determine if we're in "partial scrape" mode (specific year range specified)
        var isPartialScrape = settings.EndYear.HasValue;

        // Log start
        AnsiConsole.MarkupLine($"[yellow]Starting SKMO website scrape. Output will be saved to '{settings.OutputPath}'[/]");

        // Do the scraping
        var scrapedSolutions = await scraperService.ScrapeAllYearsAsync(settings.StartYear, settings.EndYear);

        // This is weird?
        if (scrapedSolutions.Count == 0)
        {
            // Make aware of no solutions
            AnsiConsole.MarkupLine("[red]No solutions were found. The output file will not be created.[/]");

            // And be sad
            return 1;
        }

        // Log end
        AnsiConsole.MarkupLine($"[green]Scraping complete. Found {scrapedSolutions.Count} solution documents.[/]");

        // If partial scrape and output file exists, merge with existing data
        if (isPartialScrape && File.Exists(settings.OutputPath))
        {
            // Read existing content
            var existingJson = await File.ReadAllTextAsync(settings.OutputPath);
            var existingSolutions = existingJson.FromJson<List<ScrapedSolution>>() ?? [];

            // Log merge
            AnsiConsole.MarkupLine($"[dim]Merging with {existingSolutions.Count} existing solution(s)...[/]");

            // Create a dictionary keyed by unique identifier (Year, Category, CompetitionId)
            // New solutions will override existing ones with the same key
            var mergedSolutions = existingSolutions.ToDictionary(
                solution => (solution.Year, solution.Category, solution.CompetitionId),
                solution => solution
            );

            // Add/override with new solutions
            foreach (var solution in scrapedSolutions)
                mergedSolutions[(solution.Year, solution.Category, solution.CompetitionId)] = solution;

            // Convert back to list, sorted by year for consistency
            scrapedSolutions = [.. mergedSolutions.Values
                .OrderBy(solution => solution.Year)
                .ThenBy(solution => solution.Category)
                .ThenBy(solution => solution.CompetitionId)];

            // Log merged count
            AnsiConsole.MarkupLine($"[dim]Merged result contains {scrapedSolutions.Count} solution(s).[/]");
        }

        // Serialize the data to a JSON string.
        var jsonContent = scrapedSolutions.ToJson();

        // Write the JSON content to the specified output file.
        await File.WriteAllTextAsync(settings.OutputPath, jsonContent);

        // Log success
        AnsiConsole.MarkupLine($"[green]Successfully wrote results to '{settings.OutputPath}'.[/]");

        // And be happy
        return 0;
    }
}

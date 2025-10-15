using MathComps.Cli.SkmoScraper.Services;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using System.Text.Json;

namespace MathComps.Cli.SkmoScraper.Commands;

/// <summary/>
/// The command for scraping the SKMO website for solution PDFs
/// </summary>
/// <param name="scraperService">The service used to perform the scraping operations.</param>
/// <param name="jsonSerializerOptions">The options for serializing the output JSON.</param>
[Description("Scrapes the Slovak Mathematical Olympiad (SKMO) website for solution documents.")]
public class ScrapeSkmoCommand(ISkmoScraperService scraperService, JsonSerializerOptions jsonSerializerOptions)
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

        // Serialize the data to a JSON string.
        var jsonContent = JsonSerializer.Serialize(scrapedSolutions, jsonSerializerOptions);

        // Write the JSON content to the specified output file.
        await File.WriteAllTextAsync(settings.OutputPath, jsonContent);

        // Log success
        AnsiConsole.MarkupLine($"[green]Successfully wrote results to '{settings.OutputPath}'.[/]");

        // And be happy
        return 0;
    }
}

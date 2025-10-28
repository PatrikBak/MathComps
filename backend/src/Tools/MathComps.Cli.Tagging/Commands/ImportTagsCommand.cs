using CsvHelper;
using CsvHelper.Configuration;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Shared;
using MathComps.Shared.Cli;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using System.Globalization;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Imports tags from a CSV file into the database, clearing existing tags first.
/// Processes the CSV in batches for optimal performance using <see cref="ITaggingDatabaseService"/>.
/// </summary>
[Description("Import tags from a CSV file, clearing existing tags first and processing in batches.")]
public class ImportTagsCommand(ITaggingDatabaseService databaseService) : AsyncCommand<ImportTagsCommand.Settings>
{
    /// <summary>
    /// The command settings
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Path to the CSV file containing tag data in the format expected by <see cref="TagImportDto"/>
        /// </summary>
        [CommandArgument(0, "<file-path>")]
        [Description("Path to the CSV file containing tag data")]
        public required string FilePath { get; init; }

        /// <summary>
        /// Batch size for processing CSV rows
        /// </summary>
        [CommandOption("--batch-size|-b")]
        [Description("Batch size for processing CSV rows")]
        [DefaultValue(1000)]
        public int BatchSize { get; init; }

        /// <summary>
        /// Validates the command settings, ensuring the file exists and batch size is positive.
        /// </summary>
        /// <returns>Validation result</returns>
        public override ValidationResult Validate()
        {
            // Validate batch size
            if (BatchSize <= 0)
                return ValidationResult.Error("Batch size must be greater than 0");

            // Validate file exists
            if (!File.Exists(FilePath))
                return ValidationResult.Error($"File not found: {FilePath}");

            // All gud
            return ValidationResult.Success();
        }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        try
        {
            // Load and parse CSV
            AnsiConsole.MarkupLine("[bold cyan]Phase 1:[/] Loading and parsing CSV file...");
            var csvRows = LoadCsvFile(settings.FilePath);
            AnsiConsole.MarkupLine($"[green]Loaded {csvRows.Count} rows from CSV[/]");

            // Clear existing tags
            AnsiConsole.MarkupLine("[bold cyan]Phase 2:[/] Clearing existing tags...");
            await databaseService.ClearAllTagsAsync();
            AnsiConsole.MarkupLine("[green]All existing tags cleared[/]");

            // Import in batches
            AnsiConsole.MarkupLine("[bold cyan]Phase 3:[/] Importing tags in batches...");
            var result = await ImportInBatchesAsync(csvRows, settings.BatchSize);

            // Display results
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine($"[green]Import completed successfully![/]");
            AnsiConsole.MarkupLine($"   Total rows processed: [bold]{csvRows.Count}[/]");
            AnsiConsole.MarkupLine($"   Tags imported: [bold green]{result.ImportedCount}[/]");
            AnsiConsole.MarkupLine($"   Problems skipped: [bold yellow]{result.SkippedProblemSlugs.Count}[/]");

            // If any skipped problems
            if (result.SkippedProblemSlugs.Count > 0)
            {
                // Display their info
                AnsiConsole.WriteLine();
                AnsiConsole.MarkupLine("[yellow]Skipped problem slugs (problems not found in database):[/]");

                // How many will we display?
                const int maxDisplayResults = 50;

                // Display the first results
                foreach (var slug in result.SkippedProblemSlugs.Take(maxDisplayResults))
                    AnsiConsole.MarkupLine($"  [dim]{Markup.Escape(slug)}[/]");

                // Display dots for the rest
                if (result.SkippedProblemSlugs.Count > maxDisplayResults)
                    AnsiConsole.MarkupLine($"  ... and {result.SkippedProblemSlugs.Count - maxDisplayResults} more");
            }

            // Sucess
            return 0;
        }
        catch (Exception ex)
        {
            // Print errors nicely
            AnsiConsole.WriteException(ex);
            return 1;
        }
    }

    /// <summary>
    /// Loads and parses the CSV file into <see cref="TagImportDto"/> objects using CsvHelper
    /// </summary>
    /// <param name="filePath">Path to the CSV file to load</param>
    /// <returns>List of parsed CSV rows</returns>
    private static List<TagImportDto> LoadCsvFile(string filePath)
    {
        // Get the CSV configuration ready
        var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture);
        using var reader = new StreamReader(filePath);
        using var csv = new CsvReader(reader, csvConfig);

        // Return all (will refactor when this gets crazy)
        return [.. csv.GetRecords<TagImportDto>()];
    }

    /// <summary>
    /// Imports tags in batches with progress tracking using <see cref="ITaggingDatabaseService.ImportTagsAsync"/>
    /// </summary>
    /// <param name="csvRows">List of CSV rows to import</param>
    /// <param name="batchSize">Number of rows to process in each batch</param>
    /// <returns>Result containing import statistics</returns>
    private async Task<ImportTagsResult> ImportInBatchesAsync(List<TagImportDto> csvRows, int batchSize)
    {
        // Accumalate skipped slugs across all batches
        var allSkippedSlugs = new HashSet<string>();

        // Accumalate total imported count across all batches
        var totalImported = 0;

        // Create batches from the problems list
        var batches = csvRows.Batch(batchSize).ToList();

        // Use the progress helper to process batches sequentially
        await ProgressHelper.ExecuteWithProgressAsync(
            batches,
            "Importing tags in batchees...",
            getItemDescription: batch => null, // Bad item description, but not a big deal
            processItem: async (batch, index, cancellationToken) =>
            {
                // Import batch directly (no conversion needed)
                var result = await databaseService.ImportTagsAsync(batch);

                // Accumulate imported count
                totalImported += result.ImportedCount;

                // Accumulate skipped slugs
                foreach (var slug in result.SkippedProblemSlugs)
                    allSkippedSlugs.Add(slug);
            }
        );

        // Return the accumulated results
        return new ImportTagsResult(totalImported, [.. allSkippedSlugs]);
    }
}

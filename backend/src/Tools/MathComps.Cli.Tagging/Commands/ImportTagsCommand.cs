using CsvHelper;
using CsvHelper.Configuration;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
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
        public int BatchSize { get; init; } = 1000;

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
        // Display header
        AnsiConsole.Write(new FigletText("Import Tags").Centered().Color(Color.Aqua));
        AnsiConsole.WriteLine();

        try
        {
            // Clear existing tags
            AnsiConsole.MarkupLine("[bold cyan]Phase 1:[/] Clearing existing tags...");
            await databaseService.ClearAllTagsAsync();
            AnsiConsole.MarkupLine("[green]All existing tags cleared[/]");

            // Load and parse CSV
            AnsiConsole.MarkupLine("[bold cyan]Phase 2:[/] Loading and parsing CSV file...");
            var csvRows = LoadCsvFile(settings.FilePath);
            AnsiConsole.MarkupLine($"[green]Loaded {csvRows.Count} rows from CSV[/]");

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

        // Calculate total number of batches
        var totalBatches = (int)Math.Ceiling((double)csvRows.Count / batchSize);

        // Process in batches with progress
        await AnsiConsole.Progress()
            .Columns(
            [
                new SpinnerColumn(),
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new ElapsedTimeColumn(),
            ])
            .StartAsync(async ctx =>
            {
                // Create the import task for the batch
                var task = ctx.AddTask("Importing tags", maxValue: totalBatches);

                // Process each batch
                for (var i = 0; i < csvRows.Count; i += batchSize)
                {
                    // Get the current batch
                    var batch = csvRows.Skip(i).Take(batchSize).ToList();

                    // Calculate current batch number
                    var batchNumber = (i / batchSize) + 1;

                    // Import batch directly (no conversion needed)
                    var result = await databaseService.ImportTagsAsync(batch);

                    // Accumulate imported count
                    totalImported += result.ImportedCount;

                    // Accumulate skipped slugs
                    foreach (var slug in result.SkippedProblemSlugs)
                        allSkippedSlugs.Add(slug);

                    // Update progress
                    task.Description = $"Importing tags (batch {batchNumber}/{totalBatches})";
                    task.Increment(1);
                }
            });

        // Return the accumulated results
        return new ImportTagsResult(totalImported, [.. allSkippedSlugs]);
    }
}

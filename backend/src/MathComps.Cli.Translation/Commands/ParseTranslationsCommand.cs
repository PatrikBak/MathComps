using MathComps.Cli.SkmoParser.Rendering;
using MathComps.Cli.Translation.Dtos;
using MathComps.Cli.Translation.Enums;
using MathComps.Cli.Translation.Services;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Problems;
using MathComps.TexParser;
using MathComps.TexParser.TexCleaner;
using MathComps.TexParser.Types;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using MathComps.Shared.Cli.Progress;
using MathComps.Shared.Serialization;
using MathComps.Shared.Extensions;

namespace MathComps.Cli.Translation.Commands;

/// <summary>
/// Parses translated problem texts that have <see cref="ProblemText.RawText"/>
/// but no <see cref="ProblemText.ParsedText"/>. Supports file-based recovery for
/// parse failures.
/// </summary>
/// <param name="databaseService">The database service for accessing problem texts.</param>
/// <param name="imageService">The service for querying problem image data.</param>
[Description("Parse translated problem texts and update the database.")]
public class ParseTranslationsCommand(
    ITranslationDatabaseService databaseService,
    IProblemImageService imageService
) : AsyncCommand<ParseTranslationsCommand.Settings>
{
    /// <summary>
    /// Path to the file containing parse issues (failures that can be manually fixed).
    /// </summary>
    private const string IssuesFilePath = "Output/parse-issues.yaml";

    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Number of translations to parse.
        /// </summary>
        [CommandOption("-n|--count")]
        [Description("Number of translations to parse.")]
        public required int Count { get; set; }

        /// <summary>
        /// Scope of parsing (statements only, solutions only, or both).
        /// </summary>
        [CommandOption("--scope")]
        [Description("Parsing scope: Both, StatementsOnly, or SolutionsOnly.")]
        [DefaultValue(TranslationScope.Both)]
        public TranslationScope Scope { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Load cleaner rules for parsing
        var rules = TeXCleanerRules.LoadRules();

        // Load any existing issues (with potential manual fixes)
        var existingIssues = await LoadIssuesAsync();

        // Retrieve translations that need parsing
        var textsToProcess = await databaseService.GetTextsNeedingParsingAsync(
            settings.Count,
            scope: settings.Scope
        );

        // Ensure there are texts to process
        if (textsToProcess.Count == 0)
        {
            AnsiConsole.MarkupLine("[yellow]No translations found that need parsing.[/]");
            return 0;
        }

        // Log count
        AnsiConsole.MarkupLine($"[green]Found {textsToProcess.Count} translation(s) to parse.[/]");

        // Track results
        var successCount = 0;
        var remainingIssues = new List<ParseFailureDto>();

        // Process each text with progress tracking
        await ProgressHelper.ExecuteWithProgressAsync(
            items: textsToProcess,
            progressDescription: "Parsing translations...",
            getItemDescription: text => $"{text.ProblemSlug} ({text.Language} {text.DocumentType})",
            processItem: async (textDto, _, _) =>
            {
                // Check if we have a manually fixed version from issues file
                var rawText = existingIssues.TryGetValue(textDto.ProblemTextId, out var issue)
                    ? issue.RawText
                    : textDto.RawText;

                try
                {
                    // Parse the raw text (with itemize/enumerate preprocessing)
                    var parseResult = ProblemRenderer.ParseWithPreprocessing(rawText, rules, textDto.ProblemSlug);

                    // Treat unknown commands as failures
                    if (parseResult.UnknownCommands.Count > 0)
                    {
                        // A list of commands for logging
                        var unknownList = parseResult.UnknownCommands
                            .Select(command => $" - \\{command}")
                            .ToJoinedString("\n");

                        // Throw an exception that will be caught down...
                        throw new InvalidOperationException($"Unknown commands:\n{unknownList}");
                    }

                    // Get image mapping for this problem (OriginalId -> ContentId)
                    var imageMapping = await imageService.GetImageMappingAsync(textDto.ProblemId);

                    // Remap image IDs in the parsed content (as it contains original ids)
                    var remappedContent = ContentTree.Map(
                        parseResult.Data.Content,
                        node => node switch
                        {
                            // We only want to remap images
                            Image image when imageMapping.TryGetValue(image.Id, out var contentId)
                                // Set them new id
                                => image with { Id = contentId },

                            // Leave all other nodes unchanged
                            _ => node
                        }
                    );

                    // Reconstruct the Text with remapped content
                    var remappedText = parseResult.Data with { Content = remappedContent };

                    // Serialize to JSON
                    var parsedJson = remappedText.ToJson(writeIndented: false);

                    // Update the database with parsed content
                    await databaseService.UpdateParsedTextAsync(textDto.ProblemTextId, parsedJson);

                    // If we used a manually fixed version, persist the fix to the database
                    if (existingIssues.ContainsKey(textDto.ProblemTextId))
                        await databaseService.UpdateRawTextAsync(textDto.ProblemTextId, rawText);

                    // Track success
                    successCount++;
                }
                catch (Exception exception)
                {
                    // Record the failure (preserving the potentially-fixed RawText)
                    remainingIssues.Add(new ParseFailureDto(
                        textDto.ProblemTextId,
                        textDto.ProblemId,
                        textDto.ProblemSlug,
                        textDto.Language,
                        textDto.DocumentType,
                        rawText,
                        exception.Message
                    ));
                }
            });

        // If there's any issues
        if (remainingIssues.Count > 0)
        {
            // Write the issues to YAML
            Directory.CreateDirectory(Path.GetDirectoryName(IssuesFilePath)!);
            await File.WriteAllTextAsync(IssuesFilePath, remainingIssues.ToYaml());

            // Log instructions
            AnsiConsole.MarkupLine($"[yellow]Wrote {remainingIssues.Count} issue(s) to {IssuesFilePath}[/]");
            AnsiConsole.MarkupLine("[dim]To fix: edit RawText in the file and rerun.[/]");
        }
        // If no issues left and the file exists
        else if (File.Exists(IssuesFilePath))
        {
            // All issues resolved - clean up the file
            File.Delete(IssuesFilePath);
            AnsiConsole.MarkupLine($"[green]All issues resolved, removed {IssuesFilePath}[/]");
        }

        // Summary
        AnsiConsole.MarkupLine(
            $"\n[cyan]Results:[/]\n" +
            $"[green] - Parsed: {successCount}[/]\n" +
            $"[red] - Failed: {remainingIssues.Count}[/]");

        // Return exit code based on whether there are any issues
        return remainingIssues.Count > 0 ? 1 : 0;
    }

    /// <summary>
    /// Loads existing issues from the issues file.
    /// </summary>
    /// <returns>A dictionary mapping problem text IDs to parse failure data.</returns>
    private static async Task<Dictionary<Guid, ParseFailureDto>> LoadIssuesAsync()
    {
        // No file => no issues
        if (!File.Exists(IssuesFilePath))
            return [];

        // Deserialize the YAML file
        var yaml = await File.ReadAllTextAsync(IssuesFilePath);
        var issues = yaml.FromYaml<List<ParseFailureDto>>();

        // Log the count
        AnsiConsole.MarkupLine($"[cyan]Loaded {issues.Count} existing issue(s) from {IssuesFilePath}[/]");

        // Return the issues
        return issues.ToDictionary(issue => issue.ProblemTextId);
    }
}


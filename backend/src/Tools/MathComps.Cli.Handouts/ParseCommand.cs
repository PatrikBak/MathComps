using MathComps.Shared;
using MathComps.TexParser;
using MathComps.TexParser.Images;
using MathComps.TexParser.TexCleaner;
using MathComps.TexParser.Types;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;

namespace MathComps.Cli.Handouts;

/// <summary>
/// The command to parse handout TeX files into JSON objects easily consumable by the frontend.
/// Automatically discovers handout files based on a pattern and generates corresponding JSON outputs.
/// </summary>
[Description("Parses handout TeX files into structured JSON for frontend consumption. Automatically discovers files based on pattern.")]
public class ParseCommand : Command<ParseCommand.Settings>
{
    /// <summary>
    /// The configuration settings for the parse command.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// File patterns to match handout files (e.g., *-sk.tex for Slovak handouts, or specific file like algebra-1-rozklady-sk.tex).
        /// </summary>
        [CommandArgument(0, "<patterns>")]
        [Description("File pattern(s) to match handout files.\nExample: *-sk.tex OR algebra-1-rozklady-sk.tex")]
        public required string[] Patterns { get; set; }
    }

    /// <inheritdoc/>
    public override int Execute(CommandContext context, Settings settings)
    {
        // Fixed paths relative to the tool's project directory.
        var inputDirectory = new DirectoryInfo("../../../../data/handouts");
        var outputDirectory = new DirectoryInfo("../../../../web/src/content/handouts");

        // Validate the input directory exists.
        if (!inputDirectory.Exists)
        {
            // If the directory does not exist, print an error message and exit.
            AnsiConsole.MarkupLine($"[red]Error:[/] Input directory not found at '[yellow]{Markup.Escape(inputDirectory.FullName)}[/]'");
            return 1;
        }

        // Ensur have have the output dirrectory
        if (!outputDirectory.Exists)
            outputDirectory.Create();

        // Collect all files matching any of the provided patterns.
        // Remove duplicates if patterns overlap.
        List<FileInfo> inputFiles = [..
            settings.Patterns.SelectMany(pattern=> inputDirectory.GetFiles(pattern, SearchOption.TopDirectoryOnly))
        ];

        // Check if any files were found.
        if (inputFiles.Count == 0)
        {
            // If no files match, inform the user and exit.
            AnsiConsole.MarkupLine($"[yellow]Warning:[/] No files found matching pattern(s) in the input directory.");
            return 0;
        }

        // Display what we're processing.
        AnsiConsole.MarkupLine($"[aqua]Found {inputFiles.Count} handout file(s)[/]");
        AnsiConsole.WriteLine();

        // Track unknown commands across all files for a final report.
        var allUnknownCommands = new Dictionary<string, IReadOnlyCollection<string>>();

        // Track if there were any errors during processing.
        var anyErrors = false;

        // Load the TeX cleaning rules before processing files.
        var rules = TeXCleanerRules.LoadRules();

        // Process each discovered handout file.
        foreach (var inputFile in inputFiles)
        {
            // Generate the output filename by replacing .tex extension with .json.
            var outputFileName = Path.ChangeExtension(inputFile.Name, ".json");
            var outputFilePath = Path.Combine(outputDirectory.FullName, outputFileName);

            try
            {
                // Read the entire content of the .tex file into a string.
                var texContent = File.ReadAllText(inputFile.FullName);

                // Parse the TeX content into the structured Document object model.
                var (document, unknownCommands) = TexStringParser.ParseDocument(texContent, rules);

                // Process images in the document content and collect their metadata
                var (processedDocument, discoveredImages) = ProcessHandoutImages(document, inputFile.Name);

                // Create a wrapper object containing both document and images
                var handoutData = new
                {
                    Document = processedDocument,
                    Images = discoveredImages
                };

                // Serialize the handout data (document + images) to an indented JSON string
                var jsonString = handoutData.ToJson();

                // Normalize line endings to LF (Unix-style) for Git compatibility
                var normalizedContent = jsonString.Replace("\r\n", "\n") + "\n";

                // Ship the handout
                File.WriteAllText(outputFilePath, normalizedContent);

                // Make aware
                AnsiConsole.MarkupLine($"[green]Success:[/] {Markup.Escape(outputFileName)}");

                // If unknown commands were found, add them to our report dictionary.
                if (!unknownCommands.IsEmpty)
                    allUnknownCommands[inputFile.Name] = unknownCommands;
            }
            catch (Exception exception)
            {
                // If an error occurs during processing, display it and mark the overall operation as failed.
                AnsiConsole.MarkupLine($"[red]Error processing {Markup.Escape(inputFile.Name)}[/]");
                AnsiConsole.WriteException(exception);
                anyErrors = true;
            }
        }

        // Check if there were any files with unknown commands.
        if (allUnknownCommands.Count != 0)
        {
            // Create a table to display the unknown commands in a tidy report.
            var table = new Table()
                .Title("Commands NOT covered by 'leave' rules", new Style(Color.Grey))
                .Border(TableBorder.Rounded)
                .AddColumn(new TableColumn("[yellow]Source File[/]").Centered())
                .AddColumn(new TableColumn("[red]Unknown Command[/]").Centered());

            // Add each unknown command to the table.
            foreach (var (fileName, commands) in allUnknownCommands)
                foreach (var command in commands)
                    table.AddRow(fileName, @$"\{command}");

            // Render the table to the console.
            AnsiConsole.WriteLine();
            AnsiConsole.Write(table);

            // There shouldn't be unknown commands in production-ready handouts.
            anyErrors = true;

            // Suggest next steps to the user.
            AnsiConsole.MarkupLine("\n[red]Please review the above unknown commands.[/]");
        }

        // Final success message if no errors or unknown commands were found.
        if (!anyErrors)
            AnsiConsole.MarkupLine("[bold green]\nAll files processed successfully.[/]");

        // Return the exit code indicating if there were any errors.
        return anyErrors ? 1 : 0;
    }

    /// <summary>
    /// Processes images in a handout document by walking through all sections and their content.
    /// </summary>
    /// <param name="document">The parsed handout document.</param>
    /// <param name="sourceFileName">The source .tex file name (e.g., "algebra-1-rozklady-sk.tex").</param>
    /// <returns>A tuple containing the processed document and a list of discovered image metadata.</returns>
    private static (Document ProcessedDocument, ImmutableList<ImageData> DiscoveredImages) ProcessHandoutImages(Document document, string sourceFileName)
    {
        // Extract the handout identifier from the filename (e.g., "algebra-1-rozklady-sk.tex" -> "algebra-1-rozklady-sk")
        var handoutId = Path.GetFileNameWithoutExtension(sourceFileName);

        // Define the output directory for handout images
        var outputDirectory = "../../../../backend/src/Api/MathComps.Api/wwwroot/images/handouts";
        var handoutsDirectory = "../../../../data/handouts/Images";

        // Configure the image processor for this handout
        var config = new ImageProcessingConfig(
            ImageSourceResolver: imageId => Path.Combine(handoutsDirectory, $"{imageId.RemoveEnd(".pdf")}.svg"),
            FileNamePrefix: handoutId,
            OutputDirectory: outputDirectory,
            OnMissingImage: imageId => AnsiConsole.MarkupLine($"[yellow]Warning:[/] Handout [yellow]{handoutId}[/] has a missing image: {imageId}")
        );

        // Collect all discovered images from all sections
        var allDiscoveredImages = ImmutableList.CreateBuilder<ImageData>();

        // Process each section's content because we need to
        // change image ids to svg ids + get images into wwwroot
        var processedSections = document.Sections.Select(section =>
        {
            // Process the section's text
            var result = TexImageProcessor.Process(section.Text, config)
                // It should just work out
                ?? throw new InvalidOperationException("Processing result is null");

            // Accumulate discovered images
            allDiscoveredImages.AddRange(result.DiscoveredImages);

            // Return the section with processed text
            return section with { Text = result.ProcessedText };
        });

        // Return the document with processed sections and all discovered images
        return (document with { Sections = [.. processedSections] }, allDiscoveredImages.ToImmutable());
    }
}

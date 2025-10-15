using MathComps.TexParser;
using MathComps.TexParser.TexCleaner;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

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
        [CommandArgument(0, "[patterns]")]
        [Description("File pattern(s) to match handout files.\nExample: *-sk.tex OR algebra-1-rozklady-sk.tex")]
        public required string[] Patterns { get; set; }
    }

    /// <inheritdoc/>
    public override int Execute(CommandContext context, Settings settings)
    {
        // Display a fancy header for the tool.
        AnsiConsole.Write(new FigletText("Handout Parser").Centered().Color(Color.Aqua));

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

        // Configure JSON serialization options for the output files.
        var jsonSerializerOptions = new JsonSerializerOptions
        {
            // Make the output JSON human-readable with indentation.
            WriteIndented = true,

            // Use camelCase for property names in the JSON output (e.g., "title", "sections").
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,

            // Do not include properties with null values in the JSON output.
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,

            // Preserve diacritics and special characters in the output.
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,

            // Ensure enums are serialized as their string names into PascalCase.
            Converters = { new JsonStringEnumConverter() },
        };

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

                // Serialize the Document object to a JSON string using the configured options.
                var jsonString = JsonSerializer.Serialize(document, jsonSerializerOptions);

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
                AnsiConsole.MarkupLine($"[red]Error processing {Markup.Escape(inputFile.Name)}:[/] {Markup.Escape(exception.Message)}");
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
}

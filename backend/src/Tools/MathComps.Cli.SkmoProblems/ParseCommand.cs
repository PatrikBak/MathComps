using MathComps.Cli.SkmoProblems.Parsing;
using MathComps.Cli.SkmoProblems.Rendering;
using MathComps.Shared;
using MathComps.TexParser.TexCleaner;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;
using System.Text.Json;

namespace MathComps.Cli.SkmoProblems;

/// <summary>
/// The command to parse SKMO problems from TeX archive into structured JSON.
/// </summary>
[Description("Parses SKMO problems from TeX archive into structured JSON with validation.")]
public class ParseCommand : AsyncCommand<ParseCommand.Settings>
{
    /// <summary>
    /// The configuration settings for the parse command.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The rendering mode for HTML preview output, used to be useful for debugging commands.
        /// </summary>
        [CommandOption("--mode|-m")]
        [Description("Rendering mode for HTML previews")]
        [DefaultValue(ProblemRenderingMode.NoRendering)]
        public ProblemRenderingMode Mode { get; init; } = ProblemRenderingMode.NoRendering;

        /// <summary>
        /// This is useful for debugging or testing specific years without affecting the version-controlled archive.
        /// </summary>
        [CommandOption("--years|-y")]
        [Description("Specific olympiad years to process (e.g., --years 72 73 74). If not specified, processes all years.")]
        public int[] Years { get; init; } = [];
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Display a fancy header for the tool.
        AnsiConsole.Write(new FigletText("SKMO Parser").Centered().Color(Color.Aqua));

        // Load the TeX cleaning rules for normalizing input.
        var rules = TeXCleanerRules.LoadRules();

        // We'll pass down either a set of years of null
        var yearsToProcess = settings.Years.Length > 0
            ? [.. settings.Years]
            : (ImmutableHashSet<int>?)null;

        // Report if filtering by years.
        if (yearsToProcess is not null)
            AnsiConsole.MarkupLine($"[yellow]Filtering to years: {yearsToProcess.Order().ToJoinedString()}[/]");

        // Load the entire archive into memory (not that big)
        var allProblems = SkmoArchiveParser.ParseSkmoArchive(yearsToProcess);

        // Report how many problems we're processing.
        AnsiConsole.MarkupLine($"[aqua]Processing {allProblems.Count} problems[/]");

        // Parse and render the problems to HTML (if requested).
        var renderingResult = await ProblemRenderer.RenderAsync(
            rules,
            allProblems,
            new(
                HtmlOutputFolder: Path.Combine("../../../../", SkmoDataPaths.SkmoHtmlResultsDirectory),
                ProblemRenderingMode: settings.Mode
            )
        );

        #region Unknown commands

        // Gather unknown TeX commands that weren't recognized by the parser.
        var unknownCommands = renderingResult
            .SelectMany(result => result.UnknownCommands)
            .Distinct()
            .Order()
            .ToImmutableList();

        // Report them and quit if any are found.
        if (!unknownCommands.IsEmpty)
        {
            // Display a clear error message.
            AnsiConsole.MarkupLine("[bold red]Unknown commands found:[/]");

            // List each unknown command.
            foreach (var command in unknownCommands)
                AnsiConsole.MarkupLine($"  - [red]\\{Markup.Escape(command)}[/]");

            // Exit with error code to indicate failure.
            return 1;
        }

        #endregion

        #region KaTeX errors

        // Gather problems that failed KaTeX validation.
        var katexErrors = renderingResult
            .Where(result => result.KatexError != null)
            .Select(result => result.ParsedProblem.RawProblem.Id)
            .ToImmutableList();

        // Report them and quit if any are found.
        if (!katexErrors.IsEmpty)
        {
            // Display a clear error message.
            AnsiConsole.MarkupLine("[bold red]KaTeX errors found in the following problems:[/]");

            // List each problem with an error.
            foreach (var error in katexErrors)
                AnsiConsole.MarkupLine($"  - [red]{Markup.Escape(error)}[/]");

            // Exit with error code to indicate failure.
            return 1;
        }

        #endregion

        #region Storing parsed problems

        // Serialize the parsed problems in a deterministic order for consistent output.
        var parsedProblems = renderingResult
            .Select(result => result.ParsedProblem)
            .OrderBy(result => result.RawProblem.Id)
            .ToImmutableList();

        // Only write the parsed archive if processing all years (not filtered).
        if (yearsToProcess is null)
        {
            // Convert to JSON for storage.
            var serializedProblems = JsonSerializer.Serialize(parsedProblems);

            // Write the final output file, overwriting the version-controlled file.
            File.WriteAllText(Path.Combine("../../../../", SkmoDataPaths.SkmoParsedArchiveFile), serializedProblems);

            // Success message.
            AnsiConsole.MarkupLine("[bold green][/][aqua]Successfully parsed and saved {0} problems to archive[/]", parsedProblems.Count);
        }
        // Success message for filtered run (no file written).
        else AnsiConsole.MarkupLine("[bold green][/][aqua]Successfully parsed {0} problems (archive not updated due to year filter)[/]", parsedProblems.Count);

        #endregion

        return 0;
    }
}


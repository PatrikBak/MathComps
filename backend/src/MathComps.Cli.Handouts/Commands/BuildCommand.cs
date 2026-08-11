using MathComps.Infrastructure.Storage;
using MathComps.TexParser;
using MathComps.TexParser.Images;
using MathComps.TexParser.TexCleaner;
using MathComps.TexParser.Types;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;
using System.Text;
using System.Text.RegularExpressions;
using MathComps.Shared.Serialization;
using MathComps.Shared.Extensions;
using MathComps.Shared.Diagnostics;
using MathComps.Shared.Cli;

namespace MathComps.Cli.Handouts.Commands;

/// <summary>
/// The main orchestration command for the handout pipeline.
/// Generates skeletons, compiles TeX to PDF, parses TeX to JSON,
/// and uploads images, linked documents, and PDFs to Cloudflare R2.
/// </summary>
/// <param name="trackedUploader">A lazily-resolved deduping uploader for pushing assets to remote storage,
/// skipping ones unchanged since their last run.</param>
[Description("Builds handouts: generates skeletons, compiles TeX, parses JSON, and copies assets.")]
public class BuildCommand(Lazy<ITrackedFileUploader> trackedUploader) : AsyncCommand<BuildCommand.Settings>
{
    /// <summary>
    /// The configuration settings for the build command.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// File patterns to match handout files (e.g., *.sk.tex for Slovak handouts).
        /// </summary>
        [CommandArgument(0, "<patterns>")]
        [Description("File pattern(s) to match handout files.\nExample: *.sk.tex OR factorization.sk.tex")]
        public required string[] Patterns { get; set; }

        /// <summary>
        /// The TeX compiler command to use for compiling .tex files into PDFs.
        /// </summary>
        [CommandOption("--compiler")]
        [Description("TeX compiler command with flags (default: pdfcsplain -interaction=nonstopmode -halt-on-error)")]
        [DefaultValue("pdfcsplain -interaction=nonstopmode -halt-on-error")]
        public required string Compiler { get; set; }

        /// <summary>
        /// Whether to skip the TeX compilation step. Useful during parser development
        /// when you only want to re-parse existing files without recompiling.
        /// </summary>
        [CommandOption("--skip-compile")]
        [Description("Skip TeX compilation, only parse and copy existing PDFs")]
        public bool SkipCompile { get; set; }

        /// <summary>
        /// Whether to skip uploading files to Cloudflare R2. Useful during local
        /// development when you only need the JSON output without R2 credentials.
        /// </summary>
        [CommandOption("--skip-upload")]
        [Description("Skip uploading PDFs, images, and linked documents to R2")]
        public bool SkipUpload { get; set; }

        /// <summary>
        /// Whether to skip the Asymptote staleness check and recompilation.
        /// Useful when the author is confident images are up to date and wants
        /// to shave the per-handout dependency scan / or in CI where no Asymptote
        /// </summary>
        [CommandOption("--skip-asy")]
        [Description("Skip Asymptote staleness check and recompilation")]
        public bool SkipAsy { get; set; }

        /// <summary>
        /// Whether to unconditionally recompile every Asymptote-backed image, bypassing
        /// the staleness check. Use after a change to <c>_common.asy</c> that alters
        /// rendering of existing figures (e.g. palette tweak, modified helper function) —
        /// such edits are intentionally NOT tracked by the dep graph since most
        /// <c>_common.asy</c> edits are additive and harmless.
        /// </summary>
        [CommandOption("--force-asy")]
        [Description("Recompile every Asymptote-backed image regardless of staleness")]
        public bool ForceAsy { get; set; }

        /// <summary>
        /// Whether to skip regenerating the artefacts derived from the content JSONs: the committed
        /// environment-id index and the examiner's defense-content blobs. Both are built by the frontend's own
        /// generator scripts, so this is really "skip the steps needing <c>web/</c>'s dependencies" — which is
        /// what CI wants, that job never installing them. The frontend job's <c>handouts:validate</c> check
        /// covers both artefacts independently.
        /// </summary>
        [CommandOption("--skip-derived")]
        [Description("Skip regenerating handout-env-index.json and the defense content (needs web/ dependencies)")]
        public bool SkipDerived { get; set; }

        /// <summary>
        /// Path to the error log file for compiler output on failure.
        /// </summary>
        [CommandOption("--error-log")]
        [Description("Path to error log file for compiler failures (default: errors.log)")]
        [DefaultValue("errors.log")]
        public required string ErrorLog { get; set; }
    }

    /// <summary>
    /// A pending file upload to R2.
    /// </summary>
    /// <param name="SourcePath">Absolute path to the local source file.</param>
    /// <param name="R2Key">The R2 object key to upload to.</param>
    private record PendingUpload(string SourcePath, string R2Key);

    /// <summary>
    /// The result of processing images in a handout document.
    /// </summary>
    /// <param name="ProcessedDocument">The document with image references resolved.</param>
    /// <param name="DiscoveredImages">All image metadata discovered during processing.</param>
    private record HandoutImageResult(Document ProcessedDocument, ImmutableList<ImageData> DiscoveredImages);

    /// <summary>
    /// The top-level R2 prefix under which handout-referenced documents (downloadable
    /// PDFs linked via <c>\Link[file.pdf]{...}</c>) live. Deliberately a sibling of the handout prefix rather
    /// than nested under it, matching the flat per-type layout shared by problems, handouts, and user uploads.
    /// </summary>
    private const string DocumentsR2Prefix = "documents";

    /// <summary>
    /// File name of the global Asymptote helper module imported by every figure.
    /// Deliberately excluded from the dep graph used by staleness checks: edits to
    /// <c>_common.asy</c> are almost always additive helpers that cannot affect
    /// existing figures, so cascading invalidation across all ~30 figures every time
    /// a helper is added is pure waste. When a change to <c>_common.asy</c> DOES
    /// alter rendering of existing figures (palette tweak, modified function), the
    /// author opts in via <c>--force-asy</c> to recompile everything.
    /// </summary>
    private const string GlobalAsyDepFileName = "_common.asy";

    /// <summary>
    /// Derives the language-stripped handout slug from a .tex filename. Handles both
    /// main handouts (e.g. "factorization.cs.tex" -> "factorization") and their
    /// skeleton variants (e.g. "factorization.cs-skeleton.tex" -> "factorization").
    /// </summary>
    /// <param name="texFileName">The .tex filename (with extension).</param>
    /// <returns>The language-stripped handout slug.</returns>
    private static string ToHandoutSlug(string texFileName)
        => Regex.Replace(texFileName, @"\.([a-z]{2})(-skeleton)?\.tex$", "", RegexOptions.IgnoreCase);

    /// <summary>
    /// Reads the language a handout is written in off its filename (e.g. "factorization.cs.tex" -> "cs").
    /// Every handout names one, and a file that doesn't cannot be built.
    /// </summary>
    /// <param name="texFileName">The .tex filename (with extension).</param>
    /// <returns>The two-letter language code, lowercased.</returns>
    private static string ToHandoutLocale(string texFileName)
    {
        // The two-letter code sitting between the slug and the extension
        var localeMatch = Regex.Match(texFileName, @"\.([a-z]{2})\.tex$", RegexOptions.IgnoreCase);

        // Without one there is no telling which language's captions the handout wants
        if (!localeMatch.Success)
            throw new InvalidOperationException(
                $"'{texFileName}' does not name a language. A handout is named <slug>.<language>.tex, "
                + "e.g. factorization.cs.tex.");

        // Hand back the code, normalized to lowercase
        return localeMatch.Groups[1].Value.ToLowerInvariant();
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // We take handout .tex sources from here
        var inputDirectory = new DirectoryInfo(RepoPaths.Resolve("data/handouts"));

        // ..And their images from here
        var imagesDirectory = new DirectoryInfo(Path.Combine(inputDirectory.FullName, "Images"));

        // ..And output jsons for the web rendered here
        var jsonOutputDirectory = new DirectoryInfo(RepoPaths.Resolve("web/src/content/handouts"));

        // Anchor a relative error-log path beside the handout sources so it lands there no matter the CWD.
        var errorLogPath = Path.IsPathRooted(settings.ErrorLog)
            ? settings.ErrorLog
            : Path.Combine(inputDirectory.FullName, settings.ErrorLog);

        // Resolve the uploader...We don't need it if we're skipping uploads. Resolving it loads the upload ledger,
        // so a skipped run touches neither R2 config nor the ledger file.
        ITrackedFileUploader? uploader = null;
        if (!settings.SkipUpload)
        {
            uploader = trackedUploader.Value;
            AnsiConsole.MarkupLine("[green]✓ R2 uploader initialized[/]");
        }
        else
        {
            AnsiConsole.MarkupLine("[yellow]⚠ Uploads skipped (--skip-upload)[/]");
        }

        // Collect all files matching any of the provided patterns, excluding skeleton files.
        List<FileInfo> inputFiles = [..
            settings.Patterns
                .SelectMany(pattern => inputDirectory.GetFiles(pattern, SearchOption.TopDirectoryOnly))
                .Where(file => !file.Name.Contains("-skeleton"))
        ];

        // Check if any files were found.
        if (inputFiles.Count == 0)
        {
            AnsiConsole.MarkupLine("[yellow]Warning:[/] No files found matching pattern(s) in the input directory.");
            return 0;
        }

        // Display what we're processing.
        AnsiConsole.MarkupLine($"[aqua]Found {inputFiles.Count} handout file(s)[/]");
        AnsiConsole.WriteLine();

        // The TeX cleaning rules, per language, read the first time a handout in that language comes up.
        var rulesByLocale = new Dictionary<string, TeXCleanerRules>();

        // Track unknown commands across all files for a final report.
        var allUnknownCommands = new Dictionary<string, IReadOnlyCollection<string>>();

        // Track which files failed for the final report.
        var failedFiles = new List<string>();

        // .asy filenames already recompiled by an earlier handout in this run — language
        // variants of the same handout reference the same figures, so without this every
        // variant would re-run the same asy compile pipeline.
        var asyAlreadyRecompiled = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Process each discovered handout file.
        foreach (var inputFile in inputFiles)
        {
            // Log file
            AnsiConsole.MarkupLine($"[aqua]━━━ {Markup.Escape(inputFile.Name)} ━━━[/]");

            try
            {
                // Read the entire content of the .tex file into a string.
                var texContent = File.ReadAllText(inputFile.FullName);

                // The language this handout is written in, which decides how its captions are cleaned.
                var locale = ToHandoutLocale(inputFile.Name);

                // Its rules, loaded once per language and reused by every handout written in it.
                if (!rulesByLocale.TryGetValue(locale, out var rules))
                    rulesByLocale[locale] = rules = TeXCleanerRules.LoadRules(locale);

                // Parse the TeX content into the structured Document object model.
                var (document, unknownCommands) = TexStringParser.ParseDocument(texContent, rules);

                // Ensure every .asy-backed image is fresh on disk before anything downstream
                // reads the compiled PDF or SVG. --force-asy bypasses the staleness check and
                // recompiles every figure unconditionally.
                if (!settings.SkipAsy)
                    await EnsureAsyImagesFreshAsync(document, imagesDirectory, settings.ForceAsy, asyAlreadyRecompiled);
                else
                    AnsiConsole.MarkupLine("  [yellow]⚠ Asy compile skipped (--skip-asy)[/]");

                // Prepare the skeleton file info, should we generate it
                FileInfo? skeletonFile = null;

                // If we're actuallly compiling
                if (!settings.SkipCompile)
                {
                    // Generate the skeleton .tex
                    skeletonFile = GenerateSkeleton(inputFile, inputDirectory, rules, locale);

                    // The date both PDFs carry, taken from the handout even for the skeleton, which was written
                    // moments ago and would otherwise date itself to this run
                    var sourceEdited = inputFile.LastWriteTimeUtc;

                    // Compile the main handout
                    await CompileTexFileAsync(
                        inputFile, inputDirectory, settings.Compiler, errorLogPath, sourceEdited);

                    // Compile the skeleton
                    await CompileTexFileAsync(
                        skeletonFile, inputDirectory, settings.Compiler, errorLogPath, sourceEdited);
                }

                // Process images and prepare uploads (images + linked documents share this queue)
                var pendingUploads = new List<PendingUpload>();

                // Process images in the document content and collect their metadata
                var imageResult = ProcessHandoutImages(document, inputFile.Name, settings.SkipUpload ? null : pendingUploads);

                // Queue any handout-referenced documents (\Link[file.pdf]{...}) for upload alongside images
                if (!settings.SkipUpload)
                    CollectDocumentUploads(document, inputDirectory, handoutSlug: ToHandoutSlug(inputFile.Name), pendingUploads);

                // Serialize the handout data (document + images) to an indented JSON string
                var jsonString = new
                {
                    Document = imageResult.ProcessedDocument,
                    Images = imageResult.DiscoveredImages
                }
                .ToJson();

                // Normalize line endings to LF (Unix-style) for Git compatibility
                var normalizedContent = jsonString.Replace("\r\n", "\n") + "\n";

                // Generate the output filename by replacing .tex extension with .json.
                var outputFileName = Path.ChangeExtension(inputFile.Name, ".json");
                var outputFilePath = Path.Combine(jsonOutputDirectory.FullName, outputFileName);

                // Write the JSON output
                File.WriteAllText(outputFilePath, normalizedContent);

                // Report success
                AnsiConsole.MarkupLine($"  [green]✓ Parsed:[/] {Markup.Escape(outputFileName)}");

                // If unknown commands were found, add them to our report dictionary.
                if (!unknownCommands.IsEmpty)
                    allUnknownCommands[inputFile.Name] = unknownCommands;

                // Upload the queued assets (handout images + linked documents) and the PDFs to R2 (unless skipped)
                if (uploader is not null)
                {
                    // Push each queued asset, letting the tracker skip ones whose bytes are already on R2
                    // (unchanged since their last push, or covered by a sibling language variant this run).
                    var uploadedThisFile = 0;
                    foreach (var upload in pendingUploads)
                    {
                        // Upload only if changed; log the ones that actually went out (images and linked documents).
                        if (await uploader.UploadIfChangedAsync(upload.SourcePath, upload.R2Key))
                        {
                            uploadedThisFile++;
                            AnsiConsole.MarkupLine($"  [green]✓ Uploaded:[/] {Markup.Escape(Path.GetFileName(upload.SourcePath))}");
                        }
                    }

                    // Summary line so the publish run shows that unchanged assets were intentionally skipped.
                    var skippedUploadCount = pendingUploads.Count - uploadedThisFile;
                    if (skippedUploadCount > 0)
                        AnsiConsole.MarkupLine($"  [dim]· {skippedUploadCount} asset(s) unchanged, skipped upload[/]");

                    // PDFs only when we actually compiled them; otherwise the on-disk copies are
                    // from an earlier run and we'd risk publishing binaries that don't match the source.
                    if (skeletonFile is not null)
                    {
                        // Upload the main handout PDF
                        await UploadHandoutPdfAsync(inputFile, inputDirectory, uploader);

                        // Upload the skeleton PDF
                        await UploadHandoutPdfAsync(skeletonFile, inputDirectory, uploader);
                    }
                }
            }
            catch (Exception exception)
            {
                // Log the failure and continue to the next file
                failedFiles.Add(inputFile.Name);
                AnsiConsole.WriteException(exception, ExceptionFormats.ShortenEverything);
            }

            AnsiConsole.WriteLine();
        }

        // All handout files processed. The upload ledger persists itself when the uploader is disposed at exit.

        // Whether either generator below failed, which the run's exit code answers for
        var derivedRegenerationFailed = false;

        // Rebuild what the content JSONs derive: the environment-id index the site ships, and the defense-content
        // blobs the examiner is served from. Always the whole site rather than just this run's handouts, since it's
        // cheap and a scoped update would leave some other handout's numbers or problem text stale.
        if (!settings.SkipDerived)
        {
            // The index the site labels a saved conversation from
            derivedRegenerationFailed =
                !await RegenerateDerivedArtefactAsync("handouts:index", "handout-env-index.json");

            // Separate the two artefact sections in the output
            AnsiConsole.WriteLine();

            // The blobs, worth rebuilding even after the index failed, since neither generator reads the other
            derivedRegenerationFailed |=
                !await RegenerateDerivedArtefactAsync("handouts:defense-content", "defense content");

            // Push them, so the examiner sees an edited problem without a backend deploy
            if (uploader is not null)
                await UploadDefenseContentAsync(uploader);
        }
        else
        {
            // Say so, since a skipped rebuild leaves both artefacts describing whatever the last full run wrote
            AnsiConsole.MarkupLine("[yellow]⚠ Derived artefact regeneration skipped (--skip-derived)[/]");
        }

        // Report unknown commands if any were found.
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

            // Suggest next steps to the user.
            AnsiConsole.MarkupLine("\n[red]Please review the above unknown commands.[/]");
        }

        // Determine if there were any failures
        var hasErrors = failedFiles.Count > 0 || allUnknownCommands.Count > 0 || derivedRegenerationFailed;

        // Final success message if no errors or unknown commands were found.
        if (!hasErrors)
            AnsiConsole.MarkupLine("[bold green]\nAll files built successfully.[/]");

        // Return the exit code indicating if there were any errors.
        return hasErrors ? 1 : 0;
    }

    /// <summary>
    /// Generates a skeleton .tex file from a handout source file.
    /// Skeletons contain only statement blocks (exercises, problems, examples) with solutions removed.
    /// </summary>
    /// <param name="inputFile">The source .tex file.</param>
    /// <param name="outputDirectory">The directory to write the skeleton file to.</param>
    /// <param name="rules">The <see cref="TeXCleanerRules"/> for normalizing TeX content.</param>
    /// <param name="locale">The two-letter code of the language the source is written in.</param>
    /// <returns>The generated skeleton file.</returns>
    private static FileInfo GenerateSkeleton(
        FileInfo inputFile,
        DirectoryInfo outputDirectory,
        TeXCleanerRules rules,
        string locale)
    {
        // Read and parse the source TeX
        var texContent = File.ReadAllText(inputFile.FullName);
        var (document, _) = TexStringParser.ParseDocument(texContent, rules);

        // Extract preamble lines that need to be preserved.
        var inputLine = texContent.ExtractMatch(@"\\input\s+\S+");
        var authorLine = texContent.ExtractMatch(@"\\Author\{[^}]+\}");
        var mathcompsLinkLine = texContent.ExtractMatch(@"\\MathcompsLink\{[^}]+\}");

        // Flatten all sections and filter to keep only exercises, examples, and problems.
        var allStatements = document.Sections
            .SelectMany(section => section.Text.Content)
            .Where(block => block is Exercise or Problem or Example)
            .Select(block => block switch
            {
                Exercise exercise => exercise with { Solution = [], Answer = null },
                Problem problem => problem with { Solution = [], Hints = [], Answer = null },
                Example example => example with { Solution = [], Answer = null },
                _ => block
            })
            .ToImmutableList();

        // Build the complete skeleton TeX.
        var builder = new StringBuilder();

        // Preamble: \input _template
        if (inputLine is not null)
        {
            builder.AppendLine(inputLine);
            builder.AppendLine();
        }

        // \DisplayTextsfalse to hide non-statement content
        builder.AppendLine(@"\DisplayTextsfalse");
        builder.AppendLine();

        // \setlanguage{XX}, which the template spells in capitals
        builder.AppendLine($@"\setlanguage{{{locale.ToUpperInvariant()}}}");
        builder.AppendLine();

        // Title
        if (!string.IsNullOrEmpty(document.Title))
        {
            builder.AppendLine($@"\Title{{{document.Title}}}");
            builder.AppendLine();
        }

        // MathcompsLink
        if (mathcompsLinkLine is not null)
        {
            builder.AppendLine(mathcompsLinkLine);
            builder.AppendLine();
        }

        // Author
        if (authorLine is not null)
        {
            builder.AppendLine(authorLine);
            builder.AppendLine();
        }

        // Emit all statements without section headers.
        foreach (var block in allStatements)
        {
            TexEmitter.EmitBlock(builder, block);
            builder.AppendLine();
        }

        // Postamble: \bye
        builder.AppendLine(@"\bye");

        // Write the skeleton file
        var skeletonName = Path.GetFileNameWithoutExtension(inputFile.Name) + "-skeleton.tex";
        var skeletonPath = Path.Combine(outputDirectory.FullName, skeletonName);
        File.WriteAllText(skeletonPath, builder.ToString());

        // Success message
        AnsiConsole.MarkupLine($"  [green]✓ Skeleton:[/] {Markup.Escape(skeletonName)} ({allStatements.Count} statements)");

        // Return the generated skeleton file
        return new FileInfo(skeletonPath);
    }

    /// <summary>
    /// Compiles a TeX file using the configured compiler (2 passes).
    /// Throws on compilation failure.
    /// </summary>
    /// <param name="texFile">The .tex file to compile.</param>
    /// <param name="workingDirectory">The working directory for the compiler.</param>
    /// <param name="compiler">The compiler command to use.</param>
    /// <param name="errorLog">Path to the error log file for compiler output on failure.</param>
    /// <param name="sourceEdited">When the handout this PDF renders was last edited, which is the date it gets
    /// stamped with.</param>
    /// <returns>A task representing the asynchronous compilation.</returns>
    /// <remarks>Pinning the stamp is what lets a rebuild that changed nothing produce the same PDF twice, so the
    /// upload ledger recognises it: pdfTeX otherwise writes the current time into <c>/CreationDate</c>,
    /// <c>/ModDate</c> and the file <c>/ID</c> on every compile, and every handout PDF goes back up to R2. TeX's own
    /// <c>\year</c> and <c>\today</c> still read the real clock.</remarks>
    private static async Task CompileTexFileAsync(
        FileInfo texFile,
        DirectoryInfo workingDirectory,
        string compiler,
        string errorLog,
        DateTime sourceEdited)
    {
        // The date in the form pdfTeX reads it
        var sourceDateEnvironment = new Dictionary<string, string>
        {
            ["SOURCE_DATE_EPOCH"] = new DateTimeOffset(sourceEdited).ToUnixTimeSeconds().ToString()
        };

        // Run two passes as required by TeX for cross-references
        for (var pass = 1; pass <= 2; pass++)
        {
            // Status message
            AnsiConsole.MarkupLine($"  [dim]Compiling {Markup.Escape(texFile.Name)} (pass {pass}/2)...[/]");

            // Split the configured compiler string into executable + flags (whitespace-separated, no quoted args)
            var compilerParts = compiler.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var compilerExecutable = compilerParts[0];

            // Pass each flag as its own argv entry, then inject \def\PUBLISH{} before \input
            // reads the .tex. The template defaults \ReviewModetrue so manual local compiles
            // render inline review content; the \PUBLISH sentinel flips it off, producing
            // the publish form (where hints and solutions are not below statements but at the end)
            string[] arguments = [.. compilerParts.Skip(1), $@"\def\PUBLISH{{}}\input {texFile.Name}"];

            // Run the compiler; ProcessRunner drains stdout/stderr and reports the exit code
            var result = await ProcessRunner.RunAsync(
                compilerExecutable, arguments, workingDirectory.FullName, sourceDateEnvironment);

            // Check if compilation failed
            if (result.ExitCode != 0)
            {
                // Append the full compiler output to the error log for debugging
                File.AppendAllText(errorLog, $"=== {texFile.Name} (pass {pass}) ===\n{result.Stdout}\n{result.Stderr}\n");

                // Throw with context about which file and pass failed
                throw new InvalidOperationException(
                    $"Compilation of '{texFile.Name}' failed on pass {pass} (exit code {result.ExitCode}). See errors.log for details.");
            }
        }

        // Success message
        AnsiConsole.MarkupLine($"  [green]✓ Compiled:[/] {Markup.Escape(Path.ChangeExtension(texFile.Name, ".pdf"))}");
    }

    /// <summary>
    /// Regenerates one of the artefacts derived from the handout content JSONs by running the frontend's own
    /// generator script. Shelling out (rather than reimplementing the walk in C#) keeps each derived value defined in
    /// exactly one place: the environment's display number in <c>listDocumentEnvironments</c> and the examiner's view
    /// of a problem in <c>toDefenseContent</c>, both the same TypeScript the page itself uses, so neither artefact can
    /// drift from what the page shows.
    /// </summary>
    /// <param name="npmScript">The npm script that regenerates the artefact.</param>
    /// <param name="artefactName">What the artefact is called in the run's output.</param>
    /// <returns>True when the artefact was regenerated; false when the script failed, in which case its output has
    /// already been printed.</returns>
    private static async Task<bool> RegenerateDerivedArtefactAsync(string npmScript, string artefactName)
    {
        // Status message
        AnsiConsole.MarkupLine($"[aqua]━━━ {Markup.Escape(artefactName)} ━━━[/]");

        // Run the frontend's generator from its own project directory
        var webDirectory = RepoPaths.Resolve("web");
        var result = await ProcessRunner.RunAsync("npm", ["run", npmScript], webDirectory);

        // A non-zero exit means the generator itself failed; surface its output for debugging
        if (result.ExitCode != 0)
        {
            AnsiConsole.MarkupLine($"[red]✗ Failed to regenerate {Markup.Escape(artefactName)} (exit {result.ExitCode}).[/]");
            AnsiConsole.WriteLine($"{result.Stdout}\n{result.Stderr}");
            return false;
        }

        // Success message
        AnsiConsole.MarkupLine($"[green]✓ Regenerated {Markup.Escape(artefactName)}[/]");
        return true;
    }

    /// <summary>
    /// Pushes the generated defense-content blobs to R2, where the API reads a problem's statement and reference
    /// from rather than taking a caller's word for them. Every blob goes up in one pass after the run's handouts are
    /// parsed, since a blob is built from the whole site's content rather than from one .tex.
    /// </summary>
    /// <param name="uploader">The uploader the blobs go through.</param>
    private static async Task UploadDefenseContentAsync(ITrackedFileUploader uploader)
    {
        // The generator's output directory, gitignored build output like the compiled PDFs beside it
        var defenseDirectory = new DirectoryInfo(RepoPaths.Resolve("data/handouts/defense"));

        // The directory only exists once a generator run has written into it
        if (!defenseDirectory.Exists)
        {
            // Say why nothing went out, so a silent step doesn't read as a successful push
            AnsiConsole.MarkupLine("  [yellow]⚠ No defense content generated, nothing to upload[/]");

            // There is nothing to push
            return;
        }

        // Every blob this run produced, in name order so the log reads the same way twice
        var blobs = defenseDirectory
            .EnumerateFiles("*.json")
            .OrderBy(file => file.Name, StringComparer.Ordinal)
            .ToList();

        // How many actually left the machine, as opposed to being recognised by the ledger
        var uploadedCount = 0;

        // Offer each to the tracker, which pushes only the ones whose bytes R2 doesn't already have
        foreach (var blob in blobs)
        {
            // Count the ones it decided to send
            if (await uploader.UploadIfChangedAsync(blob.FullName, HandoutStorage.DefenseContentKeyForFile(blob.Name)))
                uploadedCount++;
        }

        // What stayed put, which is the whole set on a run that changed no handout
        var skippedCount = blobs.Count - uploadedCount;

        // Report both, so an unchanged run reads as deliberate rather than as a step that did nothing
        AnsiConsole.MarkupLine($"  [green]✓ {uploadedCount} defense blob(s) uploaded[/][dim], {skippedCount} unchanged[/]");
    }

    /// <summary>
    /// Uploads a compiled handout PDF (main or skeleton) to remote storage under
    /// the flat <c>handouts/pdfs/</c> folder shared by every handout.
    /// </summary>
    /// <param name="texFile">The .tex file whose corresponding PDF should be uploaded.</param>
    /// <param name="sourceDirectory">The directory containing the compiled PDFs.</param>
    /// <param name="fileUploader">The file uploader instance.</param>
    /// <returns>A task representing the asynchronous upload operation.</returns>
    private static async Task UploadHandoutPdfAsync(FileInfo texFile, DirectoryInfo sourceDirectory, IFileUploader fileUploader)
    {
        // Determine the PDF filename from the TeX filename
        var pdfFileName = Path.ChangeExtension(texFile.Name, ".pdf");
        var sourcePdfPath = Path.Combine(sourceDirectory.FullName, pdfFileName);

        // Check if the compiled PDF exists
        if (!File.Exists(sourcePdfPath))
        {
            AnsiConsole.MarkupLine($"  [yellow]⚠ PDF not found:[/] {Markup.Escape(pdfFileName)}");
            return;
        }

        // All handout PDFs share the flat handouts/pdfs/ folder
        var r2Key = HandoutStorage.PdfKey(pdfFileName);

        // Do the upload
        await fileUploader.UploadAsync(sourcePdfPath, r2Key);

        // Log success
        AnsiConsole.MarkupLine($"  [green]✓ PDF uploaded:[/] {Markup.Escape(pdfFileName)}");
    }

    /// <summary>
    /// Processes images in a handout document by walking through all sections and their content.
    /// Discovered images are queued for async upload after processing completes.
    /// </summary>
    /// <param name="document">The parsed <see cref="Document"/>.</param>
    /// <param name="sourceFileName">The source .tex file name (e.g., "factorization.cs.tex").</param>
    /// <param name="pendingUploads">List to collect image uploads for async execution. Null when uploads are skipped.</param>
    /// <returns>An <see cref="HandoutImageResult"/> containing the processed document and discovered images.</returns>
    private static HandoutImageResult ProcessHandoutImages(Document document, string sourceFileName, List<PendingUpload>? pendingUploads)
    {
        // Language-stripped handout slug shared by every language variant of this handout.
        var handoutSlug = ToHandoutSlug(sourceFileName);

        // Source directory for handout images
        var handoutsDirectory = RepoPaths.Resolve("data/handouts/Images");

        // In .tex sources images are referenced as "<name>.pdf" because pdfcsplain embeds
        // PDFs. The web frontend wants SVGs, which sit alongside the PDFs on disk
        // This swaps the extension so callers can read it as "the SVG counterpart of <pdfId>".
        static string ToSvgName(string pdfImageId) => $"{pdfImageId.RemoveEnd(".pdf")}.svg";

        // Configure the image processor for this handout
        var config = new ImageProcessingConfig(
            ImageSourceResolver: imageId => Path.Combine(handoutsDirectory, ToSvgName(imageId)),
            OutputFileName: (imageId, _) => $"{handoutSlug}/{ToSvgName(imageId)}",
            PersistImage: (sourcePath, contentId) =>
            {
                // Queue the image upload for async execution after processing completes
                pendingUploads?.Add(new PendingUpload(sourcePath, HandoutStorage.AssetKey(contentId)));
            },
            OnMissingImage: imageId => AnsiConsole.MarkupLine($"[yellow]Warning:[/] Handout [yellow]{handoutSlug}[/] has a missing image: {imageId}")
        );

        // Collect all discovered images from all sections
        var allDiscoveredImages = ImmutableList.CreateBuilder<ImageData>();

        // Start with initial state for shared counter and deduplication
        var state = ImageProcessingState.Initial;

        // Process each section's content because we need to
        // change image ids to svg ids + upload images to R2
        var processedSections = document.Sections.Select(section =>
        {
            // Process the section's text, chaining state between sections
            var result = TexImageProcessor.Process(section.Text, config, state.ResetImages());

            // Update state for next section (preserves counter and processed map)
            state = result.State;

            // Accumulate discovered images
            allDiscoveredImages.AddRange(result.DiscoveredImages);

            // Return section with processed text
            return section with { Text = result.ProcessedText };
        });

        // Return the document with processed sections and all discovered images
        return new(
            document with { Sections = [.. processedSections] },
            allDiscoveredImages.ToImmutable()
        );
    }

    /// <summary>
    /// Walks the parsed <see cref="Document"/> and returns the set of distinct
    /// image identifiers it references. For handouts these are <c>&lt;name&gt;.pdf</c>
    /// strings — the same ids that <see cref="ProcessHandoutImages"/> would later
    /// resolve to SVGs.
    /// </summary>
    /// <param name="document">The parsed document to scan.</param>
    /// <returns>The distinct image ids referenced anywhere in the document.</returns>
    private static ImmutableHashSet<string> CollectImageIds(Document document)
    {
        // Accumulator for image ids discovered during the traversal
        var idsBuilder = ImmutableHashSet.CreateBuilder<string>();

        // Walk every section's content tree; the side-effecting closure captures image ids
        foreach (var section in document.Sections)
        {
            // ContentTree.Map recurses into every nested container (paragraphs, exercises,
            // problem hints, theorem proofs, list items, etc.) — same coverage as the image processor
            ContentTree.Map(section.Text.Content, node =>
            {
                // Image nodes are the only nodes we care about; everything else passes through
                if (node is Image image)
                    idsBuilder.Add(image.Id);

                // Return the same reference to signal "no transformation"
                return node;
            });
        }

        // Frozen result for staleness lookups
        return idsBuilder.ToImmutable();
    }

    /// <summary>
    /// Scans the parsed <see cref="Document"/> for handout-referenced documents and queues
    /// each one for upload to R2. These come from <c>\Link[file.pdf]{...}</c> macros, which
    /// the parser emits as <see cref="Link"/> nodes; a link whose URL is a bare filename
    /// (not an absolute <c>http(s)</c> URL) is a downloadable document that lives under
    /// <c>data/handouts/Documents</c> and is served from the <see cref="DocumentsR2Prefix"/>
    /// folder on R2. External (<c>http(s)</c>) links are left untouched. Mirrors
    /// <see cref="CollectImageIds"/>'s traversal so every nested container is covered.
    /// </summary>
    /// <param name="document">The parsed handout document to scan.</param>
    /// <param name="inputDirectory">The <c>data/handouts</c> directory; documents sit in its <c>Documents</c> subfolder.</param>
    /// <param name="handoutSlug">The language-stripped handout slug, used only for warning messages.</param>
    /// <param name="pendingUploads">The shared upload queue document uploads are appended to.</param>
    private static void CollectDocumentUploads(
        Document document,
        DirectoryInfo inputDirectory,
        string handoutSlug,
        List<PendingUpload> pendingUploads)
    {
        // Source folder for downloadable documents, a sibling of the .tex sources and Images/
        var documentsDirectory = Path.Combine(inputDirectory.FullName, "Documents");

        // Distinct local document filenames referenced anywhere in the document
        var documentFileNames = ImmutableHashSet.CreateBuilder<string>(StringComparer.Ordinal);

        // Walk every section's content tree; the side-effecting closure captures link targets
        foreach (var section in document.Sections)
        {
            // Same recursive coverage as CollectImageIds — links can live inside any container
            ContentTree.Map(section.Text.Content, node =>
            {
                // Only Link nodes matter, and only those pointing at a local file (not an external URL)
                if (node is Link link && !Regex.IsMatch(link.Url, "^https?://", RegexOptions.IgnoreCase))
                    documentFileNames.Add(link.Url);

                // Return the same reference to signal "no transformation"
                return node;
            });
        }

        // Queue each distinct document, warning when its source file is missing
        foreach (var fileName in documentFileNames)
        {
            // Documents are referenced by bare filename and live directly under data/handouts/Documents
            var sourcePath = Path.Combine(documentsDirectory, fileName);

            // A referenced-but-missing document is an authoring error — surface it, don't queue it
            if (!File.Exists(sourcePath))
            {
                AnsiConsole.MarkupLine($"[yellow]Warning:[/] Handout [yellow]{handoutSlug}[/] links a missing document: {Markup.Escape(fileName)}");
                continue;
            }

            // Flat documents/<file> key — the per-type layout shared by problems, handouts, and user uploads
            pendingUploads.Add(new PendingUpload(sourcePath, $"{DocumentsR2Prefix}/{fileName}"));
        }
    }

    /// <summary>
    /// Resolves the transitive set of source files that a given <c>.asy</c> figure
    /// depends on. Walks <c>import &lt;name&gt;;</c> and <c>include "&lt;name.asy&gt;";</c>
    /// directives, resolving each to a sibling file in <paramref name="imagesDir"/>.
    /// Built-in Asymptote modules (e.g. <c>three</c>) resolve to no file and are ignored.
    /// </summary>
    /// <param name="asyPath">Absolute path to the <c>.asy</c> file to scan.</param>
    /// <param name="imagesDir">Directory containing handout figure sources.</param>
    /// <param name="memo">Shared cache across the batch so shared files (<c>_common.asy</c>, family-shared files) are scanned once.</param>
    /// <returns>The <c>.asy</c> file itself plus every transitively resolved dependency.</returns>
    private static ImmutableHashSet<string> ResolveAsyDeps(
        string asyPath,
        DirectoryInfo imagesDir,
        Dictionary<string, ImmutableHashSet<string>> memo)
    {
        // Memo hit — shared file already scanned by a sibling figure
        if (memo.TryGetValue(asyPath, out var cached))
            return cached;

        // Seed with the file itself; transitive deps grow the set below
        var depsBuilder = ImmutableHashSet.CreateBuilder<string>();
        depsBuilder.Add(asyPath);

        // Read once for both import and include scans
        var content = File.ReadAllText(asyPath);

        // Resolve a candidate dependency: relative to imagesDir and only if the file exists.
        // Unresolved candidates (built-in asy modules like `three`) are silently dropped.
        void TryAddDep(string fileName)
        {
            // Exclude the global helper module from the dep graph (see GlobalAsyDepFileName remarks)
            if (string.Equals(fileName, GlobalAsyDepFileName, StringComparison.OrdinalIgnoreCase))
                return;

            // Combine with the figures directory; absolute path keeps the memo key stable
            var candidate = Path.Combine(imagesDir.FullName, fileName);

            // Skip anything that doesn't map to a real .asy in our figures dir
            if (!File.Exists(candidate))
                return;

            // Recursively pull in the candidate's own deps and union them in
            foreach (var dep in ResolveAsyDeps(candidate, imagesDir, memo))
                depsBuilder.Add(dep);
        }

        // `import <name>;` — bare module name, treat as `<name>.asy` in the figures dir
        foreach (Match match in Regex.Matches(content, @"^\s*import\s+([A-Za-z_][A-Za-z0-9_]*)\s*;", RegexOptions.Multiline))
            TryAddDep(match.Groups[1].Value + ".asy");

        // `include "<path>";` — quoted file path; the extension is optional in Asymptote so normalise it
        foreach (Match match in Regex.Matches(content, @"^\s*include\s+""([^""]+)""\s*;", RegexOptions.Multiline))
        {
            // Preserve caller-supplied extension; otherwise normalise to .asy
            var raw = match.Groups[1].Value;
            var fileName = raw.EndsWith(".asy", StringComparison.OrdinalIgnoreCase) ? raw : raw + ".asy";
            TryAddDep(fileName);
        }

        // `include <name>;` — unquoted module form, same resolution as the bare `import`
        foreach (Match match in Regex.Matches(content, @"^\s*include\s+([A-Za-z_][A-Za-z0-9_]*)\s*;", RegexOptions.Multiline))
            TryAddDep(match.Groups[1].Value + ".asy");

        // Freeze and memoize for future lookups
        var result = depsBuilder.ToImmutable();
        memo[asyPath] = result;
        return result;
    }

    /// <summary>
    /// Determines whether a figure's compiled outputs are stale relative to its source(s).
    /// A figure is stale when either output (PDF or SVG) is missing, or when any source
    /// in <paramref name="sources"/> has a newer mtime than the OLDER of the two outputs.
    /// </summary>
    /// <param name="sources">The source files that contribute to the compiled outputs (the .asy plus its transitive includes/imports).</param>
    /// <param name="pdfPath">Absolute path to the figure's compiled PDF.</param>
    /// <param name="svgPath">Absolute path to the figure's compiled SVG.</param>
    /// <returns><c>true</c> if a recompile is required; <c>false</c> if both outputs are up to date.</returns>
    private static bool IsImageStale(ImmutableHashSet<string> sources, string pdfPath, string svgPath)
    {
        // A missing output unambiguously means the figure must be (re)compiled
        if (!File.Exists(pdfPath) || !File.Exists(svgPath))
            return true;

        // Compare against the OLDER output — if either is behind the source, we need to rebuild
        var pdfMtime = File.GetLastWriteTimeUtc(pdfPath);
        var svgMtime = File.GetLastWriteTimeUtc(svgPath);
        var oldestOutput = pdfMtime < svgMtime ? pdfMtime : svgMtime;

        // Any source newer than the older output means the outputs are out of sync with the source
        return sources.Any(source => File.GetLastWriteTimeUtc(source) > oldestOutput);
    }

    /// <summary>
    /// Invokes <c>export-asy.sh</c> via <c>bash</c> with an explicit list of stale <c>.asy</c>
    /// files. The script renders each figure twice: once with <c>asy -f pdf</c> for the
    /// TeX-consumed PDF and once with <c>asy -f svg</c> for the web-consumed SVG.
    /// </summary>
    /// <param name="staleAsyFileNames">Filenames (not absolute paths) of stale <c>.asy</c> files inside <paramref name="imagesDir"/>.</param>
    /// <param name="imagesDir">Directory containing the <c>.asy</c> files and the export script.</param>
    /// <returns>A task representing the asynchronous export run.</returns>
    private static async Task RunAsyExportScriptAsync(IReadOnlyList<string> staleAsyFileNames, DirectoryInfo imagesDir)
    {
        // Locate the export script next to the .asy sources
        var scriptPath = Path.Combine(imagesDir.FullName, "export-asy.sh");

        // Build the bash argv: the script path, then the stale .asy filenames it should render.
        string[] arguments = [scriptPath, .. staleAsyFileNames];

        // Run the export script under bash
        var result = await ProcessRunner.RunAsync("bash", arguments, imagesDir.FullName);

        // Non-zero exit means at least one .asy failed — surface everything for debugging
        if (result.ExitCode != 0)
            throw new InvalidOperationException(
                $"Asymptote export script failed (exit {result.ExitCode}).\n--- stdout ---\n{result.Stdout}\n--- stderr ---\n{result.Stderr}");
    }

    /// <summary>
    /// Checks every <c>.asy</c>-backed image referenced by the document for staleness
    /// (against its own source plus its transitive <c>include</c>/<c>import</c> deps,
    /// excluding the global <c>_common.asy</c>) and batch-recompiles only the stale
    /// ones via <c>export-asy.sh</c>. Images that have no sibling <c>.asy</c> (raster
    /// or externally-authored PDFs) are silently skipped — those are not produced by
    /// the asy pipeline.
    /// </summary>
    /// <param name="document">The parsed handout document whose images should be ensured fresh.</param>
    /// <param name="imagesDir">Directory containing the <c>.asy</c> sources, compiled PDFs/SVGs, and the export script.</param>
    /// <param name="forceRecompile">When true, every <c>.asy</c>-backed image is recompiled regardless of staleness — used after a semantic <c>_common.asy</c> edit.</param>
    /// <param name="alreadyRecompiled">Cross-handout set of <c>.asy</c> filenames already recompiled in this CLI run; entries here are treated as fresh and not requeued. Updated with each batch.</param>
    /// <returns>A task representing the asynchronous freshness check and any recompiles it triggers.</returns>
    private static async Task EnsureAsyImagesFreshAsync(
        Document document,
        DirectoryInfo imagesDir,
        bool forceRecompile,
        HashSet<string> alreadyRecompiled)
    {
        // Collect the set of image ids referenced anywhere in the document
        var imageIds = CollectImageIds(document);

        // Shared dep memo across this handout — family-shared files are scanned once even if every figure in the family imports them
        var depMemo = new Dictionary<string, ImmutableHashSet<string>>();

        // Stale .asy filenames to batch-compile; populated as we walk the image set
        var staleFileNames = new List<string>();

        // Count of asy-backed images that turned out to already be fresh — purely for the summary line
        var freshCount = 0;

        // Walk every distinct image id; partition into asy-backed-fresh, asy-backed-stale, or non-asy (skipped)
        foreach (var imageId in imageIds)
        {
            // Image.Id is "<name>.pdf" for handouts; the backing source has the same stem with a .asy extension
            var asyFileName = Path.ChangeExtension(imageId, ".asy");
            var asyPath = Path.Combine(imagesDir.FullName, asyFileName);

            // No sibling .asy means this image is externally authored (raster, hand-drawn PDF, etc.) — leave it alone
            if (!File.Exists(asyPath))
                continue;

            // An earlier handout in this run already recompiled this figure — count it as fresh, don't requeue
            if (alreadyRecompiled.Contains(asyFileName))
            {
                freshCount++;
                continue;
            }

            // Outputs live next to the source under the same stem
            var pdfPath = Path.Combine(imagesDir.FullName, imageId);
            var svgPath = Path.Combine(imagesDir.FullName, Path.ChangeExtension(imageId, ".svg"));

            // Is this stale?
            bool stale;

            // Force flag short-circuits the dep walk entirely; 
            if (forceRecompile)
            {
                stale = true;
            }
            else
            {
                // Otherwise compare source mtimes against output mtimes for the file and its deps
                var deps = ResolveAsyDeps(asyPath, imagesDir, depMemo);
                stale = IsImageStale(deps, pdfPath, svgPath);
            }

            // Stale ⇒ queue for batch compile; 
            if (stale)
            {
                AnsiConsole.MarkupLine($"  [yellow]↻ Asy:[/] recompiling {Markup.Escape(asyFileName)}");
                staleFileNames.Add(asyFileName);
            }
            // fresh ⇒ bump the count for the summary
            else
            {
                freshCount++;
            }
        }

        // Nothing to recompile...
        if (staleFileNames.Count == 0)
        {
            // Emit a summary if any asy-backed images were inspected
            if (freshCount > 0)
                AnsiConsole.MarkupLine($"  [green]✓ Asy:[/] all {freshCount} image(s) fresh");

            return;
        }

        // One bash invocation for the whole batch — export-asy.sh iterates internally
        await RunAsyExportScriptAsync(staleFileNames, imagesDir);
        AnsiConsole.MarkupLine($"  [green]✓ Asy:[/] {staleFileNames.Count} image(s) recompiled");

        // Record what we just compiled so later handouts in this run don't redo the same work
        foreach (var fileName in staleFileNames)
            alreadyRecompiled.Add(fileName);
    }
}

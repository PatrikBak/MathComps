using MathComps.Infrastructure.Storage;
using MathComps.TexParser;
using MathComps.TexParser.Images;
using MathComps.TexParser.TexCleaner;
using MathComps.TexParser.Types;
using Microsoft.Extensions.Logging;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;
using System.Net.Mime;
using System.Text;
using System.Text.RegularExpressions;
using MathComps.Shared.Serialization;
using MathComps.Shared.Extensions;
using MathComps.Shared.Diagnostics;
using MathComps.Shared.Cli;

namespace MathComps.Cli.Handouts.Commands;

/// <summary>
/// The main orchestration command for the handout pipeline. It recompiles stale Asymptote figures, generates
/// skeletons, compiles TeX to PDF, parses TeX to JSON, regenerates the artefacts derived from that JSON, and
/// uploads what the site serves to Cloudflare R2.
/// </summary>
/// <param name="publicUploader">A lazily-resolved deduping uploader for pushing assets to the public bucket,
/// skipping ones unchanged since their last upload.</param>
/// <param name="privateStore">A lazily-resolved private store for the examiner's problem content, which only the API
/// reads.</param>
/// <param name="logger">The logger the build's progress and failures go through.</param>
[Description("Builds handouts: generates skeletons, compiles TeX, parses it to JSON, and uploads assets.")]
public class BuildCommand(
    Lazy<ITrackedFileUploader> publicUploader, Lazy<IPrivateObjectStore> privateStore, ILogger<BuildCommand> logger)
    : AsyncCommand<BuildCommand.Settings>
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
        [Description("TeX compiler command with flags")]
        [DefaultValue("pdfcsplain -interaction=nonstopmode -halt-on-error")]
        public required string Compiler { get; set; }

        /// <summary>
        /// Whether to skip the TeX compilation step. Useful during parser development
        /// when you only want to re-parse existing files without recompiling.
        /// </summary>
        [CommandOption("--skip-compile")]
        [Description("Skip TeX compilation and skeleton generation, only parse")]
        public bool SkipCompile { get; set; }

        /// <summary>
        /// Whether to skip uploading files to Cloudflare R2. Useful during local
        /// development when you only need the JSON output without R2 credentials.
        /// </summary>
        [CommandOption("--skip-upload")]
        [Description("Skip uploading PDFs, images, linked documents and defense content to R2")]
        public bool SkipUpload { get; set; }

        /// <summary>
        /// Whether the uploads go to prod's bucket rather than the dev one.
        /// </summary>
        [CommandOption("--publish")]
        [Description("Upload to prod's bucket. Needs the prod R2 keys, which publish-handouts.sh loads")]
        public bool Publish { get; set; }

        /// <summary>
        /// Whether to skip the Asymptote staleness check and recompilation. Useful when the author is confident the
        /// images are up to date and wants to skip the per-handout dependency scan, or in CI, which has no Asymptote
        /// installed.
        /// </summary>
        [CommandOption("--skip-asy")]
        [Description("Skip Asymptote staleness check and recompilation")]
        public bool SkipAsy { get; set; }

        /// <summary>
        /// Whether to recompile every Asymptote-backed image, bypassing the staleness check. It's for a change to
        /// <c>_common.asy</c> that alters existing figures (a palette tweak, a modified helper), which the staleness
        /// check never sees (see <see cref="GlobalAsyDepFileName"/>).
        /// </summary>
        [CommandOption("--force-asy")]
        [Description("Recompile every Asymptote-backed image regardless of staleness")]
        public bool ForceAsy { get; set; }

        /// <summary>
        /// Whether to skip regenerating the artefacts derived from the content JSONs: the committed environment-id
        /// index and the examiner's defense-content blobs. The frontend's own generator scripts build them, so this
        /// skips every step that needs <c>web/</c>'s dependencies installed.
        /// </summary>
        [CommandOption("--skip-derived")]
        [Description("Skip regenerating handout-env-index.json and the defense content (needs web/ dependencies)")]
        public bool SkipDerived { get; set; }

        /// <summary>
        /// Path to the error log file for compiler output on failure.
        /// </summary>
        [CommandOption("--error-log")]
        [Description("Path to error log file for compiler failures")]
        [DefaultValue("errors.log")]
        public required string ErrorLog { get; set; }

        /// <inheritdoc/>
        /// <remarks>Refuses a run whose R2 keys disagree with <see cref="Publish"/>.</remarks>
        public override ValidationResult Validate() =>
            // Stop before anything is built when the keys would send the uploads to the other bucket
            PublishKeys.Mismatch(Publish) is { } mismatch
                ? ValidationResult.Error(mismatch)
                : ValidationResult.Success();
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
    /// File name of the global Asymptote helper module imported by every figure. It stays out of the dependency graph
    /// the staleness check walks: an edit to <c>_common.asy</c> almost always adds a helper that cannot affect existing
    /// figures, so invalidating every figure each time one is added is pure waste. When a change DOES alter existing
    /// figures (a palette tweak, a modified function), the author opts in with <see cref="Settings.ForceAsy"/> to
    /// recompile everything.
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

        // The public bucket's uploader...We don't need it if we're skipping uploads
        ITrackedFileUploader? uploader = null;

        // The store the defense content goes to, resolved with the uploader so missing R2 config fails the run
        // before any TeX compiles
        IPrivateObjectStore? defenseContentStore = null;

        // Resolve both only for an uploading run, since resolving loads the upload ledger and reads the R2 config
        if (!settings.SkipUpload)
        {
            // Build the uploader, loading its ledger
            uploader = publicUploader.Value;

            // Build the store
            defenseContentStore = privateStore.Value;

            // Say they're ready
            logger.LogInformation("R2 storage initialized");
        }
        else
        {
            // Say so, since nothing this run builds goes up to R2
            logger.LogWarning("Uploads skipped (--skip-upload)");
        }

        // Collect all files matching any of the provided patterns, excluding skeleton files.
        List<FileInfo> inputFiles = [..
            settings.Patterns
                .SelectMany(pattern => inputDirectory.GetFiles(pattern, SearchOption.TopDirectoryOnly))
                .Where(file => !file.Name.Contains("-skeleton"))
        ];

        // Nothing matched the patterns.
        if (inputFiles.Count == 0)
        {
            // Warn about it.
            logger.LogWarning("No files found matching pattern(s) in the input directory.");

            // An empty run is no failure.
            return 0;
        }

        // Log how many handouts the run builds.
        logger.LogInformation("Found {Count} handout file(s)", inputFiles.Count);

        // The TeX cleaning rules, per language, read the first time a handout in that language comes up.
        var rulesByLocale = new Dictionary<string, TeXCleanerRules>();

        // The unknown commands each file turned up, keyed by file name.
        var allUnknownCommands = new Dictionary<string, IReadOnlyCollection<string>>();

        // The files that failed to build.
        var failedFiles = new List<string>();

        // The .asy filenames an earlier handout in this run already recompiled. Language variants of one handout
        // reference the same figures, so without this every variant would re-run the same asy compile pipeline.
        var asyAlreadyRecompiled = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Process each discovered handout file.
        foreach (var inputFile in inputFiles)
        {
            // Head the file's log lines with its name
            logger.LogInformation("━━━ {File} ━━━", inputFile.Name);

            // Build the file, and on a failure log it and carry on with the next one
            try
            {
                // Read the entire content of the .tex file into a string.
                var texContent = File.ReadAllText(inputFile.FullName);

                // The language this handout is written in, which decides how its captions are cleaned.
                var locale = ToHandoutLocale(inputFile.Name);

                // The language's cleaning rules, loaded once per language and reused by every handout in it.
                if (!rulesByLocale.TryGetValue(locale, out var rules))
                    rulesByLocale[locale] = rules = TeXCleanerRules.LoadRules(locale);

                // Parse the TeX content into the structured Document object model.
                var (document, unknownCommands) = TexStringParser.ParseDocument(texContent, rules);

                // Make every .asy-backed image fresh on disk before anything downstream reads its compiled PDF or SVG
                if (!settings.SkipAsy)
                    await EnsureAsyImagesFreshAsync(
                        document, imagesDirectory, settings.ForceAsy, asyAlreadyRecompiled);

                // A run skipping it says so, since the figures on disk may then be stale
                else
                    logger.LogWarning("  Asy compile skipped (--skip-asy)");

                // Prepare the skeleton file info, should we generate it
                FileInfo? skeletonFile = null;

                // If we're actually compiling
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

                // The upload queue the handout's images and linked documents share
                var pendingUploads = new List<PendingUpload>();

                // Process images in the document content and collect their metadata
                var imageResult = ProcessHandoutImages(
                    document, inputFile.Name, settings.SkipUpload ? null : pendingUploads);

                // Queue any handout-referenced documents (\Link[file.pdf]{...}) for upload alongside images
                if (!settings.SkipUpload)
                    CollectDocumentUploads(
                        document, inputDirectory, handoutSlug: ToHandoutSlug(inputFile.Name), pendingUploads);

                // Serialize the handout data (document + images) to an indented JSON string
                var jsonString = new
                {
                    Document = imageResult.ProcessedDocument,
                    Images = imageResult.DiscoveredImages
                }
                .ToJson();

                // Normalize line endings to LF (Unix-style) and end with a newline, for Git compatibility
                var normalizedContent = jsonString.Replace("\r\n", "\n") + "\n";

                // Generate the output filename by replacing .tex extension with .json.
                var outputFileName = Path.ChangeExtension(inputFile.Name, ".json");
                var outputFilePath = Path.Combine(jsonOutputDirectory.FullName, outputFileName);

                // Write the JSON output
                File.WriteAllText(outputFilePath, normalizedContent);

                // Report success
                logger.LogInformation("  Parsed: {File}", outputFileName);

                // If unknown commands were found, add them to our report dictionary.
                if (!unknownCommands.IsEmpty)
                    allUnknownCommands[inputFile.Name] = unknownCommands;

                // Upload the queued assets (handout images + linked documents) and the PDFs to R2 (unless skipped)
                if (uploader is not null)
                {
                    // How many of the file's queued assets actually went up
                    var uploadedThisFile = 0;

                    // Push each queued asset, letting the tracker skip ones whose bytes are already on R2
                    // (unchanged since their last push, or covered by a sibling language variant this run).
                    foreach (var upload in pendingUploads)
                    {
                        // Upload it only if its bytes changed
                        if (await uploader.UploadIfChangedAsync(upload.SourcePath, upload.R2Key))
                        {
                            // Count it as sent
                            uploadedThisFile++;

                            // Name it in the log
                            logger.LogInformation("  Uploaded: {File}", Path.GetFileName(upload.SourcePath));
                        }
                    }

                    // The queued assets the tracker left alone as unchanged
                    var skippedUploadCount = pendingUploads.Count - uploadedThisFile;

                    // Say how many, so the publish run shows unchanged assets were skipped on purpose
                    if (skippedUploadCount > 0)
                        logger.LogInformation("  {Count} asset(s) unchanged, skipped upload", skippedUploadCount);

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
                // Note the file as failed
                failedFiles.Add(inputFile.Name);

                // Log why it failed
                logger.LogError(exception, "{File} failed", inputFile.Name);
            }
        }

        // All handout files processed. The upload ledger persists itself when the uploader is disposed at exit.

        // Whether regenerating any derived artefact failed, which the run's exit code answers for
        var derivedRegenerationFailed = false;

        // Rebuild what the content JSONs derive: the environment-id index the site ships, and the defense-content
        // blobs the examiner is served from. Always the whole site rather than just this run's handouts, since it's
        // cheap and a scoped update would leave some other handout's numbers or problem text stale.
        if (!settings.SkipDerived)
        {
            // Rebuild the environment-id index
            derivedRegenerationFailed =
                !await RegenerateDerivedArtefactAsync("handouts:index", "handout-env-index.json");

            // Rebuild the defense-content blobs, even after the index failed, since their generator never reads it
            var defenseContentRegenerated =
                await RegenerateDerivedArtefactAsync("handouts:defense-content", "defense content");

            // Count a failed rebuild against the run
            derivedRegenerationFailed |= !defenseContentRegenerated;

            // Push the blobs once rebuilt, so the examiner sees an edited problem without a backend deploy. A failed
            // rebuild leaves an earlier run's blobs on disk, which may come from another branch
            if (defenseContentStore is not null && defenseContentRegenerated)
                await UploadDefenseContentAsync(defenseContentStore);
        }
        else
        {
            // Say so, since a skipped rebuild leaves every derived artefact describing whatever the last full run wrote
            logger.LogWarning("Derived artefact regeneration skipped (--skip-derived)");
        }

        // Report unknown commands if any were found.
        if (allUnknownCommands.Count != 0)
        {
            // One line per unknown command, naming the file it turned up in.
            foreach (var (fileName, commands) in allUnknownCommands)
                foreach (var command in commands)
                    logger.LogError("{File}: \\{Command} is not covered by a 'leave' rule", fileName, command);

            // Suggest next steps to the user.
            logger.LogError("Please review the above unknown commands.");
        }

        // Determine if there were any failures
        var hasErrors = failedFiles.Count > 0 || allUnknownCommands.Count > 0 || derivedRegenerationFailed;

        // Final success message if no errors or unknown commands were found.
        if (!hasErrors)
            logger.LogInformation("All files built successfully.");

        // Return the exit code indicating if there were any errors.
        return hasErrors ? 1 : 0;
    }

    /// <summary>
    /// Generates a skeleton .tex file from a handout source file.
    /// Skeletons contain only statement blocks (exercises, problems, examples), stripped of solutions, hints and
    /// answers.
    /// </summary>
    /// <param name="inputFile">The source .tex file.</param>
    /// <param name="outputDirectory">The directory to write the skeleton file to.</param>
    /// <param name="rules">The <see cref="TeXCleanerRules"/> for normalizing TeX content.</param>
    /// <param name="locale">The two-letter code of the language the source is written in.</param>
    /// <returns>The generated skeleton file.</returns>
    private FileInfo GenerateSkeleton(
        FileInfo inputFile,
        DirectoryInfo outputDirectory,
        TeXCleanerRules rules,
        string locale)
    {
        // Read the source TeX
        var texContent = File.ReadAllText(inputFile.FullName);

        // Parse the source into its document model
        var (document, _) = TexStringParser.ParseDocument(texContent, rules);

        // Extract preamble lines that need to be preserved.
        var inputLine = texContent.ExtractMatch(@"\\input\s+\S+");
        var authorLine = texContent.ExtractMatch(@"\\Author\{[^}]+\}");
        var mathcompsLinkLine = texContent.ExtractMatch(@"\\MathcompsLink\{[^}]+\}");

        // Every exercise, example and problem across the sections, stripped of its solution, hints and answer.
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

        // The skeleton's TeX, built up below.
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

        // The skeleton's name and its path beside the source
        var skeletonName = Path.GetFileNameWithoutExtension(inputFile.Name) + "-skeleton.tex";
        var skeletonPath = Path.Combine(outputDirectory.FullName, skeletonName);

        // Write the skeleton file
        File.WriteAllText(skeletonPath, builder.ToString());

        // Success message
        logger.LogInformation("  Skeleton: {File} ({Count} statements)", skeletonName, allStatements.Count);

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
    private async Task CompileTexFileAsync(
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
            logger.LogInformation("  Compiling {File} (pass {Pass}/2)...", texFile.Name, pass);

            // Split the configured compiler string into executable + flags (whitespace-separated, no quoted args)
            var compilerParts = compiler.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var compilerExecutable = compilerParts[0];

            // Pass each flag as its own argv entry, then inject \def\PUBLISH{} before \input
            // reads the .tex. The template defaults \ReviewModetrue so manual local compiles
            // render inline review content; the \PUBLISH sentinel flips it off, producing
            // the publish form (where hints and solutions are not below statements but at the end)
            string[] arguments = [.. compilerParts.Skip(1), $@"\def\PUBLISH{{}}\input {texFile.Name}"];

            // Run the compiler, capturing its output and exit code
            var result = await ProcessRunner.RunAsync(
                compilerExecutable, arguments, workingDirectory.FullName, sourceDateEnvironment);

            // Check if compilation failed
            if (result.ExitCode != 0)
            {
                // Append the full compiler output to the error log for debugging
                File.AppendAllText(
                    errorLog, $"=== {texFile.Name} (pass {pass}) ===\n{result.Stdout}\n{result.Stderr}\n");

                // Throw with context about which file and pass failed
                throw new InvalidOperationException(
                    $"Compilation of '{texFile.Name}' failed on pass {pass} (exit code {result.ExitCode}). "
                    + "See errors.log for details.");
            }
        }

        // Success message
        logger.LogInformation("  Compiled: {File}", Path.ChangeExtension(texFile.Name, ".pdf"));
    }

    /// <summary>
    /// Regenerates one of the artefacts derived from the handout content JSONs by running the frontend's own
    /// generator script. Shelling out (rather than reimplementing the walk in C#) keeps each derived value defined
    /// once, in the same TypeScript the page itself uses, so an artefact can't drift from what the page shows.
    /// </summary>
    /// <param name="npmScript">The npm script that regenerates the artefact.</param>
    /// <param name="artefactName">What the artefact is called in the run's output.</param>
    /// <returns>True when the artefact was regenerated; false when the script failed, in which case its output has
    /// already been logged.</returns>
    private async Task<bool> RegenerateDerivedArtefactAsync(string npmScript, string artefactName)
    {
        // Status message
        logger.LogInformation("━━━ {Artefact} ━━━", artefactName);

        // Run the frontend's generator from its own project directory
        var webDirectory = RepoPaths.Resolve("web");
        var result = await ProcessRunner.RunAsync("npm", ["run", npmScript], webDirectory);

        // A non-zero exit means the generator itself failed
        if (result.ExitCode != 0)
        {
            // Say which artefact failed
            logger.LogError("Failed to regenerate {Artefact} (exit {ExitCode}).", artefactName, result.ExitCode);

            // Log the generator's output for debugging
            logger.LogError("{Stdout}\n{Stderr}", result.Stdout, result.Stderr);

            // The artefact stays stale
            return false;
        }

        // Success message
        logger.LogInformation("Regenerated {Artefact}", artefactName);

        // The artefact is fresh
        return true;
    }

    /// <summary>
    /// Pushes the generated defense-content blobs to the private store. They go up in one pass after the run's
    /// handouts are parsed, since the generator writes the blobs of the whole site rather than of one .tex.
    /// </summary>
    /// <param name="store">The store the blobs go to.</param>
    private async Task UploadDefenseContentAsync(IPrivateObjectStore store)
    {
        // The generator's output directory, gitignored build output like the compiled PDFs beside it
        var defenseDirectory = new DirectoryInfo(RepoPaths.Resolve("data/handouts/defense"));

        // The directory only exists once a generator run has written into it
        if (!defenseDirectory.Exists)
        {
            // Say why nothing went out, so a silent step doesn't read as a successful push
            logger.LogWarning("  No defense content generated, nothing to upload");

            // There is nothing to push
            return;
        }

        // Every blob this run produced, in name order so the log reads the same way twice
        var blobs = defenseDirectory
            .EnumerateFiles("*.json")
            .OrderBy(file => file.Name, StringComparer.Ordinal)
            .ToList();

        // Store each one under the key the API reads it from
        foreach (var blob in blobs)
        {
            // The blob's bytes
            var content = await File.ReadAllBytesAsync(blob.FullName);

            // Replace whatever the store held for it
            await store.PutAsync(
                HandoutStorage.DefenseContentKeyForFile(blob.Name),
                content,
                MediaTypeNames.Application.Json,
                CancellationToken.None);
        }

        // Report how many went up
        logger.LogInformation("  {Uploaded} defense blob(s) uploaded", blobs.Count);
    }

    /// <summary>
    /// Uploads a compiled handout PDF (main or skeleton) to remote storage, under the key
    /// <see cref="HandoutStorage.PdfKey"/> gives it.
    /// </summary>
    /// <param name="texFile">The .tex file whose corresponding PDF should be uploaded.</param>
    /// <param name="sourceDirectory">The directory containing the compiled PDFs.</param>
    /// <param name="fileUploader">The uploader the PDF goes through.</param>
    /// <returns>A task representing the asynchronous upload operation.</returns>
    private async Task UploadHandoutPdfAsync(
        FileInfo texFile,
        DirectoryInfo sourceDirectory,
        IFileUploader fileUploader)
    {
        // Determine the PDF filename from the TeX filename
        var pdfFileName = Path.ChangeExtension(texFile.Name, ".pdf");
        var sourcePdfPath = Path.Combine(sourceDirectory.FullName, pdfFileName);

        // Check if the compiled PDF exists
        if (!File.Exists(sourcePdfPath))
        {
            // Warn about it
            logger.LogWarning("  PDF not found: {File}", pdfFileName);

            // Skip the upload
            return;
        }

        // The PDF's storage key
        var r2Key = HandoutStorage.PdfKey(pdfFileName);

        // Hand the PDF to the uploader
        await fileUploader.UploadAsync(sourcePdfPath, r2Key);

        // Log success
        logger.LogInformation("  PDF uploaded: {File}", pdfFileName);
    }

    /// <summary>
    /// Processes images in a handout document by walking through all sections and their content.
    /// Each discovered image joins the upload queue, which goes up once the handout is processed.
    /// </summary>
    /// <param name="document">The parsed <see cref="Document"/>.</param>
    /// <param name="sourceFileName">The source .tex file name (e.g., "factorization.cs.tex").</param>
    /// <param name="pendingUploads">The upload queue the handout's images join, or null when the run skips
    /// uploads.</param>
    /// <returns>A <see cref="HandoutImageResult"/> containing the processed document and discovered images.</returns>
    private HandoutImageResult ProcessHandoutImages(
        Document document,
        string sourceFileName,
        List<PendingUpload>? pendingUploads)
    {
        // Language-stripped handout slug shared by every language variant of this handout.
        var handoutSlug = ToHandoutSlug(sourceFileName);

        // Source directory for handout images
        var handoutsDirectory = RepoPaths.Resolve("data/handouts/Images");

        // A function naming an image's SVG. The .tex sources reference images as "<name>.pdf", since pdfcsplain
        // embeds PDFs, and the web wants the SVG that sits beside each PDF on disk.
        static string ToSvgName(string pdfImageId) => $"{pdfImageId.RemoveEnd(".pdf")}.svg";

        // Configure the image processor for this handout
        var config = new ImageProcessingConfig(
            ImageSourceResolver: imageId => Path.Combine(handoutsDirectory, ToSvgName(imageId)),
            OutputFileName: (imageId, _) => $"{handoutSlug}/{ToSvgName(imageId)}",
            // Queue the image for upload, when the run uploads
            PersistImage: (sourcePath, contentId) =>
                pendingUploads?.Add(new PendingUpload(sourcePath, HandoutStorage.AssetKey(contentId))),
            OnMissingImage: imageId =>
                logger.LogWarning("Handout {Handout} has a missing image: {ImageId}", handoutSlug, imageId)
        );

        // Collect all discovered images from all sections
        var allDiscoveredImages = ImmutableList.CreateBuilder<ImageData>();

        // Start with initial state for shared counter and deduplication
        var state = ImageProcessingState.Initial;

        // Process each section's content, swapping image ids for SVG names and queueing each image for upload
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
    /// Walks the parsed <see cref="Document"/> and returns the set of distinct image identifiers it references. For
    /// handouts these are <c>&lt;name&gt;.pdf</c> strings, the same ids <see cref="ProcessHandoutImages"/> later
    /// resolves to SVGs.
    /// </summary>
    /// <param name="document">The parsed document to scan.</param>
    /// <returns>The distinct image ids referenced anywhere in the document.</returns>
    private static ImmutableHashSet<string> CollectImageIds(Document document)
    {
        // Accumulator for image ids discovered during the traversal
        var idsBuilder = ImmutableHashSet.CreateBuilder<string>();

        // Walk every section's content tree, collecting each image id in it
        foreach (var section in document.Sections)
        {
            // ContentTree.Map recurses into every nested container (paragraphs, exercises,
            // problem hints, theorem proofs, list items, etc.), the same coverage as the image processor
            ContentTree.Map(section.Text.Content, node =>
            {
                // Image nodes are the only nodes we care about; everything else passes through
                if (node is Image image)
                    idsBuilder.Add(image.Id);

                // Return the same reference to signal "no transformation"
                return node;
            });
        }

        // Freeze the collected ids
        return idsBuilder.ToImmutable();
    }

    /// <summary>
    /// Scans the parsed <see cref="Document"/> for handout-referenced documents and queues
    /// each one for upload to R2. These come from <c>\Link[file.pdf]{...}</c> macros, which
    /// the parser emits as <see cref="Link"/> nodes; a link whose URL is a bare filename is a downloadable document
    /// that lives under <c>data/handouts/Documents</c> and is served from the <see cref="DocumentsR2Prefix"/> folder
    /// on R2. External (<c>http(s)</c>) links are left untouched. Mirrors
    /// <see cref="CollectImageIds"/>'s traversal so every nested container is covered.
    /// </summary>
    /// <param name="document">The parsed handout document to scan.</param>
    /// <param name="inputDirectory">The <c>data/handouts</c> directory; documents sit in its <c>Documents</c>
    /// subfolder.</param>
    /// <param name="handoutSlug">The language-stripped handout slug.</param>
    /// <param name="pendingUploads">The shared upload queue document uploads are appended to.</param>
    private void CollectDocumentUploads(
        Document document,
        DirectoryInfo inputDirectory,
        string handoutSlug,
        List<PendingUpload> pendingUploads)
    {
        // Source folder for downloadable documents, a sibling of the .tex sources and Images/
        var documentsDirectory = Path.Combine(inputDirectory.FullName, "Documents");

        // Distinct local document filenames referenced anywhere in the document
        var documentFileNames = ImmutableHashSet.CreateBuilder<string>(StringComparer.Ordinal);

        // Walk every section's content tree, collecting each local link target in it
        foreach (var section in document.Sections)
        {
            // Recurse into every nested container, since a link can live inside any of them
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

            // A referenced-but-missing document is an authoring error, so surface it and leave it out of the queue
            if (!File.Exists(sourcePath))
            {
                // Warn about it
                logger.LogWarning("Handout {Handout} links a missing document: {File}", handoutSlug, fileName);

                // Move on to the next document
                continue;
            }

            // Queue it under its flat key in the documents folder
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
    /// <param name="memo">Scans already done for this handout's figures, keyed by path, so a file several figures
    /// share is scanned once.</param>
    /// <returns>The <c>.asy</c> file itself plus every transitively resolved dependency, except
    /// <see cref="GlobalAsyDepFileName"/>.</returns>
    private static ImmutableHashSet<string> ResolveAsyDeps(
        string asyPath,
        DirectoryInfo imagesDir,
        Dictionary<string, ImmutableHashSet<string>> memo)
    {
        // A file a sibling figure already pulled in comes straight from the memo
        if (memo.TryGetValue(asyPath, out var cached))
            return cached;

        // Seed with the file itself; transitive deps grow the set below
        var depsBuilder = ImmutableHashSet.CreateBuilder<string>();
        depsBuilder.Add(asyPath);

        // Read once for both import and include scans
        var content = File.ReadAllText(asyPath);

        // A function adding a candidate dependency, and its own dependencies, when it names a real .asy in the
        // figures directory other than the global helper module
        void TryAddDep(string fileName)
        {
            // Keep the global helper module out of the dependency graph (see GlobalAsyDepFileName)
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

        // `import <name>;`, a bare module name, read as `<name>.asy` in the figures dir
        foreach (Match match in Regex.Matches(
                     content, @"^\s*import\s+([A-Za-z_][A-Za-z0-9_]*)\s*;", RegexOptions.Multiline))
            TryAddDep(match.Groups[1].Value + ".asy");

        // `include "<path>";`, a quoted file path whose extension Asymptote makes optional, so normalise it
        foreach (Match match in Regex.Matches(content, @"^\s*include\s+""([^""]+)""\s*;", RegexOptions.Multiline))
        {
            // The included file's name, with .asy appended when the include leaves it off
            var raw = match.Groups[1].Value;
            var fileName = raw.EndsWith(".asy", StringComparison.OrdinalIgnoreCase) ? raw : raw + ".asy";

            // Add it to the graph
            TryAddDep(fileName);
        }

        // `include <name>;`, the unquoted module form, resolved like the bare `import`
        foreach (Match match in Regex.Matches(
                     content, @"^\s*include\s+([A-Za-z_][A-Za-z0-9_]*)\s*;", RegexOptions.Multiline))
            TryAddDep(match.Groups[1].Value + ".asy");

        // Freeze the set
        var result = depsBuilder.ToImmutable();

        // Memoize it for the next figure that shares the file
        memo[asyPath] = result;

        // Hand back the file and its dependencies
        return result;
    }

    /// <summary>
    /// Determines whether a figure's compiled outputs are stale relative to its source(s).
    /// A figure is stale when either output (PDF or SVG) is missing, or when any source
    /// in <paramref name="sources"/> has a newer mtime than the OLDER of the two outputs.
    /// </summary>
    /// <param name="sources">The source files that contribute to the compiled outputs (the .asy plus its transitive
    /// includes/imports).</param>
    /// <param name="pdfPath">Absolute path to the figure's compiled PDF.</param>
    /// <param name="svgPath">Absolute path to the figure's compiled SVG.</param>
    /// <returns><c>true</c> if a recompile is required; <c>false</c> if both outputs are up to date.</returns>
    private static bool IsImageStale(ImmutableHashSet<string> sources, string pdfPath, string svgPath)
    {
        // A missing output unambiguously means the figure must be (re)compiled
        if (!File.Exists(pdfPath) || !File.Exists(svgPath))
            return true;

        // Compare against the OLDER output, since either one lagging the source means a rebuild
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
    /// <param name="staleAsyFileNames">Filenames (not absolute paths) of stale <c>.asy</c> files inside
    /// <paramref name="imagesDir"/>.</param>
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

        // A non-zero exit means at least one .asy failed, so surface everything for debugging
        if (result.ExitCode != 0)
            throw new InvalidOperationException(
                $"Asymptote export script failed (exit {result.ExitCode}).\n"
                + $"--- stdout ---\n{result.Stdout}\n--- stderr ---\n{result.Stderr}");
    }

    /// <summary>
    /// Checks every <c>.asy</c>-backed image referenced by the document for staleness (against its own source plus
    /// its transitive <c>include</c>/<c>import</c> dependencies, excluding the global <c>_common.asy</c>) and
    /// batch-recompiles only the stale ones via <c>export-asy.sh</c>. Images with no sibling <c>.asy</c> (raster or
    /// externally-authored PDFs) are skipped, since the asy pipeline doesn't produce them.
    /// </summary>
    /// <param name="document">The parsed handout document whose images should be ensured fresh.</param>
    /// <param name="imagesDir">Directory containing the <c>.asy</c> sources, compiled PDFs/SVGs, and the export
    /// script.</param>
    /// <param name="forceRecompile">When true, every <c>.asy</c>-backed image is recompiled regardless of
    /// staleness.</param>
    /// <param name="alreadyRecompiled">Cross-handout set of <c>.asy</c> filenames already recompiled in this CLI run;
    /// entries here are treated as fresh and not requeued. Updated with each batch.</param>
    /// <returns>A task representing the asynchronous freshness check and any recompiles it triggers.</returns>
    private async Task EnsureAsyImagesFreshAsync(
        Document document,
        DirectoryInfo imagesDir,
        bool forceRecompile,
        HashSet<string> alreadyRecompiled)
    {
        // Collect the set of image ids referenced anywhere in the document
        var imageIds = CollectImageIds(document);

        // Dependency scans shared across this handout's figures, so a file a whole family imports is scanned once
        var depMemo = new Dictionary<string, ImmutableHashSet<string>>();

        // Stale .asy filenames to batch-compile; populated as we walk the image set
        var staleFileNames = new List<string>();

        // How many asy-backed images are already fresh
        var freshCount = 0;

        // Walk every distinct image id; partition into asy-backed-fresh, asy-backed-stale, or non-asy (skipped)
        foreach (var imageId in imageIds)
        {
            // Image.Id is "<name>.pdf" for handouts; the backing source has the same stem with a .asy extension
            var asyFileName = Path.ChangeExtension(imageId, ".asy");
            var asyPath = Path.Combine(imagesDir.FullName, asyFileName);

            // No sibling .asy means the image is externally authored (raster, hand-drawn PDF, etc.), so leave it alone
            if (!File.Exists(asyPath))
                continue;

            // An earlier handout in this run already recompiled this figure
            if (alreadyRecompiled.Contains(asyFileName))
            {
                // Count it as fresh
                freshCount++;

                // Leave it out of this handout's batch
                continue;
            }

            // Outputs live next to the source under the same stem
            var pdfPath = Path.Combine(imagesDir.FullName, imageId);
            var svgPath = Path.Combine(imagesDir.FullName, Path.ChangeExtension(imageId, ".svg"));

            // Is this stale?
            bool stale;

            // The force flag marks the figure stale without walking its dependencies
            if (forceRecompile)
            {
                stale = true;
            }
            else
            {
                // Otherwise resolve the files the figure is built from
                var deps = ResolveAsyDeps(asyPath, imagesDir, depMemo);

                // ..And compare their mtimes against the outputs'
                stale = IsImageStale(deps, pdfPath, svgPath);
            }

            // Stale ⇒ queue for batch compile
            if (stale)
            {
                // Say it's being recompiled
                logger.LogInformation("  Asy: recompiling {File}", asyFileName);

                // Add it to the batch
                staleFileNames.Add(asyFileName);
            }
            // Fresh ⇒ count it
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
                logger.LogInformation("  Asy: all {Count} image(s) fresh", freshCount);

            // Nothing left to do for this handout
            return;
        }

        // Recompile the whole batch in one run of export-asy.sh
        await RunAsyExportScriptAsync(staleFileNames, imagesDir);

        // Say how many went through
        logger.LogInformation("  Asy: {Count} image(s) recompiled", staleFileNames.Count);

        // Record what we just compiled so later handouts in this run don't redo the same work
        foreach (var fileName in staleFileNames)
            alreadyRecompiled.Add(fileName);
    }
}

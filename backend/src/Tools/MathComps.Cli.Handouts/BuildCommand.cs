using MathComps.Infrastructure.Storage;
using MathComps.Shared;
using MathComps.TexParser;
using MathComps.TexParser.Images;
using MathComps.TexParser.TexCleaner;
using MathComps.TexParser.Types;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace MathComps.Cli.Handouts;

/// <summary>
/// The main orchestration command for the handout pipeline.
/// Generates skeletons, compiles TeX to PDF, parses TeX to JSON,
/// and uploads images and PDFs to Cloudflare R2.
/// </summary>
/// <param name="fileUploader">A lazily-resolved <see cref="IFileUploader"/> for uploading assets to remote storage.</param>
[Description("Builds handouts: generates skeletons, compiles TeX, parses JSON, and copies assets.")]
public class BuildCommand(Lazy<IFileUploader> fileUploader) : AsyncCommand<BuildCommand.Settings>
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
        [Description("Skip uploading PDFs and images to R2")]
        public bool SkipUpload { get; set; }

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
    /// The R2 prefix under which every handout artefact (PDFs, images) lives.
    /// </summary>
    private const string HandoutsR2Prefix = "handouts";

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
    /// Builds the full R2 key for a handout asset by prefixing its slug-relative path
    /// with <see cref="HandoutsR2Prefix"/>. Centralises the prefix so PDF and image
    /// upload paths stay in sync.
    /// </summary>
    /// <param name="slugRelativeKey">The slug-prefixed asset path (e.g. "factorization/box.svg").</param>
    /// <returns>The full R2 key (e.g. "handouts/factorization/box.svg").</returns>
    private static string ToHandoutR2Key(string slugRelativeKey) => $"{HandoutsR2Prefix}/{slugRelativeKey}";

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Fixed paths relative to the tool's project directory.
        var inputDirectory = new DirectoryInfo("../../../../data/handouts");
        var jsonOutputDirectory = new DirectoryInfo("../../../../web/src/content/handouts");

        // Validate the input directory exists.
        if (!inputDirectory.Exists)
        {
            AnsiConsole.MarkupLine($"[red]Error:[/] Input directory not found at '[yellow]{Markup.Escape(inputDirectory.FullName)}[/]'");
            return 1;
        }

        // Ensure the JSON output directory exists.
        if (!jsonOutputDirectory.Exists)
            jsonOutputDirectory.Create();

        // Resolve the uploader
        IFileUploader? uploader = null;
        if (!settings.SkipUpload)
        {
            uploader = fileUploader.Value;
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
                .Where(file => !file.Name.Contains("-skeleton", StringComparison.OrdinalIgnoreCase))
        ];

        // Check if any files were found.
        if (inputFiles.Count == 0)
        {
            AnsiConsole.MarkupLine($"[yellow]Warning:[/] No files found matching pattern(s) in the input directory.");
            return 0;
        }

        // Display what we're processing.
        AnsiConsole.MarkupLine($"[aqua]Found {inputFiles.Count} handout file(s)[/]");
        AnsiConsole.WriteLine();

        // Load the TeX cleaning rules before processing files.
        var rules = TeXCleanerRules.LoadRules();

        // Track unknown commands across all files for a final report.
        var allUnknownCommands = new Dictionary<string, IReadOnlyCollection<string>>();

        // Track which files failed for the final report.
        var failedFiles = new List<string>();

        // Process each discovered handout file.
        foreach (var inputFile in inputFiles)
        {
            AnsiConsole.MarkupLine($"[aqua]━━━ {Markup.Escape(inputFile.Name)} ━━━[/]");

            try
            {
                // Step 1: Generate skeleton TeX
                var skeletonFile = GenerateSkeleton(inputFile, inputDirectory, rules);

                // Step 2: Compile TeX files (main + skeleton)
                if (!settings.SkipCompile)
                {
                    // Compile the main handout
                    CompileTexFile(inputFile, inputDirectory, settings.Compiler, settings.ErrorLog);

                    // Compile the skeleton
                    CompileTexFile(skeletonFile, inputDirectory, settings.Compiler, settings.ErrorLog);
                }

                // Step 3: Parse TeX to JSON and process images
                var pendingImageUploads = new List<PendingUpload>();

                // Read the entire content of the .tex file into a string.
                var texContent = File.ReadAllText(inputFile.FullName);

                // Parse the TeX content into the structured Document object model.
                var (document, unknownCommands) = TexStringParser.ParseDocument(texContent, rules);

                // Process images in the document content and collect their metadata
                var imageResult = ProcessHandoutImages(document, inputFile.Name, settings.SkipUpload ? null : pendingImageUploads);

                // Create a wrapper object containing both document and images
                var handoutData = new
                {
                    Document = imageResult.ProcessedDocument,
                    Images = imageResult.DiscoveredImages
                };

                // Serialize the handout data (document + images) to an indented JSON string
                var jsonString = handoutData.ToJson();

                // Normalize line endings to LF (Unix-style) for Git compatibility
                var normalizedContent = jsonString.Replace("\r\n", "\n") + "\n";

                // Generate the output filename by replacing .tex extension with .json.
                var outputFileName = Path.ChangeExtension(inputFile.Name, ".json");
                var outputFilePath = Path.Combine(jsonOutputDirectory.FullName, outputFileName);

                // Write the JSON output
                File.WriteAllText(outputFilePath, normalizedContent);

                AnsiConsole.MarkupLine($"  [green]✓ Parsed:[/] {Markup.Escape(outputFileName)}");

                // If unknown commands were found, add them to our report dictionary.
                if (!unknownCommands.IsEmpty)
                    allUnknownCommands[inputFile.Name] = unknownCommands;

                // Step 4: Upload images and PDFs to R2 (unless skipped)
                if (uploader is not null)
                {
                    // Upload queued images asynchronously
                    foreach (var upload in pendingImageUploads)
                        await uploader.UploadAsync(upload.SourcePath, upload.R2Key);

                    // Upload PDFs
                    await UploadHandoutPdfAsync(inputFile, inputDirectory, uploader);

                    // Upload the skeleton PDF
                    await UploadHandoutPdfAsync(skeletonFile, inputDirectory, uploader);
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

        // All handout files processed

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
        var hasErrors = failedFiles.Count > 0 || allUnknownCommands.Count > 0;

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
    /// <returns>The generated skeleton file.</returns>
    private static FileInfo GenerateSkeleton(FileInfo inputFile, DirectoryInfo outputDirectory, TeXCleanerRules rules)
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
                Exercise exercise => exercise with { Solution = [] },
                Problem problem => problem with { Solution = [], Hints = [] },
                Example example => example with { Solution = [] },
                _ => block
            })
            .ToImmutableList();

        // Detect language from filename (e.g., .sk.tex -> SK)
        // Match the two-letter language code before the .tex extension
        var languageMatch = Regex.Match(inputFile.Name, @"\.([a-z]{2})\.tex$", RegexOptions.IgnoreCase);
        var languageCode = languageMatch.Success ? languageMatch.Groups[1].Value.ToUpperInvariant() : null;

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

        // \setLanguage{XX}
        if (languageCode is not null)
        {
            builder.AppendLine($@"\setlanguage{{{languageCode}}}");
            builder.AppendLine();
        }

        // Title
        if (!string.IsNullOrEmpty(document.Title))
        {
            builder.AppendLine($@"\Title{{{document.Title}}}");
            builder.AppendLine();
        }

        // Subtitle
        if (!string.IsNullOrEmpty(document.Subtitle))
        {
            builder.AppendLine($@"\Subtitle{{{document.Subtitle}}}");
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
    private static void CompileTexFile(
        FileInfo texFile,
        DirectoryInfo workingDirectory,
        string compiler,
        string errorLog)
    {
        // Run two passes as required by TeX for cross-references
        for (var pass = 1; pass <= 2; pass++)
        {
            AnsiConsole.MarkupLine($"  [dim]Compiling {Markup.Escape(texFile.Name)} (pass {pass}/2)...[/]");

            // Split the compiler string into executable and any extra flags
            var compilerParts = compiler.Split(' ', 2);
            var compilerExecutable = compilerParts[0];
            var compilerFlags = compilerParts.Length > 1 ? $"{compilerParts[1]} " : "";

            // Configure the compiler process
            var processInfo = new ProcessStartInfo
            {
                FileName = compilerExecutable,
                Arguments = $"{compilerFlags}{texFile.Name}",
                WorkingDirectory = workingDirectory.FullName,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            // Start the compiler process
            using var process = Process.Start(processInfo)
                ?? throw new InvalidOperationException($"Failed to start '{compiler}'");

            // Read output to prevent deadlocks on redirected streams
            var standardOutput = process.StandardOutput.ReadToEnd();
            var standardError = process.StandardError.ReadToEnd();

            // Wait for the process to finish
            process.WaitForExit();

            // Check if compilation failed
            if (process.ExitCode != 0)
            {
                // Append the full compiler output to the error log for debugging
                File.AppendAllText(errorLog, $"=== {texFile.Name} (pass {pass}) ===\n{standardOutput}\n{standardError}\n");

                // Throw with context about which file and pass failed
                throw new InvalidOperationException(
                    $"Compilation of '{texFile.Name}' failed on pass {pass} (exit code {process.ExitCode}). See errors.log for details.");
            }
        }

        AnsiConsole.MarkupLine($"  [green]✓ Compiled:[/] {Markup.Escape(Path.ChangeExtension(texFile.Name, ".pdf"))}");
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
        var r2Key = ToHandoutR2Key($"pdfs/{pdfFileName}");
        await fileUploader.UploadAsync(sourcePdfPath, r2Key);
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
        var handoutsDirectory = "../../../../data/handouts/Images";

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
                pendingUploads?.Add(new PendingUpload(sourcePath, ToHandoutR2Key(contentId)));
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


}

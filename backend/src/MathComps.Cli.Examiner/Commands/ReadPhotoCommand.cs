using System.ComponentModel;
using System.Diagnostics;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Shared.Extensions;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Reads photos of handwritten pages into a folder beside each one, and reports what each reading cost and what the
/// run spent.
/// </summary>
/// <param name="photoReader">The reader each photo goes through.</param>
/// <param name="spendTracker">The tally of what the run spent.</param>
/// <param name="logger">The logger each reading, each failure and the run's total go through.</param>
[Description("""
    Read photos of handwritten pages. Each photo's reading goes to a folder beside it, <name>-reading, holding the
    text as text.md, the page the model read as page.jpg, and each drawing as a JPEG named after its label (Figure 2
    is figure-2.jpg), replacing what an earlier run wrote there. Takes JPEG, PNG and WebP.
""")]
public class ReadPhotoCommand(
    IPhotoReader photoReader,
    ILlmSpendTracker spendTracker,
    ILogger<ReadPhotoCommand> logger)
    : AsyncCommand<ReadPhotoCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The photos to read.
        /// </summary>
        [CommandArgument(0, "<photos>")]
        [Description("Paths to the photos to read.")]
        public required string[] Photos { get; set; }

        /// <summary>
        /// How many photos are read at once.
        /// </summary>
        [CommandOption("--parallel <COUNT>")]
        [Description("How many photos are read at once.")]
        [DefaultValue(3)]
        public int Parallel { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings commandSettings)
    {
        // At least one photo has to be read at a time.
        if (commandSettings.Parallel < 1)
        {
            // Name the bad option.
            logger.LogError("--parallel must be at least 1.");

            // Nothing was read.
            return 1;
        }

        // The paths that name no file.
        var missing = commandSettings.Photos.Where(path => !File.Exists(path)).ToList();

        // Any missing photo stops the run before the first reading.
        if (missing.Count > 0)
        {
            // Name each missing photo.
            foreach (var path in missing)
                logger.LogError("Photo not found: {Path}", path);

            // Nothing was read.
            return 1;
        }

        // How many photos could not be read.
        var failed = 0;

        // Read the photos a few at a time, counting each one that fails.
        await Parallel.ForEachAsync(
            commandSettings.Photos,
            new ParallelOptions { MaxDegreeOfParallelism = commandSettings.Parallel },
            async (path, cancellationToken) =>
            {
                // Read the photo, counting it when it fails.
                if (!await ReadOneAsync(path, cancellationToken))
                    Interlocked.Increment(ref failed);
            });

        // How many photos were read.
        var read = commandSettings.Photos.Length - failed;

        // Report how many photos were read and what the run spent, as a warning when any failed.
        logger.Log(failed == 0 ? LogLevel.Information : LogLevel.Warning,
            "Read {Read} of {Count} photo(s) for ${Cost:0.0000}.",
            read, commandSettings.Photos.Length, spendTracker.Total);

        // A run where any photo failed exits as a failure.
        return failed == 0 ? 0 : 1;
    }

    /// <summary>
    /// Reads one photo, writes its reading into the folder beside it, and reports the reading.
    /// </summary>
    /// <param name="path">The photo to read.</param>
    /// <param name="cancellationToken">A token to cancel the reading.</param>
    /// <returns>Whether the photo was read and written.</returns>
    private async Task<bool> ReadOneAsync(string path, CancellationToken cancellationToken)
    {
        // The photo's file name.
        var name = Path.GetFileName(path);

        // Time the reading.
        var stopwatch = Stopwatch.StartNew();

        // Read the photo and write what came out.
        try
        {
            // The photo file's bytes.
            var photo = await File.ReadAllBytesAsync(path, cancellationToken);

            // The reading, with the model that answered and what the call billed.
            var result = await photoReader.ReadAsync(photo, cancellationToken);

            // Stop the clock before the writes.
            stopwatch.Stop();

            // Write the reading into its folder.
            await WriteAsync(path, result.Value, cancellationToken);

            // How many drawings the reading cut out.
            var figures = result.Value.Crops.Count;

            // Report the reading: its drawings, the model that answered, what it cost and how long it took.
            logger.LogInformation("{Photo}: {Figures} figure(s), {Model}, ${Cost:0.0000}, {Seconds:0.0}s",
                name, figures, result.ServedModel, result.Usage.Cost, stopwatch.Elapsed.TotalSeconds);

            // The photo was read and written.
            return true;
        }
        // A failure fails this photo alone, and the others carry on.
        catch (Exception exception)
        {
            // Name the photo and why it failed.
            logger.LogError(exception, "{Photo} failed", name);

            // This photo failed.
            return false;
        }
    }

    /// <summary>
    /// Writes a reading into the folder beside its photo, named after the photo with <c>-reading</c> added: the text
    /// as <c>text.md</c>, the page the model read as <c>page.jpg</c>, and each drawing as a JPEG named after its label,
    /// so <c>Figure 2</c> is <c>figure-2.jpg</c>. Every JPEG already in the folder is cleared first.
    /// </summary>
    /// <param name="path">The photo the reading came from.</param>
    /// <param name="reading">The reading to write.</param>
    /// <param name="cancellationToken">A token to cancel the writes.</param>
    private static async Task WriteAsync(string path, PhotoReading reading, CancellationToken cancellationToken)
    {
        // The reading's folder beside the photo, out of reach of a glob over the photos themselves.
        var folder = Directory.CreateDirectory($"{Path.ChangeExtension(path, null)}-reading");

        // Clear every JPEG in the folder, so no drawing missing from this reading keeps a file.
        foreach (var stale in folder.EnumerateFiles("*.jpg"))
            stale.Delete();

        // Write the page's text.
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "text.md"), reading.Text + "\n", cancellationToken);

        // Write the page the model read.
        await File.WriteAllBytesAsync(Path.Combine(folder.FullName, "page.jpg"), reading.Page, cancellationToken);

        // Write each drawing under its label.
        foreach (var crop in reading.Crops)
            await File.WriteAllBytesAsync(
                Path.Combine(folder.FullName, $"{crop.Label.ToSlug()}.jpg"), crop.Image, cancellationToken);
    }
}

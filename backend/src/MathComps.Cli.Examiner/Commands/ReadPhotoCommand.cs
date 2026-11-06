using System.ComponentModel;
using System.Diagnostics;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Shared.Cli;
using MathComps.Shared.Extensions;
using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Reads photos of handwritten pages into a folder beside each one, and reports what each reading cost and what the
/// run spent.
/// </summary>
/// <param name="photoReader">The reader each photo goes through.</param>
/// <param name="spendTracker">The tally of what the run spent.</param>
[Description("""
    Read photos of handwritten pages. Each photo's reading goes to a folder beside it, <name>-reading, holding the
    text as text.md, the page the model read as page.jpg, and each drawing as a JPEG named after its marker in the
    text ([[Figure 2]] is figure-2.jpg), replacing what an earlier run wrote there. Takes JPEG, PNG and WebP.
""")]
public class ReadPhotoCommand(IPhotoReader photoReader, ILlmSpendTracker spendTracker)
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
            AnsiConsole.MarkupLine("[red]--parallel must be at least 1.[/]");
            return 1;
        }

        // The paths that name no file.
        var missing = commandSettings.Photos.Where(path => !File.Exists(path)).ToList();

        // Any missing photo stops the run before the first reading.
        if (missing.Count > 0)
        {
            // Name each missing photo.
            foreach (var path in missing)
                AnsiConsole.MarkupLineInterpolated($"[red]Photo not found:[/] {path}");

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
                // Count a photo that fails.
                if (!await ReadOneAsync(path, cancellationToken))
                    Interlocked.Increment(ref failed);
            });

        // How many photos were read.
        var read = commandSettings.Photos.Length - failed;

        // Report how many photos were read and what the run spent.
        AnsiConsole.MarkupLineInterpolated(
            $"[green]Read {read} of {commandSettings.Photos.Length} photo(s) for ${spendTracker.Total:0.0000}.[/]");

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
        var name = Markup.Escape(Path.GetFileName(path));

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

            // The model that answered.
            var model = Markup.Escape(result.ServedModel);

            // Report the reading: its drawings, the model that answered, what it cost and how long it took.
            CliLog.Line($"{name}: {figures} figure(s), {model}, ${result.Usage.Cost:0.0000}, " +
                $"{stopwatch.Elapsed.TotalSeconds:0.0}s");

            // The photo was read and written.
            return true;
        }
        // A failure fails this photo alone, and the others carry on.
        catch (Exception exception)
        {
            // Name the photo and why it failed.
            CliLog.Line($"[red]{name}:[/] {Markup.Escape(exception.Message)}");

            // This photo failed.
            return false;
        }
    }

    /// <summary>
    /// Writes a reading into the folder beside its photo, named after the photo with <c>-reading</c> added: the text
    /// as <c>text.md</c>, the page the model read as <c>page.jpg</c>, and each drawing as a JPEG named after its marker
    /// in the text, so <c>[Figure 2]</c> is <c>figure-2.jpg</c>. Every JPEG already in the folder is cleared first.
    /// </summary>
    /// <param name="path">The photo the reading came from.</param>
    /// <param name="reading">The reading to write.</param>
    /// <param name="cancellationToken">A token to cancel the writes.</param>
    private static async Task WriteAsync(string path, PhotoReading reading, CancellationToken cancellationToken)
    {
        // The reading's folder beside the photo, out of reach of a glob over the photos themselves.
        var folder = Directory.CreateDirectory($"{Path.ChangeExtension(path, null)}-reading");

        // Clear every JPEG in the folder, so no marker missing from this reading keeps a file.
        foreach (var stale in folder.EnumerateFiles("*.jpg"))
            stale.Delete();

        // Write the page's text.
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "text.md"), reading.Text + "\n", cancellationToken);

        // Write the page the model read.
        await File.WriteAllBytesAsync(Path.Combine(folder.FullName, "page.jpg"), reading.Page, cancellationToken);

        // Write each drawing under its marker's name.
        foreach (var crop in reading.Crops)
            await File.WriteAllBytesAsync(
                Path.Combine(folder.FullName, $"{crop.Label.ToSlug()}.jpg"), crop.Image, cancellationToken);
    }
}

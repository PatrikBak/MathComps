using System.Net.Mime;
using System.Text.RegularExpressions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Imaging;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Defense.Engine;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Shared.Io;

namespace MathComps.Cli.Examiner.Fixtures;

/// <summary>
/// A defense-conversation fixture: a folder holding the problem, its reference solution, and the working transcript,
/// the files the examiner's input is loaded from, plus any drawing a candidate turn was sent with. A candidate turn
/// names each drawing on a line of its own, <c>![Figure 1](crops/figure-1.jpg)</c>, with the JPEG's path relative to
/// the folder.
/// </summary>
public static class Fixture
{
    /// <summary>
    /// The transcript file's name within a fixture folder.
    /// </summary>
    private const string TranscriptFileName = "transcript.md";

    /// <summary>
    /// Matches a crop line, the label and the path of one drawing, together with a blank line right after it, so
    /// taking the line out leaves the paragraphs around it one blank line apart.
    /// </summary>
    private static readonly Regex _cropLinePattern = new(
        @"^[ \t]*!\[(?<label>[^\]\n]+)\]\((?<path>[^)\n]+)\)[ \t]*(?:\n|$)(?:[ \t]*\n)?",
        RegexOptions.Compiled | RegexOptions.Multiline);

    /// <summary>
    /// Loads a fixture from its folder, reading the problem, reference, and transcript, and attaching to each
    /// candidate turn the drawings its crop lines name.
    /// </summary>
    /// <param name="folder">The fixture folder.</param>
    /// <param name="cancellationToken">A token to cancel the reads.</param>
    /// <returns>The loaded fixture.</returns>
    /// <exception cref="FileNotFoundException">A required file, or a drawing a crop line names, is missing.</exception>
    /// <exception cref="InvalidDataException">A drawing a crop line names is not a JPEG.</exception>
    public static async Task<ExaminerInput> LoadAsync(string folder, CancellationToken cancellationToken = default)
    {
        // The problem statement, seen by both sides.
        var problem = await FileUtilities.ReadRequiredAsync(folder, "problem.md", cancellationToken);

        // The reference solution, the examiner's to hold.
        var reference = await FileUtilities.ReadRequiredAsync(folder, "reference.md", cancellationToken);

        // The raw transcript markdown.
        var transcriptMarkdown = await FileUtilities.ReadRequiredAsync(folder, TranscriptFileName, cancellationToken);

        // Parse the raw transcript into turns.
        var transcript = Transcript.Parse(transcriptMarkdown);

        // The turns with their drawings: the candidate sends them, the examiner never does.
        var turns = await transcript.Turns.ToAsyncEnumerable()
            .Select(async (turn, token) => turn.Role switch
            {
                TranscriptRole.Candidate => await AttachCropsAsync(folder, turn, token),
                TranscriptRole.Examiner => turn,
                _ => throw new ArgumentOutOfRangeException(nameof(turn), turn.Role, "Unknown transcript role."),
            })
            .ToListAsync(cancellationToken);

        // Assemble the loaded fixture.
        return new ExaminerInput(problem, reference, new Transcript([.. turns]));
    }

    /// <summary>
    /// Appends an examiner reply to a fixture's transcript file. The file is read afresh, so the crop lines a loaded
    /// fixture takes out of its turns stay where they were written.
    /// </summary>
    /// <param name="folder">The fixture folder.</param>
    /// <param name="reply">The examiner's reply.</param>
    /// <param name="cancellationToken">A token to cancel the read and the write.</param>
    public static async Task AppendReplyAsync(
        string folder, string reply, CancellationToken cancellationToken = default)
    {
        // The transcript as written, crop lines and all.
        var transcriptMarkdown = await FileUtilities.ReadRequiredAsync(folder, TranscriptFileName, cancellationToken);

        // The conversation with the reply as its newest turn.
        var updated = Transcript.Parse(transcriptMarkdown).Append(TranscriptRole.Examiner, reply);

        // Write the conversation back to the file, keeping a trailing newline.
        await File.WriteAllTextAsync(
            Path.Combine(folder, TranscriptFileName), updated.ToMarkdown() + "\n", cancellationToken);
    }

    /// <summary>
    /// Takes a turn's crop lines out of its text and attaches the drawings they name, in the order they are written.
    /// </summary>
    /// <param name="folder">The fixture folder the crop paths are relative to.</param>
    /// <param name="turn">The turn as parsed, its crop lines still in the text.</param>
    /// <param name="cancellationToken">A token to cancel the reads.</param>
    /// <returns>The turn with its crop lines turned into drawings.</returns>
    private static async Task<TranscriptTurn> AttachCropsAsync(
        string folder, TranscriptTurn turn, CancellationToken cancellationToken)
    {
        // The turn's crop lines.
        var cropLines = _cropLinePattern.Matches(turn.Text);

        // A turn without crop lines loads as written.
        if (cropLines.Count == 0)
            return turn;

        // Each crop line's drawing, read in order.
        var crops = await cropLines.ToAsyncEnumerable()
            .Select(async (match, token) => await ReadCropAsync(
                folder, match.Groups["label"].Value, match.Groups["path"].Value, token))
            .ToListAsync(cancellationToken);

        // The turn's text without its crop lines.
        var text = _cropLinePattern.Replace(turn.Text, "").Trim();

        // Hand back the turn with its drawings attached.
        return turn with { Text = text, Crops = [.. crops] };
    }

    /// <summary>
    /// Reads one drawing a crop line names.
    /// </summary>
    /// <param name="folder">The fixture folder the path is relative to.</param>
    /// <param name="label">The drawing's marker in the turn's text, such as <c>Figure 1</c>.</param>
    /// <param name="relativePath">The drawing's path within the fixture folder.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The drawing.</returns>
    private static async Task<PhotoCrop> ReadCropAsync(
        string folder, string label, string relativePath, CancellationToken cancellationToken)
    {
        // The drawing's bytes.
        var image = await FileUtilities.ReadRequiredBytesAsync(folder, relativePath, cancellationToken);

        // Every drawing goes to the model labelled as a JPEG, so any other file is refused.
        if (RasterImages.MediaTypeOf(image) != MediaTypeNames.Image.Jpeg)
            throw new InvalidDataException($"Crop file '{relativePath}' in '{folder}' is not a JPEG.");

        // The drawing under its marker.
        return new PhotoCrop(label, image);
    }
}

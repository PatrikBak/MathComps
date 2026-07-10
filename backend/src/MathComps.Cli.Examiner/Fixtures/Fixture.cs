using MathComps.Shared.Io;

namespace MathComps.Cli.Examiner.Fixtures;

/// <summary>
/// A defense-conversation fixture loaded from a folder: the problem, its reference solution, and the working
/// transcript — the three inputs the examiner runs on.
/// </summary>
/// <param name="Problem">The problem statement, seen by both sides.</param>
/// <param name="Reference">The reference solution, in the examiner's context only.</param>
/// <param name="Transcript">The conversation so far.</param>
public record Fixture(string Problem, string Reference, Transcript Transcript)
{
    /// <summary>
    /// Loads a fixture from its folder, reading the problem, reference, and transcript.
    /// </summary>
    /// <param name="folder">The fixture folder.</param>
    /// <param name="cancellationToken">A token to cancel the reads.</param>
    /// <returns>The loaded fixture.</returns>
    public static async Task<Fixture> LoadAsync(string folder, CancellationToken cancellationToken = default)
    {
        // The problem statement, seen by both sides.
        var problem = await FileUtilities.ReadRequiredAsync(folder, "problem.md", cancellationToken);

        // The reference solution, the examiner's to hold.
        var reference = await FileUtilities.ReadRequiredAsync(folder, "reference.md", cancellationToken);

        // The raw transcript markdown.
        var transcriptMarkdown = await FileUtilities.ReadRequiredAsync(folder, "transcript.md", cancellationToken);

        // Parse the raw transcript into turns.
        var transcript = Transcript.Parse(transcriptMarkdown);

        // Assemble the loaded fixture.
        return new Fixture(problem, reference, transcript);
    }
}

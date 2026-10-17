using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Defense.Engine;
using MathComps.Shared.Io;

namespace MathComps.Cli.Examiner.Fixtures;

/// <summary>
/// A defense-conversation fixture: a folder holding the problem, its reference solution, and the working transcript,
/// the files the examiner's input is loaded from.
/// </summary>
public static class Fixture
{
    /// <summary>
    /// Loads a fixture from its folder, reading the problem, reference, and transcript.
    /// </summary>
    /// <param name="folder">The fixture folder.</param>
    /// <param name="cancellationToken">A token to cancel the reads.</param>
    /// <returns>The loaded fixture.</returns>
    public static async Task<ExaminerInput> LoadAsync(string folder, CancellationToken cancellationToken = default)
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
        return new ExaminerInput(problem, reference, transcript);
    }
}

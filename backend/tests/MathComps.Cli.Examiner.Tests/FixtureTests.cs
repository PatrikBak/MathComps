using MathComps.Cli.Examiner.Fixtures;

namespace MathComps.Cli.Examiner.Tests;

/// <summary>
/// Tests loading a fixture folder: each of the three files maps to its own field, and a missing required file is
/// named rather than surfacing an opaque I/O error.
/// </summary>
public class FixtureTests
{
    /// <summary>
    /// Loading maps each file to its field — problem.md to Problem, reference.md to Reference, transcript.md parsed
    /// into turns — checked against sentinel content so the mapping can't ride on any particular fixture's prose and a
    /// problem/reference swap would surface here.
    /// </summary>
    [Fact]
    public async Task LoadAsync_maps_each_file_to_its_field()
    {
        // A throwaway fixture with distinguishable content in each of the three files.
        var folder = Directory.CreateTempSubdirectory("examiner-fixture-tests");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "problem.md"), "the problem");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "reference.md"), "the reference");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "transcript.md"), "## Candidate\n\nmy defense");

        // Load it under a cleanup guard.
        try
        {
            // Load the fixture.
            var fixture = await Fixture.LoadAsync(folder.FullName);

            // The problem file landed in the problem field.
            Assert.Equal("the problem", fixture.Problem);

            // The reference file landed in the reference field — not swapped with the problem.
            Assert.Equal("the reference", fixture.Reference);

            // The transcript markdown parsed into its single candidate turn.
            var turn = Assert.Single(fixture.Transcript.Turns);
            Assert.Equal(new TranscriptTurn(TranscriptRole.Candidate, "my defense"), turn);
        }
        finally
        {
            // Clean up the temp folder.
            folder.Delete(recursive: true);
        }
    }

    /// <summary>
    /// A folder missing a required file fails with a message naming that file rather than an opaque I/O error.
    /// </summary>
    [Fact]
    public async Task LoadAsync_names_a_missing_required_file()
    {
        // An empty folder — no problem.md, no anything.
        var emptyFolder = Directory.CreateTempSubdirectory("examiner-fixture-tests");

        // Load it under a cleanup guard.
        try
        {
            // Loading throws for the first required file it can't find.
            var exception = await Assert.ThrowsAsync<FileNotFoundException>(
                () => Fixture.LoadAsync(emptyFolder.FullName));

            // The error names that file.
            Assert.Contains("problem.md", exception.Message);
        }
        finally
        {
            // Clean up the temp folder.
            emptyFolder.Delete(recursive: true);
        }
    }
}

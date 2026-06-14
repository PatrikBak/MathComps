using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Validation;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests the image-ref hard gate that unites validate and apply: every referenced figure must size cleanly, as a
/// blocking error, before any import. Runs against a temp draft folder seeded from the real fixtures, so it
/// exercises the same read apply performs.
/// </summary>
public class ImageRefValidatorTests : IDisposable
{
    /// <summary>A throwaway draft folder with an <c>images/</c> subfolder, cleaned up after each test.</summary>
    private readonly string _folder;

    /// <summary>
    /// Creates the throwaway draft folder and its <c>images/</c> subfolder.
    /// </summary>
    public ImageRefValidatorTests()
    {
        _folder = Path.Combine(Path.GetTempPath(), $"imageref-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(_folder, "images"));
    }

    /// <inheritdoc/>
    public void Dispose() => Directory.Delete(_folder, recursive: true);

    /// <summary>
    /// A problem referencing a real, readable figure yields no issues.
    /// </summary>
    [Fact]
    public void A_readable_image_passes()
    {
        // Seed a real PNG the validator can size.
        File.Copy(Fixture("fig.png"), Path.Combine(_folder, "images", "fig.png"));

        // No issues for a figure that reads cleanly.
        Assert.Empty(ImageRefValidator.Check([ProblemReferencing("fig.png")], _folder));
    }

    /// <summary>
    /// An unsupported format is one blocking error — the same rejection apply would hit, surfaced at validate.
    /// </summary>
    [Fact]
    public void An_unsupported_format_is_a_blocking_error()
    {
        // A file with an extension the pipeline can't size or serve.
        File.WriteAllBytes(Path.Combine(_folder, "images", "icon.gif"), [0x47, 0x49, 0x46]);

        // Exactly one error, attributed to the figure, at error severity.
        var issue = Assert.Single(ImageRefValidator.Check([ProblemReferencing("icon.gif")], _folder));
        Assert.Equal("images/icon.gif", issue.File);
        Assert.Equal("image", issue.Rule);
        Assert.Equal(VerdictSeverity.Error, issue.Severity);
    }

    /// <summary>
    /// A corrupt file with a valid extension is still a blocking error — the dimension read fails on the bytes.
    /// </summary>
    [Fact]
    public void A_corrupt_image_is_a_blocking_error()
    {
        // A PNG extension, but the bytes aren't a PNG.
        File.WriteAllBytes(Path.Combine(_folder, "images", "broken.png"), [0x00, 0x01, 0x02, 0x03]);

        // One blocking error.
        var issue = Assert.Single(ImageRefValidator.Check([ProblemReferencing("broken.png")], _folder));
        Assert.Equal(VerdictSeverity.Error, issue.Severity);
    }

    /// <summary>
    /// A reference that doesn't exist is left to the preflight's own missing-image check, not double-reported here.
    /// </summary>
    [Fact]
    public void A_missing_image_is_left_to_the_preflight() =>
        // Nothing on disk for this ref — the validator stays quiet.
        Assert.Empty(ImageRefValidator.Check([ProblemReferencing("absent.png")], _folder));

    /// <summary>
    /// Resolves a committed image fixture by file name.
    /// </summary>
    /// <param name="name">The fixture file name under <c>Fixtures/Images</c>.</param>
    /// <returns>The absolute path to the fixture in the test output directory.</returns>
    private static string Fixture(string name) =>
        Path.Combine(AppContext.BaseDirectory, "Fixtures", "Images", name);

    /// <summary>
    /// Builds a minimal problem that references a single image by basename.
    /// </summary>
    /// <param name="basename">The image basename the problem references.</param>
    /// <returns>A problem carrying just that one image reference.</returns>
    private static ManifestProblem ProblemReferencing(string basename) =>
        new(1, [], null, null, [], [basename]);
}

using MathComps.Infrastructure.Services.BulkImport;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Unit tests for <see cref="ProblemImageRefs.BuildReplacements"/>'s figure version, the one part of a resolved ref
/// that moves while the media key and dimensions stay put: a redrawn figure must get a new URL, and an unchanged one
/// must keep its old one, or every re-import would rewrite its texts.
/// </summary>
public class ProblemImageRefsTests
{
    /// <summary>
    /// The same bytes resolve to the same version, and a redraw of the same size to a different one.
    /// </summary>
    [Fact]
    public void A_redrawn_figure_gets_a_new_version_and_an_unchanged_one_keeps_its_own()
    {
        // A draft folder holding one figure.
        var folder = Path.Combine(Path.GetTempPath(), $"problem-image-refs-{Guid.NewGuid():N}");
        var figurePath = Path.Combine(folder, "images", "fig.svg");
        Directory.CreateDirectory(Path.GetDirectoryName(figurePath)!);

        // Resolve the figure across a redraw, removing the folder whatever happens.
        try
        {
            // The figure as first drawn.
            File.WriteAllText(figurePath, "<svg width=\"100px\" height=\"80px\"><circle r=\"10\"/></svg>");

            // Resolve it twice over the same bytes.
            var first = ProblemImageRefs.BuildReplacements(["fig.svg"], "slug", folder)["images/fig.svg"];
            var again = ProblemImageRefs.BuildReplacements(["fig.svg"], "slug", folder)["images/fig.svg"];

            // Unchanged bytes keep their version.
            Assert.Equal(first.Version, again.Version);

            // Redraw it at the same size under the same name.
            File.WriteAllText(figurePath, "<svg width=\"100px\" height=\"80px\"><circle r=\"20\"/></svg>");

            // Resolve the redrawn figure.
            var redrawn = ProblemImageRefs.BuildReplacements(["fig.svg"], "slug", folder)["images/fig.svg"];

            // The key and size stay put.
            Assert.Equal(
                (first.MediaKey, first.Width, first.Height), (redrawn.MediaKey, redrawn.Width, redrawn.Height));

            // The version moves.
            Assert.NotEqual(first.Version, redrawn.Version);
        }
        finally
        {
            // Leave no draft folder behind.
            Directory.Delete(folder, recursive: true);
        }
    }
}

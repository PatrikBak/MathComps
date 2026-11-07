using MathComps.Infrastructure.Services.BulkImport;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Unit tests for <see cref="ProblemImageRefs.BuildReplacements"/>'s figure names, which end in a hash of the figure's
/// bytes: a redrawn figure must get a new name, and an unchanged one must keep its old one, or every re-import would
/// rewrite its texts and upload it again.
/// </summary>
public class ProblemImageRefsTests
{
    /// <summary>
    /// The same bytes resolve to the same name, and a redraw of the same size under the same filename to a different
    /// one.
    /// </summary>
    [Fact]
    public void A_redrawn_figure_gets_a_new_name_and_an_unchanged_one_keeps_its_own()
    {
        // A throwaway draft folder and the path of its one figure.
        var folder = Path.Combine(Path.GetTempPath(), $"problem-image-refs-{Guid.NewGuid():N}");
        var figurePath = Path.Combine(folder, "images", "fig.svg");

        // The folder's images directory.
        Directory.CreateDirectory(Path.GetDirectoryName(figurePath)!);

        // Resolve the figure across a redraw, removing the folder whatever happens.
        try
        {
            // The figure as first drawn.
            File.WriteAllText(figurePath, "<svg width=\"100px\" height=\"80px\"><circle r=\"10\"/></svg>");

            // Resolve it twice over the same bytes.
            var first = ProblemImageRefs.BuildReplacements(["fig.svg"], "slug", folder)["images/fig.svg"];
            var again = ProblemImageRefs.BuildReplacements(["fig.svg"], "slug", folder)["images/fig.svg"];

            // Unchanged bytes keep their name.
            Assert.Equal(first.ContentId, again.ContentId);

            // Redraw it at the same size under the same name.
            File.WriteAllText(figurePath, "<svg width=\"100px\" height=\"80px\"><circle r=\"20\"/></svg>");

            // Resolve the redrawn figure.
            var redrawn = ProblemImageRefs.BuildReplacements(["fig.svg"], "slug", folder)["images/fig.svg"];

            // The size stays put.
            Assert.Equal((first.Width, first.Height), (redrawn.Width, redrawn.Height));

            // The name moves.
            Assert.NotEqual(first.ContentId, redrawn.ContentId);
        }
        finally
        {
            // Leave no draft folder behind.
            Directory.Delete(folder, recursive: true);
        }
    }
}

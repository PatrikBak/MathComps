using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the shape operations the stored competition tree is walked and stamped through. The dry run, the write
/// and the test seeds all descend and stamp via these, so a drift here would let the preview report a
/// renumbering the import doesn't perform.
/// </summary>
public class CompetitionTreeTests
{
    /// <summary>
    /// Descending a path yields every competition on it, root-down, each carrying the generation it sits in.
    /// </summary>
    [Fact]
    public void Descend_yields_the_whole_chain_root_down()
    {
        // Walk a three-level path.
        var chain = CompetitionTree.Descend("csmo-a-iii").ToList();

        // One entry per segment, the addressed competition last.
        Assert.Equal(["csmo", "csmo-a", "csmo-a-iii"], chain.Select(node => node.Path));

        // Each names the parent whose children its generation is, the root having none.
        Assert.Equal([null, "csmo", "csmo-a"], chain.Select(node => node.ParentPath));

        // And its own slug, which is the segment it was reached by.
        Assert.Equal(["csmo", "a", "iii"], chain.Select(node => node.Slug));
    }

    /// <summary>
    /// A competition that runs as one flat sitting is the whole walk — a single root, nothing above it.
    /// </summary>
    [Fact]
    public void Descend_of_a_root_is_the_root_alone()
    {
        // Walk a one-segment path.
        var chain = CompetitionTree.Descend("imo").ToList();

        // The root is the only competition on it, and it extends nothing.
        Assert.Equal(new DescendedNode(null, "imo", "imo"), Assert.Single(chain));
    }

    /// <summary>
    /// A path segment outside the canonical slug alphabet is refused as the walk reaches it.
    /// </summary>
    [Fact]
    public void Descend_refuses_a_segment_that_is_not_a_slug() =>
        Assert.Throws<InvalidOperationException>(() => CompetitionTree.Descend("csmo--iii").ToList());

    /// <summary>
    /// A sort path extends its parent's with the competition's own zero-padded position, a root carrying that
    /// position alone.
    /// </summary>
    /// <param name="parentSortPath">The parent's sort path, or null at a root.</param>
    /// <param name="sortOrder">The competition's position among its siblings.</param>
    /// <param name="expected">The sort path it composes to.</param>
    [Theory]
    [InlineData(null, 1, "0001")]
    [InlineData(null, 12, "0012")]
    [InlineData("0001", 4, "0001.0004")]
    [InlineData("0001.0001", 4, "0001.0001.0004")]
    public void A_sort_path_extends_its_parents(string? parentSortPath, int sortOrder, string expected) =>
        Assert.Equal(expected, CompetitionTree.ComposeSortPath(parentSortPath, sortOrder));

    /// <summary>
    /// Restamping rebuilds every sort path from the sibling orders the rows carry, so a competition renumbered
    /// anywhere in the tree carries its whole branch with it rather than stranding the paths below.
    /// </summary>
    [Fact]
    public void Restamping_rewrites_the_paths_below_a_moved_competition()
    {
        // A root with a category under it, and a round under that, all stamped for the root's original position.
        var root = Node(parent: null, sortOrder: 1, sortPath: "0001");
        var category = Node(root, sortOrder: 2, sortPath: "0001.0002");
        var round = Node(category, sortOrder: 3, sortPath: "0001.0002.0003");

        // The root moves to the third slot among its siblings, which every path below it reads through.
        root.SortOrder = 3;

        // Rebuild the whole tree's paths from the orders it now carries.
        CompetitionTree.RestampSortPaths([root, category, round]);

        // The moved root took its branch with it, each level keeping its own unchanged position.
        Assert.Equal("0003", root.SortPath);
        Assert.Equal("0003.0002", category.SortPath);
        Assert.Equal("0003.0002.0003", round.SortPath);
    }

    /// <summary>
    /// Builds a competition row at a position, with only the fields the stamping reads filled in.
    /// </summary>
    /// <param name="parent">The competition one level up, null at a root.</param>
    /// <param name="sortOrder">Its position among its siblings.</param>
    /// <param name="sortPath">The sort path it starts out holding.</param>
    /// <returns>The competition row.</returns>
    private static Competition Node(Competition? parent, int sortOrder, string sortPath) =>
        new()
        {
            ParentId = parent?.Id,
            Slug = sortPath,
            Path = sortPath,
            SortPath = sortPath,
            SortOrder = sortOrder
        };
}

using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the projection of a contest node onto the three levels the archive contracts name. Depth is what
/// decides which levels a node fills, so this is where the category and whole-competition shapes are pinned down.
/// </summary>
public class ContestLevelsTests
{
    /// <summary>
    /// A round under a category fills all three levels, each with its own slug, path and position.
    /// </summary>
    [Fact]
    public void A_round_under_a_category_fills_every_level()
    {
        // Read the levels off the deepest shape the tree carries today.
        var levels = ContestLevels.From("csmo-a-iii", "0001.0001.0004");

        // The competition is the root the chain descends from.
        Assert.Equal(new ContestLevel("csmo", "csmo", "0001"), levels.Competition);

        // The category sits between them, carrying both its slug and the path that addresses it.
        Assert.Equal(new ContestLevel("a", "csmo-a", "0001"), levels.Category);

        // The round is the node itself.
        Assert.Equal(new ContestLevel("iii", "csmo-a-iii", "0004"), levels.Round);
    }

    /// <summary>
    /// A round hanging straight off its competition names no category.
    /// </summary>
    [Fact]
    public void A_round_without_a_category_names_none()
    {
        // Read the levels off a two-deep chain.
        var levels = ContestLevels.From("tst-d1", "0002.0001");

        // The competition and the round are both there …
        Assert.Equal(new ContestLevel("tst", "tst", "0002"), levels.Competition);
        Assert.Equal(new ContestLevel("d1", "tst-d1", "0001"), levels.Round);

        // … and nothing sits between them.
        Assert.Null(levels.Category);
    }

    /// <summary>
    /// A contest that is its whole competition names neither a category nor a round.
    /// </summary>
    [Fact]
    public void A_whole_competition_names_no_category_and_no_round()
    {
        // Read the levels off a root.
        var levels = ContestLevels.From("imo", "0004");

        // The competition is all there is.
        Assert.Equal(new ContestLevel("imo", "imo", "0004"), levels.Competition);
        Assert.Null(levels.Category);
        Assert.Null(levels.Round);
    }

    /// <summary>
    /// A node deeper than a round still projects onto the three levels, keeping the outermost two and itself,
    /// rather than failing on a shape the contracts can't express.
    /// </summary>
    [Fact]
    public void A_node_below_a_round_keeps_the_outer_levels_and_itself()
    {
        // Read the levels off a four-deep chain, which the tree allows and the contracts do not.
        var levels = ContestLevels.From("csmo-a-i-n", "0001.0001.0001.0002");

        // The outermost two levels are unchanged …
        Assert.Equal(new ContestLevel("csmo", "csmo", "0001"), levels.Competition);
        Assert.Equal(new ContestLevel("a", "csmo-a", "0001"), levels.Category);

        // … and the node itself takes the round slot, so it is still addressable.
        Assert.Equal(new ContestLevel("n", "csmo-a-i-n", "0002"), levels.Round);
    }

    /// <summary>
    /// The two paths describe the same chain, so a disagreement about its depth is a corrupted node rather
    /// than something to guess at.
    /// </summary>
    [Fact]
    public void Paths_of_different_depths_throw() =>
        Assert.Throws<InvalidOperationException>(() => ContestLevels.From("csmo-a-iii", "0001.0001"));
}

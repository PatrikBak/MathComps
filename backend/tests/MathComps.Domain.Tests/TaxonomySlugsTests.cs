using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the canonical taxonomy slug formulas. Every layer keys rounds and problems through these, so a drift
/// here would desync the registry, the persisted entities and the dry-run preview from each other.
/// </summary>
public class TaxonomySlugsTests
{
    /// <summary>
    /// A problem slug is <c>{editionNumber}-{competitionPath}-{order}</c>.
    /// </summary>
    [Fact]
    public void Problem_slug_combines_edition_competition_path_and_order() =>
        Assert.Equal("75-csmo-a-iii-1", TaxonomySlugs.ProblemSlug(75, "csmo-a-iii", 1));

    /// <summary>
    /// A node's path extends its parent's, which is what makes a competition's path a chain of its ancestors' slugs.
    /// </summary>
    [Fact]
    public void Path_extends_the_parent() =>
        Assert.Equal("csmo-a-iii", TaxonomySlugs.ComposePath("csmo-a", "iii"));

    /// <summary>
    /// A root has no parent to extend, so its path is its own slug.
    /// </summary>
    [Fact]
    public void Path_of_a_root_is_its_slug() =>
        Assert.Equal("imo", TaxonomySlugs.ComposePath(null, "imo"));

    /// <summary>
    /// A slug carrying the separator is refused: composed into a path it would name a node of the branch its
    /// first segment spells, so <c>a-b</c> under <c>csmo</c> would collide with the <c>csmo-a</c> branch.
    /// </summary>
    [Fact]
    public void Path_refuses_a_slug_carrying_the_separator() =>
        Assert.Throws<InvalidOperationException>(() => TaxonomySlugs.ComposePath("csmo", "a-b"));

    /// <summary>
    /// The canonical slug alphabet is lowercase letters and digits, and nothing else is one segment.
    /// </summary>
    /// <param name="slug">The slug under test.</param>
    /// <param name="expected">Whether it is a single path segment.</param>
    [Theory]
    [InlineData("csmo", true)]
    [InlineData("z9", true)]
    [InlineData("d1", true)]
    [InlineData("a-b", false)]
    [InlineData("", false)]
    [InlineData("A", false)]
    [InlineData("a b", false)]
    public void Path_segments_are_lowercase_alphanumeric(string slug, bool expected) =>
        Assert.Equal(expected, TaxonomySlugs.IsPathSegment(slug));

    /// <summary>
    /// Selecting a branch takes the branch itself and everything under it, at any depth — and nothing whose
    /// slug merely starts with the same characters, which is how a two-digit category would otherwise be swept in.
    /// </summary>
    /// <param name="path">The node's path.</param>
    /// <param name="branchPath">The branch being selected.</param>
    /// <param name="expected">Whether the node is covered by that selection.</param>
    [Theory]
    // A branch covers itself.
    [InlineData("csmo-a", "csmo-a", true)]
    // And everything below it, however deep.
    [InlineData("csmo-a-iii", "csmo-a", true)]
    [InlineData("csmo-a-i-n", "csmo-a", true)]
    [InlineData("csmo-a-iii", "csmo", true)]
    // A sibling sharing a prefix is not a descendant, which is what the separator decides.
    [InlineData("csmo-z10", "csmo-z1", false)]
    [InlineData("csmoa", "csmo", false)]
    // Nor is anything above it or beside it.
    [InlineData("csmo", "csmo-a", false)]
    [InlineData("csmo-b-i", "csmo-a", false)]
    public void A_branch_covers_itself_and_its_descendants(string path, string branchPath, bool expected) =>
        Assert.Equal(expected, TaxonomySlugs.IsAtOrUnder(path, branchPath));
}

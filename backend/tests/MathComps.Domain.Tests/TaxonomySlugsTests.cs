using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the canonical taxonomy slug formulas. Every layer keys rounds and problems through these, so a drift
/// here would desync the registry, the persisted entities and the dry-run preview from each other.
/// </summary>
public class TaxonomySlugsTests
{
    /// <summary>
    /// A categorized round composes to <c>{competition}-{category}-{round}</c>.
    /// </summary>
    [Fact]
    public void Composite_round_slug_includes_the_category_when_present() =>
        Assert.Equal("csmo-a-iii", TaxonomySlugs.ComposeRoundSlug("csmo", "a", "iii"));

    /// <summary>
    /// A category-less round drops the category segment.
    /// </summary>
    [Fact]
    public void Composite_round_slug_omits_the_category_when_absent() =>
        Assert.Equal("memo-i", TaxonomySlugs.ComposeRoundSlug("memo", null, "i"));

    /// <summary>
    /// A default round (null slug) drops the round segment, leaving the competition (and category, if any).
    /// </summary>
    [Fact]
    public void Composite_round_slug_omits_the_round_when_absent() =>
        Assert.Equal("imo", TaxonomySlugs.ComposeRoundSlug("imo", null, null));

    /// <summary>
    /// Raw, unslugified inputs are normalized — casing and spacing collapse to the canonical slug form.
    /// </summary>
    [Fact]
    public void Composite_round_slug_slugifies_raw_inputs() =>
        Assert.Equal("csmo-a-iii", TaxonomySlugs.ComposeRoundSlug("CSMO", "A", "III"));

    /// <summary>
    /// A problem slug is <c>{editionNumber}-{compositeRoundSlug}-{order}</c>.
    /// </summary>
    [Fact]
    public void Problem_slug_combines_edition_round_and_order() =>
        Assert.Equal("75-csmo-a-iii-1", TaxonomySlugs.ProblemSlug(75, "csmo-a-iii", 1));

    /// <summary>
    /// A node's path extends its parent's, which is what makes the composed round slug a path too.
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
}

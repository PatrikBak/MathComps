using MathComps.Shared.Localization;

namespace MathComps.Shared.Tests;

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
}

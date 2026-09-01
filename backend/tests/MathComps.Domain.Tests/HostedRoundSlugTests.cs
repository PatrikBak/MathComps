using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the slug a hosted competition is addressed by. It is the whole of what a URL and every call about the
/// competition carry, so a slug that reads back as a different round, or refuses to read back at all, is a
/// student sent to somebody else's paper or to nothing.
/// </summary>
public class HostedRoundSlugTests
{
    /// <summary>
    /// Every slug this builds reads back into the two things it was built from, the node names that end in a
    /// number included. Those are the ones a naive split on the last separator would take the number off.
    /// </summary>
    /// <param name="nodeUrlSlug">What the node is called.</param>
    /// <param name="seasonStartYear">The year the season starts in.</param>
    [Theory]
    [InlineData("practice", 2026)]
    [InlineData("pokrocila-1", 2026)]
    [InlineData("advanced-1", 2025)]
    [InlineData("2", 1999)]
    public void A_built_slug_reads_back_into_what_built_it(string nodeUrlSlug, int seasonStartYear)
    {
        // Round trip it
        var read = HostedRoundSlug.TryParse(
            HostedRoundSlug.Build(nodeUrlSlug, seasonStartYear), out var readSlug, out var readYear);

        // The slug reads
        Assert.True(read);

        // As the node it was built from
        Assert.Equal(nodeUrlSlug, readSlug);

        // And the season it ran in
        Assert.Equal(seasonStartYear, readYear);
    }

    /// <summary>
    /// Anything not shaped like a slug this builds reads as no slug at all: nothing at all, a bare node name, a
    /// year with no node in front of it, a tail that is not four digits, and a tail that only parses as a number
    /// because a sign or a space is being read as part of it.
    /// </summary>
    /// <param name="slug">What arrived in the URL.</param>
    [Theory]
    [InlineData("")]
    [InlineData("practice")]
    [InlineData("2026")]
    [InlineData("-2026")]
    [InlineData("practice-26")]
    [InlineData("practice-20267")]
    [InlineData("practice-202x")]
    [InlineData("practice- 202")]
    [InlineData("practice-+202")]
    public void A_slug_of_another_shape_reads_as_none(string slug) =>
        Assert.False(HostedRoundSlug.TryParse(slug, out _, out _));
}

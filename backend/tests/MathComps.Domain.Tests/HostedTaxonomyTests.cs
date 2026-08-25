using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests how a hosted round's level is read off the node it hangs off. It is the only thing saying which level a
/// competition runs at — the level is nowhere in the database — so a category read wrong is a student sent to the
/// wrong paper with nothing else to correct it.
/// </summary>
public class HostedTaxonomyTests
{
    /// <summary>
    /// Each level's node names its own category, read from the segment under the root rather than from the group
    /// segment below it.
    /// </summary>
    /// <param name="competitionPath">The node's path.</param>
    /// <param name="expected">The level it runs at.</param>
    [Theory]
    [InlineData("mc-elementary-3", HostedCompetitionCategory.Elementary)]
    [InlineData("mc-intermediate-3", HostedCompetitionCategory.Intermediate)]
    [InlineData("mc-advanced-3", HostedCompetitionCategory.Advanced)]
    public void Each_levels_node_names_its_category(
        string competitionPath, HostedCompetitionCategory expected) =>
        Assert.Equal(expected, HostedTaxonomy.CategoryOf(competitionPath));

    /// <summary>
    /// A node that is not one of the levels runs outside them, which is what the practice group is. The root
    /// itself is the degenerate case: one segment, so the path never reaches a category at all.
    /// </summary>
    /// <param name="competitionPath">The node's path.</param>
    [Theory]
    [InlineData("mc")]
    [InlineData("mc-practice")]
    [InlineData("mc-practice-1")]
    public void A_node_outside_the_levels_names_none(string competitionPath) =>
        Assert.Null(HostedTaxonomy.CategoryOf(competitionPath));

    /// <summary>
    /// A level is named by a whole segment, so a node whose segment merely starts with one is not that level.
    /// The separator is what the path is split on, which is what keeps the match from being a prefix match.
    /// </summary>
    [Fact]
    public void A_segment_merely_starting_with_a_level_is_not_that_level() =>
        Assert.Null(HostedTaxonomy.CategoryOf("mc-advancedextra-3"));
}

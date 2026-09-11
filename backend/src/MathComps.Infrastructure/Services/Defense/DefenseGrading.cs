using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// What the database holds about the round a conversation was argued under, and whether the student is graded
/// on it.
/// </summary>
/// <param name="Round">The round the conversation was argued under, or null for a handout conversation, which
/// was argued under no round at all.</param>
public sealed record DefenseGrading(DefenseProblemRound? Round)
{
    /// <summary>
    /// Whether the student is graded on what they argued. A handout, a proposal and the practice group each
    /// grade nobody; everything else was argued under a round somebody was grading.
    /// </summary>
    public bool IsGraded => Round switch
    {
        // A handout, argued under no round at all.
        null => false,

        // A proposal, which belongs to no competition anybody sits.
        { CompetitionPath: var path } when TaxonomySlugs.IsAtOrUnder(path, HostedTaxonomy.ProposalsPath) =>
            false,

        // The practice group, which never closes and grades nobody.
        { IsHosted: true, GroupClosesAt: null } => false,

        // A round somebody was grading, whether or not it still belongs to the group that ran it.
        _ => true,
    };
}

/// <summary>
/// The round a competition problem is set in.
/// </summary>
/// <param name="CompetitionPath"><inheritdoc cref="Competition.Path" path="/summary"/></param>
/// <param name="IsHosted">Whether the site itself runs the round the problem was set in.</param>
/// <param name="GroupClosesAt">When the group the round belongs to stops taking entries. Null for the practice
/// group, which never closes, and null again on a round the site does not host, which belongs to no group at
/// all.</param>
public sealed record DefenseProblemRound(
    string CompetitionPath, bool IsHosted, DateTimeOffset? GroupClosesAt);

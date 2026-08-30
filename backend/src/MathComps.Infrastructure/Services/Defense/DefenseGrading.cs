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
    /// Whether the student is graded on what they argued. A conversation about a problem is graded unless that
    /// problem is set in a group that never closes, which is the practice one and grades nobody. A handout is
    /// argued under no round at all, so nobody is graded on it either.
    /// </summary>
    public bool IsGraded => Round is not null and not { IsHosted: true, GroupClosesAt: null };
}

/// <summary>
/// The round a competition problem is set in.
/// </summary>
/// <param name="IsHosted">Whether the site itself runs the round the problem was set in.</param>
/// <param name="GroupClosesAt">When the group the round belongs to stops taking entries. Null for the practice
/// group, which never closes, and null again on a round the site does not host, which belongs to no group at
/// all.</param>
public sealed record DefenseProblemRound(bool IsHosted, DateTimeOffset? GroupClosesAt);

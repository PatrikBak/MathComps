namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One batch of competitions the site runs itself: the rounds that open and close together, one per category.
/// A group is what a student enters and what their clock is set by.
/// </summary>
/// <remarks>
/// The group carries no name of its own. Its rounds hang off competition nodes that already have a localized
/// name in the taxonomy metadata, and its categories share that name by construction (<c>mc-elementary-3</c>,
/// <c>mc-intermediate-3</c> and <c>mc-advanced-3</c> are all "3. súťaž"), so the group's name is read from the
/// taxonomy.
/// </remarks>
public class HostedGroup
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Stable identifier for the group, unique across groups (e.g. <c>mc-2026-3</c>). Writing the same slug again
    /// updates the group it already names rather than adding a second.
    /// </summary>
    public required string Slug { get; set; }

    /// <summary>
    /// When the group starts taking entries.
    /// </summary>
    public required DateTimeOffset OpensAt { get; set; }

    /// <summary>
    /// When the group stops taking entries, or null for a group that never closes, which is what makes it the
    /// practice one.
    /// </summary>
    public required DateTimeOffset? ClosesAt { get; set; }

    /// <summary>
    /// How long a student's own clock runs once they enter, in minutes. The clock starts where the student
    /// starts, not where the group opens.
    /// </summary>
    public required int ClockMinutes { get; set; }

    /// <summary>
    /// Whether a student who has already spent an entry may take another one.
    /// </summary>
    /// <remarks>
    /// On for the practice group, whose whole point is rehearsing the format. Taking a round again resets the
    /// student's one entry into it rather than adding a second.
    /// </remarks>
    public required bool AllowsReentry { get; set; }

    /// <summary>
    /// How many problems each of the group's competitions asks, announced rather than counted. A group goes on the
    /// site before anybody has picked its problems, so the number has to stand before the rounds hold anything, and
    /// the declaration is what keeps them from ever disagreeing with it.
    /// </summary>
    public required int ProblemCount { get; set; }

    /// <summary>
    /// The rounds the group runs, one per category.
    /// </summary>
    public ICollection<Round> Rounds { get; } = [];
}

using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One reviewer's rating of a proposal: how beautiful and how difficult they find it, each on the olympiad scale
/// from <see cref="MinScore"/> to <see cref="MaxScore"/>. A reviewer holds at most one per proposal.
/// </summary>
/// <remarks>
/// Either score can be left out, but not both, since a rating with neither says nothing.
/// </remarks>
public class ProposalRating
{
    /// <summary>
    /// The lowest score on the scale.
    /// </summary>
    public const int MinScore = 1;

    /// <summary>
    /// The highest score on the scale.
    /// </summary>
    public const int MaxScore = 5;

    /// <summary>
    /// FK to the proposal rated.
    /// </summary>
    public required Guid ProposalId { get; set; }

    /// <summary>
    /// Navigation to the proposal.
    /// </summary>
    public Proposal Proposal { get; set; } = null!;

    /// <summary>
    /// FK to the reviewer who rated it.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the reviewer.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// How beautiful the reviewer finds the problem; null while they have not said.
    /// </summary>
    [Range(MinScore, MaxScore)]
    public int? Beauty { get; set; }

    /// <summary>
    /// How difficult the reviewer finds the problem; null while they have not said.
    /// </summary>
    [Range(MinScore, MaxScore)]
    public int? Difficulty { get; set; }
}

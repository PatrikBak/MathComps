using System.ComponentModel.DataAnnotations;
using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One problem proposed for the hosted competitions' papers: what the reviewers say about it beyond its texts. The
/// problem itself is an ordinary row, parked in a round of the proposals branch until a paper takes it.
/// </summary>
/// <remarks>
/// A problem enters the pool when this row is written. The row stays once a paper takes the problem: it is what
/// the reviewers still read it by until its competition opens.
/// </remarks>
public class Proposal
{
    /// <summary>
    /// FK to the problem, which is also this row's key: a problem is proposed once.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// The number the reviewers quote the problem by, unique across every proposal. It never changes, wherever the
    /// problem moves, so #21 stays #21 through a paper and back.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int Number { get; set; }

    /// <summary>
    /// The working name, never shown to a student.
    /// </summary>
    [MaxLength(200)]
    public required string Title { get; set; }

    /// <summary>
    /// The area it is filed under.
    /// </summary>
    public required ProposalArea Area { get; set; }

    /// <summary>
    /// The categories the reviewers recommend it for, in the order the categories run.
    /// </summary>
    public required List<HostedCompetitionCategory> Recommended { get; set; }

    /// <summary>
    /// Whether the reviewers have set it aside, which leaves it in the selection.
    /// </summary>
    public bool IsSetAside { get; set; }

    /// <summary>
    /// When it was deleted, or null while it is not. A deleted proposal is gone from the selection, and keeps its
    /// problem, conversations and comments; clearing the stamp brings it back.
    /// </summary>
    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>
    /// The reviewers' comments on it via the join entity.
    /// </summary>
    public ICollection<ProposalComment> Comments { get; } = [];
}

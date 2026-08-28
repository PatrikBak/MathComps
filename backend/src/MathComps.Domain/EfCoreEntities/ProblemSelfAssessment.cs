namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// What a student wants to say about their own solution to one problem, in their own words: the case they
/// would make for it to whoever grades the problem. At most one per student per problem, revised rather than
/// accumulated, so it always reads as what they currently claim.
/// </summary>
/// <remarks>
/// Keyed on the student and the problem, and on nothing about the sitting, for the same reason a
/// <see cref="ProblemDefense"/> is: their conversations about a problem survive re-entry, so their claim about
/// it survives with them.
///
/// Distinct in kind from a <see cref="DefenseSessionFeedback"/>, which is about a conversation with the
/// examiner. This is about the solution itself.
/// </remarks>
public class ProblemSelfAssessment
{
    /// <summary>
    /// The student whose claim this is; part of this row's primary key.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the student.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// The problem the claim is about; part of this row's primary key.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// What the student says about the solution. The whole of the claim, so a row carrying nothing is a row
    /// that should have been deleted, which a check constraint refuses.
    /// </summary>
    public required string Comment { get; set; }

    /// <summary>
    /// When the student first said it.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// When it last changed, equal to <see cref="CreatedAt"/> until the student revises it.
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; set; }
}

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// An assignment of a tag to a problem.
/// </summary>
public class ProblemTag
{
    /// <summary>
    /// Foreign key to the problem.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>problem
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// Foreign key to the tag.
    /// </summary>
    public required Guid TagId { get; set; }

    /// <summary>
    /// Navigation to the tag.
    /// </summary>
    public Tag Tag { get; set; } = null!;

    /// <summary>
    /// Real number from 0 to 1.
    /// </summary>
    public required float GoodnessOfFit { get; set; }

    /// <summary>
    /// Reason given for assigning this tag to the given problem. This is used during vetoing
    /// of tags assignments.
    /// </summary>
    public string? Justification { get; set; }

    /// <summary>
    /// Used as follows:
    /// 1. The LLM suggests some tags to a problem, assigns it a confidence of 0
    /// 2. We have this process of veto-ing tags. Each round of vetoing increases
    ///    our confidence in the tag assignment by 1.
    /// For manual tag assignments, this is set to some big number (manual assignments
    /// have 100% confidence, since the human doing the assignment knows what they're doing).
    /// </summary>
    public int? Confidence { get; set; }
}

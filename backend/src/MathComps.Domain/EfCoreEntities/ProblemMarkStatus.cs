namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a user's mark on a problem (personal annotation indicating the problem has been dealt with).
/// </summary>
public class ProblemMarkStatus
{
    /// <summary>
    /// Foreign key to the user who marked the problem.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the user who marked the problem.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// Foreign key to the problem that was marked.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation property to the problem that was marked.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// Timestamp when the mark was created.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}

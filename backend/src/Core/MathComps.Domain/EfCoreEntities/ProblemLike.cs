namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a user's like on a problem.
/// </summary>
public class ProblemLike
{
    /// <summary>
    /// Foreign key to the user who liked the problem.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the user who liked the problem.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// Foreign key to the problem that was liked.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation property to the problem that was liked.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// Timestamp when the like was created.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}

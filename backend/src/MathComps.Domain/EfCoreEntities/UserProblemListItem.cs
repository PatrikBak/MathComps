namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join entity linking a problem to a user's list.
/// </summary>
public class UserProblemListItem
{
    /// <summary>
    /// Foreign key to the list that contains this problem.
    /// </summary>
    public required Guid ListId { get; set; }

    /// <summary>
    /// Navigation property to the containing list.
    /// </summary>
    public UserProblemList List { get; set; } = null!;

    /// <summary>
    /// Foreign key to the problem in the list.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation property to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// Timestamp when the problem was added to the list.
    /// </summary>
    public required DateTimeOffset AddedAt { get; set; }
}

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One capability handed to one account. A row is the whole of what a grant is: the rules read it where they
/// stand, so granting and revoking are a write and a delete.
/// </summary>
public class UserGrant
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The account holding the capability.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the account.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// What the account is allowed to do.
    /// </summary>
    public required UserCapability Capability { get; set; }

    /// <summary>
    /// When it was handed over.
    /// </summary>
    public DateTimeOffset GrantedAt { get; set; } = DateTimeOffset.UtcNow;
}

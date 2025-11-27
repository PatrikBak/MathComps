using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a user synced from Clerk.
/// </summary>
public class User
{
    /// <summary>
    /// Internal primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// ID coming from an external user auth system
    /// </summary>
    [MaxLength(100)]
    public required string ExternalId { get; set; }

    /// <summary>
    /// Email address (optional).
    /// </summary>
    [MaxLength(255)]
    public string? Email { get; set; }

    /// <summary>
    /// First name (optional).
    /// </summary>
    [MaxLength(100)]
    public string? FirstName { get; set; }

    /// <summary>
    /// Last name (optional).
    /// </summary>
    [MaxLength(100)]
    public string? LastName { get; set; }

    /// <summary>
    /// Whether the user has been soft deleted.
    /// </summary>
    public bool IsDeleted { get; set; }

    /// <summary>
    /// Timestamp when the user was created in our system.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Timestamp when the user was last updated in our system.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; set; }
}

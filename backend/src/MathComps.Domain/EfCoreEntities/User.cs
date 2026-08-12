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
    /// Display name of the user.
    /// </summary>
    [MaxLength(100)]
    public required string DisplayName { get; set; }

    /// <summary>
    /// URL to the user's avatar image (from Clerk).
    /// </summary>
    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    /// <summary>
    /// Whether the user has been soft deleted.
    /// </summary>
    public bool IsDeleted { get; set; }

    /// <summary>
    /// When the user acknowledged that the AI tutor is not a person and that conversations with her are stored
    /// and read, or null while they have yet to be told.
    /// </summary>
    public DateTimeOffset? ConsentedToAiAt { get; set; }

    /// <summary>
    /// Timestamp when the user was created in our system.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Timestamp when the user was last updated in our system.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; set; }
}

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
    /// The name the site calls this user by, chosen once and never changed, or null while they have yet to choose.
    /// </summary>
    /// <remarks>
    /// Unique, ignoring case. Results and standings hang off it, which is why it cannot be rewritten: an identity
    /// that can change would have to be snapshotted everywhere it has ever been shown.
    ///
    /// Deleting an account leaves this standing, so the name stays reserved rather than going back into
    /// circulation. That makes it the one piece of a deleted user that is still readable, so <b>anything that
    /// shows a username has to fall back to <see cref="DisplayName"/> when <see cref="IsDeleted"/> is set</b>,
    /// the way the comment author projections do. Deletion anonymizes that one and not this.
    /// </remarks>
    [MaxLength(20)]
    public string? Username { get; set; }

    /// <summary>
    /// The calendar year this student finishes secondary school, or null when they have not said or already
    /// have.
    /// </summary>
    /// <remarks>
    /// A year and not a grade, because a grade is only true until September while the year it ends in stays
    /// true. Unbounded: which years a student may pick from is the form's to decide.
    /// </remarks>
    public int? GraduationYear { get; set; }

    /// <summary>
    /// Whether this person is past high school, and so has no age group to be listed against.
    /// </summary>
    /// <remarks>
    /// Exclusive with <see cref="GraduationYear"/>: setting this clears that.
    /// </remarks>
    public bool HasLeftHighSchool { get; set; }

    /// <summary>
    /// Where this student competes from as an ISO 3166-1 alpha-2 code, or null while they have not said.
    /// </summary>
    [MaxLength(2)]
    public string? CountryCode { get; set; }

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

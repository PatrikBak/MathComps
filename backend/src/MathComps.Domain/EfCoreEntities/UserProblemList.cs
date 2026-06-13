using System.ComponentModel.DataAnnotations;
using NanoidDotNet;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a user-created problem list (e.g., "To Solve", custom lists).
/// </summary>
public class UserProblemList
{
    /// <summary>
    /// Internal primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Short, URL-friendly identifier for external use (e.g., in query params).
    /// </summary>
    [MaxLength(21)]
    public string ContentId { get; set; } = Nanoid.Generate();

    /// <summary>
    /// Foreign key to the user who owns this list.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the owning user.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// Display name of the list (e.g., "To Solve").
    /// </summary>
    [MaxLength(50)]
    public required string Name { get; set; }

    /// <summary>
    /// When true, the list is publicly viewable via its ContentId.
    /// </summary>
    public bool IsShared { get; set; }

    /// <summary>
    /// User-controlled display order for lists.
    /// </summary>
    public required int SortOrder { get; set; }

    /// <summary>
    /// Timestamp when the list was created.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Timestamp when the list was last updated.
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; set; }

    /// <summary>
    /// Problems in this list.
    /// </summary>
    public ICollection<UserProblemListItem> Items { get; set; } = [];
}

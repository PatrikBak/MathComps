using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One email address on an <see cref="Organization"/>'s list. The account carrying it is a member, whenever it
/// signed up, so the address alone makes its owner one.
/// </summary>
public class OrganizationMember
{
    /// <summary>
    /// FK to the organization whose list it is on.
    /// </summary>
    public required Guid OrganizationId { get; set; }

    /// <summary>
    /// Navigation to the organization.
    /// </summary>
    public Organization Organization { get; set; } = null!;

    /// <summary>
    /// The address, lowercased, so an account matches it however its owner capitalized it.
    /// </summary>
    [MaxLength(255)]
    public required string Email { get; set; }

    /// <summary>
    /// When it was put on the list, which is when its owner became a member.
    /// </summary>
    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
}

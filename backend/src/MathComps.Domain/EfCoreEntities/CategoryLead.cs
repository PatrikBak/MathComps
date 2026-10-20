using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One member of an <see cref="Organization"/> made a lead of one of its categories. Only a category's leads
/// place, move and clear the slots of the papers that fill it.
/// </summary>
public class CategoryLead
{
    /// <summary>
    /// FK to the organization, the one whose list the member is on and whose category it is.
    /// </summary>
    public required Guid OrganizationId { get; set; }

    /// <summary>
    /// The member's address, as the organization's list holds it.
    /// </summary>
    [MaxLength(255)]
    public required string Email { get; set; }

    /// <summary>
    /// Navigation to the member.
    /// </summary>
    public OrganizationMember Member { get; set; } = null!;

    /// <summary>
    /// FK to the category, one of the organization's.
    /// </summary>
    public required Guid CategoryId { get; set; }

    /// <summary>
    /// Navigation to the category.
    /// </summary>
    public OrganizationCategory Category { get; set; } = null!;
}

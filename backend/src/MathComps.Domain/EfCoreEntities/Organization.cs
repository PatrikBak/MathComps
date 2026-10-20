using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A group of people picking problems together: its own proposals, its own boards, and the email addresses of its
/// members.
/// </summary>
public class Organization
{
    /// <summary>
    /// The <see cref="Slug"/> of the organization preparing the competitions the site hosts. Its members pick their
    /// problems, and walk into them ahead of everybody else to try them.
    /// </summary>
    public const string MathCompsSlug = "mathcomps";

    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// URL-safe unique slug (lowercase, hyphenated) the organization is named by.
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// Whether its problems need a statement and a solution in every language the site is read in, as a hosted round
    /// does; where false, any one text will do.
    /// </summary>
    public required bool NeedsEveryLanguage { get; set; }

    /// <summary>
    /// The addresses on its list.
    /// </summary>
    public ICollection<OrganizationMember> Members { get; } = [];
}

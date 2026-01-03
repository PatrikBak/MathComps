using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Anchor entity for file-based handouts. Created on-demand when first
/// referenced (e.g., when first comment is posted).
/// </summary>
public class Handout
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Identifier matching the file-based handout.
    /// </summary>
    [MaxLength(30)]
    public required string ContentId { get; set; }

    /// <summary>
    /// Comments on this handout.
    /// </summary>
    public ICollection<HandoutComment> Comments { get; } = [];
}

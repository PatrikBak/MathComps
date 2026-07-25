using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Anchor entity for one environment (a problem, theorem, exercise, example, or definition) within a file-based
/// handout. Created on-demand when first referenced (e.g., when a defense is first opened against it).
/// </summary>
public class HandoutEnvironment
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The handout this environment belongs to.
    /// </summary>
    public required Guid HandoutId { get; set; }

    /// <summary>
    /// Navigation to the handout.
    /// </summary>
    public Handout Handout { get; set; } = null!;

    /// <summary>
    /// Identifier matching the environment's permanent id in the handout source (its <c>\EnvId</c>). Unique per
    /// handout, not site-wide.
    /// </summary>
    [MaxLength(200)]
    public required string ContentId { get; set; }

    /// <summary>
    /// The defenses held against this environment.
    /// </summary>
    public ICollection<HandoutEnvironmentDefense> Defenses { get; } = [];
}

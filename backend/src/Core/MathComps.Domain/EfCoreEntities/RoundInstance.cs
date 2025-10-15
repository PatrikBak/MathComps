namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a specific instance of a round within a particular season.
/// </summary>
public class RoundInstance
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Foreign key to the round definition.
    /// </summary>
    public required Guid RoundId { get; set; }

    /// <summary>
    /// Navigation to the round definition.
    /// </summary>
    public Round Round { get; set; } = null!;

    /// <summary>
    /// Foreign key to the season.
    /// </summary>
    public required Guid SeasonId { get; set; }

    /// <summary>
    /// Navigation to the season.
    /// </summary>
    public Season Season { get; set; } = null!;

    /// <summary>
    /// Problems that belong to this specific round instance.
    /// </summary>
    public ICollection<Problem> Problems { get; } = [];
}

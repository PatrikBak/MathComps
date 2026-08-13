namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One sitting of a <see cref="EfCoreEntities.Competition"/> in one season — the row every problem hangs off.
/// The competition sits at whatever depth it does, so a brand running as one flat event and a round nested
/// three levels below one are the same shape here.
/// </summary>
public class Round
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Foreign key to the competition whose problems these are.
    /// </summary>
    public required Guid CompetitionId { get; set; }

    /// <summary>
    /// Navigation to the competition whose problems these are.
    /// </summary>
    public Competition Competition { get; set; } = null!;

    /// <summary>
    /// Foreign key to the season.
    /// </summary>
    public required Guid SeasonId { get; set; }

    /// <summary>
    /// Navigation to the season.
    /// </summary>
    public Season Season { get; set; } = null!;

    /// <summary>
    /// The date this round ran. May be estimated if the actual date is unknown.
    /// Used for chronological sorting of problems.
    /// </summary>
    public required DateOnly Date { get; set; }

    /// <summary>
    /// Problems that belong to this specific round.
    /// </summary>
    public ICollection<Problem> Problems { get; } = [];
}

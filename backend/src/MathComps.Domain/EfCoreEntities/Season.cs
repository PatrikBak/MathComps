using System.ComponentModel.DataAnnotations.Schema;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Universal, competition-agnostic academic season (e.g., 2024/2025).
/// In the CZ/SK context, a season also carries a shared "ročník" label
/// used to group all competitions that occur within that season.
/// </summary>
public class Season
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Season start year (e.g., 2024 for the 2024/2025 season).
    /// </summary>
    public required int StartYear { get; set; }

    /// <summary>
    /// Numeric edition for easier numeric filtering (e.g., 75).
    /// </summary>
    public required int EditionNumber { get; set; }

    /// <summary>
    /// The CZ/SK ročník base year: a season's <see cref="EditionNumber"/> is its <see cref="StartYear"/> minus this.
    /// The season is competition-agnostic and the edition is unique, so this single base labels every competition's
    /// season — it is not each competition's own edition count.
    /// </summary>
    public const int OlympiadBaseYear = 1950;

    /// <summary>
    /// Converts a season start year to its <see cref="EditionNumber"/> (the shared ročník).
    /// </summary>
    /// <param name="startYear">The season start year (e.g. 2024).</param>
    /// <returns>The edition number (e.g. 74).</returns>
    public static int EditionFromStartYear(int startYear) => startYear - OlympiadBaseYear;

    /// <summary>
    /// Display name of the season (e.g., "2024/2025").
    /// </summary>
    [NotMapped]
    public string Name => $"{StartYear}/{StartYear + 1}";

    /// <summary>
    /// Rounds that occur in this season.
    /// </summary>
    public ICollection<Round> Rounds { get; } = [];
}

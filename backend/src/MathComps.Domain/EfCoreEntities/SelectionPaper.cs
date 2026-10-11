using System.ComponentModel.DataAnnotations;
using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One paper on a <see cref="SelectionBoard"/>: a named, numbered run of slots, one problem each.
/// </summary>
public class SelectionPaper
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// FK to the board holding it.
    /// </summary>
    public required Guid BoardId { get; set; }

    /// <summary>
    /// Navigation to the board.
    /// </summary>
    public SelectionBoard Board { get; set; } = null!;

    /// <summary>
    /// Where the paper stands among its board's papers, from zero.
    /// </summary>
    public required int Position { get; set; }

    /// <summary>
    /// What the paper is called.
    /// </summary>
    [MaxLength(200)]
    public required string Name { get; set; }

    /// <summary>
    /// The category the paper fills, which picks the round it goes into when the board is finalized; null for a
    /// paper outside the categories, which no round can take.
    /// </summary>
    public HostedCompetitionCategory? Category { get; set; }

    /// <summary>
    /// How many problems the paper asks.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int SlotCount { get; set; }

    /// <summary>
    /// Its filled slots, while the board is a draft.
    /// </summary>
    public ICollection<SelectionSlot> Slots { get; } = [];

    /// <summary>
    /// The reviewers' comments on it via the join entity.
    /// </summary>
    public ICollection<SelectionPaperComment> Comments { get; } = [];
}

using System.ComponentModel.DataAnnotations;

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
    /// FK to the category the paper fills, one of its board's organization's.
    /// </summary>
    public required Guid CategoryId { get; set; }

    /// <summary>
    /// Navigation to the category.
    /// </summary>
    public OrganizationCategory Category { get; set; } = null!;

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

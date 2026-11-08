namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One drawing cut out of a <see cref="DefensePhoto"/>.
/// </summary>
public class DefensePhotoCrop
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The photo the drawing was cut out of.
    /// </summary>
    public required Guid PhotoId { get; set; }

    /// <summary>
    /// Navigation to the photo.
    /// </summary>
    public DefensePhoto Photo { get; set; } = null!;

    /// <summary>
    /// What the model named the drawing, such as <c>Figure 1</c>.
    /// </summary>
    public required string Label { get; set; }

    /// <summary>
    /// Where the drawing comes among the photo's drawings, counting from 0 in the order the reading lists them.
    /// </summary>
    public required int Position { get; set; }
}

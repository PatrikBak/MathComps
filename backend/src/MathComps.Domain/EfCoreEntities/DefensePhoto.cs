namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A photo of a handwritten page a student sent in for a defense conversation, kept as the upright, shrunk page the
/// model read. Its file and its crops' files live in private storage under keys built from the ids. It belongs to no
/// message until the student sends one carrying its text, and only whoever may see that message is shown it.
/// </summary>
public class DefensePhoto
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The student who uploaded the photo.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the student.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// The page's text as the model read it, before the student edits it. Null on photos read before readings kept
    /// their text.
    /// </summary>
    public required string? Text { get; set; }

    /// <summary>
    /// When the photo was read.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// The message the photo went out with, null while it hasn't gone out with one.
    /// </summary>
    public Guid? TurnId { get; set; }

    /// <summary>
    /// Navigation to the message.
    /// </summary>
    public DefenseTurn? Turn { get; set; }

    /// <summary>
    /// Where the photo comes among its message's photos, counting from 0 in page order. Null while
    /// <see cref="TurnId"/> is, since a photo no message carries has no place among any.
    /// </summary>
    public int? Position { get; set; }

    /// <summary>
    /// The drawings cut out of the page.
    /// </summary>
    public ICollection<DefensePhotoCrop> Crops { get; set; } = [];
}

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One person owed word of one new message in a grade conversation, until an <see cref="OutgoingMail"/> carries it
/// to them.
/// </summary>
/// <remarks>
/// A recipient's notices wait until none has arrived for a quiet while, with no mail of theirs pending or sent too
/// recently, then one mail claims every one of them, so a burst of messages across several conversations reaches
/// them as a single mail. A recipient left with nothing to hear of by then, or with no account or address left to hear
/// it at, gets no mail, and their notices are deleted.
/// </remarks>
public class GradeMessageNotice
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// FK to the person owed word of the message, on the other side of the conversation from whoever wrote it.
    /// </summary>
    public required Guid RecipientId { get; set; }

    /// <summary>
    /// Navigation to the recipient.
    /// </summary>
    public User Recipient { get; set; } = null!;

    /// <summary>
    /// FK to the message, as its current version: an edit moves the notice onto the version replacing it.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to the message.
    /// </summary>
    public Comment Comment { get; set; } = null!;

    /// <summary>
    /// When the message was written.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// FK to the mail carrying the notice, or null while no mail has claimed it.
    /// </summary>
    public Guid? MailId { get; set; }

    /// <summary>
    /// Navigation to the mail, null alongside <see cref="MailId"/>.
    /// </summary>
    public OutgoingMail? Mail { get; set; }
}

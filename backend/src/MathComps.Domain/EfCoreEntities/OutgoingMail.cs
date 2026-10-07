namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One mail the site sends, written in full when it is queued and kept as the record of it whether it went or was
/// given up on.
/// </summary>
/// <remarks>
/// Every attempt sends the same subject and body under the same id, which the sending provider recognises as one
/// mail for a day, so a retry within that day of an attempt that did go through sends nothing twice.
/// </remarks>
public class OutgoingMail
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The recipient's address.
    /// </summary>
    public required string RecipientAddress { get; set; }

    /// <summary>
    /// The subject line.
    /// </summary>
    public required string Subject { get; set; }

    /// <summary>
    /// The whole HTML document of the body.
    /// </summary>
    public required string Html { get; set; }

    /// <summary>
    /// Where the mail stands.
    /// </summary>
    public required OutgoingMailStatus Status { get; set; }

    /// <summary>
    /// When the mail was queued.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// How many attempts to send it have failed. An attempt the sending quota turned away is not counted, since
    /// it says nothing about the mail.
    /// </summary>
    public required int Attempts { get; set; }

    /// <summary>
    /// When the mail is next tried, set exactly while it is <see cref="OutgoingMailStatus.Pending"/>.
    /// </summary>
    public DateTimeOffset? NextAttemptAt { get; set; }

    /// <summary>
    /// When the mail went, set exactly when it is <see cref="OutgoingMailStatus.Sent"/>.
    /// </summary>
    public DateTimeOffset? SentAt { get; set; }

    /// <summary>
    /// The id the sending provider gave the mail when it went, or null while it has not gone or when no provider gave
    /// one.
    /// </summary>
    public string? ProviderId { get; set; }

    /// <summary>
    /// What the latest attempt that did not go through ran into, a spent quota included, or null while none has. A
    /// mail that goes through afterwards keeps it.
    /// </summary>
    public string? LastError { get; set; }
}

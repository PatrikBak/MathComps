using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// Puts mail in the <see cref="MailOutbox"/>, in the same save as whatever the mail tells of, so neither is ever
/// saved without the other.
/// </summary>
public static class OutgoingMails
{
    /// <summary>
    /// Queues a mail, due at once, to be saved with the rest of a context's changes.
    /// </summary>
    /// <param name="dbContext">The context whose save queues the mail.</param>
    /// <param name="to">The recipient's address.</param>
    /// <param name="mail">The mail.</param>
    /// <param name="now">The instant the mail is queued at.</param>
    /// <returns>The mail as queued, not yet saved.</returns>
    public static OutgoingMail Queue(MathCompsDbContext dbContext, string to, RenderedMail mail, DateTimeOffset now)
    {
        // The mail as written, pending and due at once
        var outgoing = new OutgoingMail
        {
            RecipientAddress = to,
            Subject = mail.Subject,
            Html = mail.Html,
            Status = OutgoingMailStatus.Pending,
            CreatedAt = now,
            Attempts = 0,
            NextAttemptAt = now,
        };

        // Tracked, to be saved with the context's other changes
        dbContext.OutgoingMails.Add(outgoing);

        // The mail as queued
        return outgoing;
    }
}

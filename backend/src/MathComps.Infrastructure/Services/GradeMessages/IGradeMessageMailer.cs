namespace MathComps.Infrastructure.Services.GradeMessages;

/// <summary>
/// Mails people about new messages in their grade conversations. Each recipient gets one mail once a quiet while
/// passes with nothing new for them, never two in quick succession, covering every conversation that changed. What
/// no longer stands when the mail is written falls out of it: a deleted message, one its recipient has written in
/// the conversation after, a conversation its student can no longer see. A recipient left with nothing, or with no
/// account or address left to hear it at, gets no mail.
/// </summary>
public interface IGradeMessageMailer
{
    /// <summary>
    /// Writes a mail for each recipient whose news has gone quiet, with no mail of theirs waiting or sent too
    /// recently, and queues it to go out.
    /// </summary>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task QueueMailsAsync(DateTimeOffset now, CancellationToken cancellationToken);
}

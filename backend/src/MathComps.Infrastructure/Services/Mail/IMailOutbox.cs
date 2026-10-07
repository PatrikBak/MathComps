namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// The mail waiting to go out, sent as it was written. A failed attempt is tried again later until the mail is
/// given up, and a spent sending quota holds every due mail back until it renews.
/// </summary>
public interface IMailOutbox
{
    /// <summary>
    /// Sends the queued mail whose next attempt is due, oldest first.
    /// </summary>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task SendDueAsync(DateTimeOffset now, CancellationToken cancellationToken);
}

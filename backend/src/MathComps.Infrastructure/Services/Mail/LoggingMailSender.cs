using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// An <see cref="IMailSender"/> that writes each mail to the log and sends nothing, for wherever no provider key is
/// configured, so a machine running on a copy of real data mails nobody.
/// </summary>
/// <param name="logger">The logger.</param>
public sealed class LoggingMailSender(ILogger<LoggingMailSender> logger) : IMailSender
{
    /// <inheritdoc/>
    public Task<MailSendResult> SendAsync(
        Guid mailId, string to, RenderedMail mail, CancellationToken cancellationToken)
    {
        // The mail in full, where whoever runs the API can read it
        logger.LogInformation(
            "Mail {MailId} to {To} logged, not sent. Subject: {Subject}{NewLine}{Html}",
            mailId,
            to,
            mail.Subject,
            Environment.NewLine,
            mail.Html);

        // Counted as gone, with nothing to file it under
        return Task.FromResult<MailSendResult>(new MailSent(ProviderId: null));
    }
}

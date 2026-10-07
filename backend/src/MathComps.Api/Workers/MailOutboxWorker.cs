using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Mail;
using Microsoft.Extensions.Options;

namespace MathComps.Api.Workers;

/// <summary>
/// The background loop sending the mail waiting in the <see cref="IMailOutbox"/>, a pass every poll interval of
/// its <see cref="MailOutboxSettings"/>.
/// </summary>
/// <param name="outbox">The outbox each pass sends from.</param>
/// <param name="logger">The logger.</param>
/// <param name="mailOutboxSettings">How often a pass runs.</param>
public sealed class MailOutboxWorker(
    IMailOutbox outbox, ILogger<MailOutboxWorker> logger, IOptions<MailOutboxSettings> mailOutboxSettings)
    : PeriodicWorker(mailOutboxSettings.Value.PollInterval, logger)
{
    /// <inheritdoc/>
    protected override Task RunPassAsync(DateTimeOffset now, CancellationToken cancellationToken) =>
        // Every mail that is due
        outbox.SendDueAsync(now, cancellationToken);
}

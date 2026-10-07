using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.GradeMessages;
using Microsoft.Extensions.Options;

namespace MathComps.Api.Workers;

/// <summary>
/// The background loop writing people's mail about new messages in their grade conversations, a pass of
/// <see cref="IGradeMessageMailer"/> every poll interval of its <see cref="GradeMessageMailSettings"/>.
/// </summary>
/// <param name="mailer">The mailer each pass runs.</param>
/// <param name="logger">The logger.</param>
/// <param name="gradeMessageMailSettings">How often a pass runs.</param>
public sealed class GradeMessageMailWorker(
    IGradeMessageMailer mailer,
    ILogger<GradeMessageMailWorker> logger,
    IOptions<GradeMessageMailSettings> gradeMessageMailSettings)
    : PeriodicWorker(gradeMessageMailSettings.Value.PollInterval, logger)
{
    /// <inheritdoc/>
    protected override Task RunPassAsync(DateTimeOffset now, CancellationToken cancellationToken) =>
        // A mail for everybody whose news has gone quiet
        mailer.QueueMailsAsync(now, cancellationToken);
}

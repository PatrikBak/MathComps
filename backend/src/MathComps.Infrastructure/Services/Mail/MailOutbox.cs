using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// An <see cref="IMailOutbox"/> over EF Core, sending through <see cref="IMailSender"/> under each mail's id. Each
/// attempt runs in a context of its own.
/// </summary>
/// <param name="dbContextFactory">The factory minting a context per operation.</param>
/// <param name="mailSender">The sender each mail is handed to.</param>
/// <param name="logger">The logger.</param>
/// <param name="mailOutboxSettings">How long a failed mail waits between its attempts.</param>
public sealed class MailOutbox(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMailSender mailSender,
    ILogger<MailOutbox> logger,
    IOptions<MailOutboxSettings> mailOutboxSettings) : IMailOutbox
{
    /// <inheritdoc/>
    /// <remarks>
    /// A mail that breaks on the way out counts as a failed attempt, so it backs off like any other and never holds
    /// up the rest. The first mail a spent quota turns away ends the pass, since every mail after it would be turned
    /// away too.
    /// </remarks>
    public async Task SendDueAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        // A fresh context for the lookup
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The pending mails that are due
        var dueMails = dbContext.OutgoingMails
            .Where(mail => mail.Status == OutgoingMailStatus.Pending && mail.NextAttemptAt <= now);

        // The due mails' ids, oldest first
        var mailIds = await dueMails
            .OrderBy(mail => mail.CreatedAt)
            .Select(mail => mail.Id)
            .ToListAsync(cancellationToken);

        // Each due mail in turn
        foreach (var mailId in mailIds)
        {
            // One attempt at the mail
            var result = await AttemptAsync(mailId, now, cancellationToken);

            // Any outcome but one turning away every mail still due moves on to the next mail
            if (!result.TurnsAwayEveryMail)
                continue;

            // The start of the next UTC day, when a daily quota renews
            var nextUtcDay = new DateTimeOffset(now.UtcDateTime.Date.AddDays(1), TimeSpan.Zero);

            // Every mail still due, this one included, asked again at the start of the next UTC day
            await dueMails.ExecuteUpdateAsync(
                setters => setters.SetProperty(mail => mail.NextAttemptAt, nextUtcDay), cancellationToken);

            // Nothing more goes this pass
            return;
        }
    }

    /// <summary>
    /// Makes one attempt at a pending mail, where a mail that breaks on the way out is recorded as a failed attempt
    /// in a context of its own.
    /// </summary>
    /// <param name="mailId">The mail.</param>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>How the attempt went.</returns>
    private async Task<MailSendResult> AttemptAsync(Guid mailId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        try
        {
            // The attempt
            return await SendAsync(mailId, now, cancellationToken);
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
        {
            // The failure, reported with what caused it
            logger.LogError(exception, "Mail {MailId} broke on the way out", mailId);

            // A fresh context for the record
            await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

            // The mail
            var mail = await dbContext.OutgoingMails.SingleAsync(candidate => candidate.Id == mailId, cancellationToken);

            // Counted as a failed attempt
            var failed = new MailFailed(exception.Message);
            Record(mail, failed, now);
            await dbContext.SaveChangesAsync(cancellationToken);

            // How it went
            return failed;
        }
    }

    /// <summary>
    /// Makes one attempt at a pending mail: sends it as it was written, then records how it went.
    /// </summary>
    /// <param name="mailId">The mail.</param>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>How the attempt went.</returns>
    private async Task<MailSendResult> SendAsync(Guid mailId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // A fresh context for this mail
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The mail
        var mail = await dbContext.OutgoingMails.SingleAsync(candidate => candidate.Id == mailId, cancellationToken);

        // Send the mail as it was written
        var result = await mailSender.SendAsync(
            mail.Id, mail.RecipientAddress, new RenderedMail(mail.Subject, mail.Html), cancellationToken);

        // Record how it went
        Record(mail, result, now);
        await dbContext.SaveChangesAsync(cancellationToken);

        // How it went
        return result;
    }

    /// <summary>
    /// Records how an attempt at a mail went: sent, turned away by a spent quota, or failed and either due again
    /// after its retry delay or given up.
    /// </summary>
    /// <param name="mail">The mail, tracked.</param>
    /// <param name="result">How the attempt went.</param>
    /// <param name="now">The instant the pass runs at.</param>
    private void Record(OutgoingMail mail, MailSendResult result, DateTimeOffset now)
    {
        // How long a mail waits after each failed attempt
        var retryDelays = mailOutboxSettings.Value.RetryDelays;

        // Each way an attempt can go
        switch (result)
        {
            // Sent
            case MailSent sent:
                // The mail marked sent
                mail.Status = OutgoingMailStatus.Sent;
                mail.NextAttemptAt = null;
                mail.SentAt = now;
                mail.ProviderId = sent.ProviderId;

                // Log the send
                logger.LogInformation("Sent mail {MailId}", mail.Id);
                break;

            // Turned away by a spent quota, with no failure counted against it
            case MailQuotaExhausted quota:
                // The quota kept as the mail's latest error
                mail.LastError = quota.Reason;

                // Log the refusal
                logger.LogWarning("Mail {MailId} turned away by a spent quota: {Reason}", mail.Id, quota.Reason);
                break;

            // Failed after its last allowed attempt, given up
            case MailFailed failed when mail.Attempts >= retryDelays.Count:
                // One more failure counted, the mail given up with its error
                mail.Attempts += 1;
                mail.Status = OutgoingMailStatus.Failed;
                mail.NextAttemptAt = null;
                mail.LastError = failed.Error;

                // Log giving the mail up
                logger.LogError(
                    "Gave up mail {MailId} after {Attempts} attempts: {Error}", mail.Id, mail.Attempts, failed.Error);
                break;

            // Failed, tried again after the delay its attempt count earns
            case MailFailed failed:
                // Due again after the delay the failures before this one earn
                mail.NextAttemptAt = now + retryDelays[mail.Attempts];

                // This failure counted, with its error
                mail.Attempts += 1;
                mail.LastError = failed.Error;

                // Log the failure and the next attempt
                logger.LogWarning(
                    "Mail {MailId} failed attempt {Attempts}, next at {NextAttemptAt}: {Error}",
                    mail.Id,
                    mail.Attempts,
                    mail.NextAttemptAt,
                    failed.Error);
                break;

            // Unhandled result
            default:
                throw new ArgumentOutOfRangeException(nameof(result), result, "Unknown mail send result");
        }
    }
}

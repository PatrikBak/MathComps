using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Mail;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.GradeMessages;

/// <summary>
/// An <see cref="IGradeMessageMailer"/> over EF Core. Each recipient's mail is written, queued for the
/// <see cref="MailOutbox"/> and made to claim their notices in one save, so a notice arriving meanwhile is left for a
/// later mail. The time since somebody's last mail is read through the notices it claimed.
/// </summary>
/// <param name="dbContextFactory">The factory minting a context per operation.</param>
/// <param name="localization">The names and addresses the taxonomy gives the competitions.</param>
/// <param name="logger">The logger.</param>
/// <param name="siteSettings">Where the mail's links point.</param>
/// <param name="gradeMessageMailSettings">How long somebody's news waits before their mail is written.</param>
public sealed class GradeMessageMailer(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService localization,
    ILogger<GradeMessageMailer> logger,
    IOptions<SiteSettings> siteSettings,
    IOptions<GradeMessageMailSettings> gradeMessageMailSettings) : IGradeMessageMailer
{
    /// <inheritdoc/>
    /// <remarks>
    /// A mail that breaks while being written holds up nobody else's. Everybody else gets theirs, then the pass fails,
    /// reporting what broke, and the broken mail's notices wait for the next pass.
    /// </remarks>
    public async Task QueueMailsAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        // The newest a notice may be and still have gone quiet
        var cutoff = now - gradeMessageMailSettings.Value.QuietPeriod;

        // Everybody whose news has gone quiet, with no mail of theirs waiting or sent too recently
        var recipientIds = await ReadQuietRecipientsAsync(cutoff, now, cancellationToken);

        // What broke while writing somebody's mail
        var failures = new List<Exception>();

        // Each recipient's mail
        foreach (var recipientId in recipientIds)
        {
            try
            {
                // The recipient's mail, written and queued, unless it has nothing to say or nowhere to go
                await QueueMailAsync(recipientId, cutoff, now, cancellationToken);
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                // The failure, kept until everybody else has their mail
                failures.Add(exception);
            }
        }

        // Every failure reported at once
        if (failures.Count > 0)
            throw new AggregateException(failures);
    }

    /// <summary>
    /// Reads the recipients whose newest unclaimed notice is a quiet while old, with no mail to them waiting to go or
    /// sent too recently.
    /// </summary>
    /// <param name="cutoff">The newest a notice may be and still have gone quiet.</param>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Each such recipient once.</returns>
    private async Task<IReadOnlyList<Guid>> ReadQuietRecipientsAsync(
        DateTimeOffset cutoff, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // A fresh context for the lookup
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The latest a mail to somebody may have gone and still let their next one go
        var lastMailCutoff = now - gradeMessageMailSettings.Value.MinimumGap;

        // Every notice, claimed or not
        var notices = dbContext.GradeMessageNotices;

        // The recipients with unclaimed notices, none newer than the cutoff, where no notice of theirs was claimed by
        // a mail still waiting to go or sent too recently
        return await notices
            .Where(notice => notice.MailId == null)
            .GroupBy(notice => notice.RecipientId)
            .Where(unclaimed => unclaimed.Max(notice => notice.CreatedAt) <= cutoff)
            .Select(unclaimed => unclaimed.Key)
            .Where(recipientId => !notices.Any(notice =>
                notice.RecipientId == recipientId
                && (notice.Mail!.Status == OutgoingMailStatus.Pending || notice.Mail.SentAt > lastMailCutoff)))
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Writes one recipient's mail from their notices that have gone quiet and queues it, the notices claimed by it,
    /// all in one save. A recipient with nothing left to hear of, or with no account or no address left to hear it
    /// at, gets no mail, and their notices are deleted.
    /// </summary>
    /// <param name="recipientId">Who the mail goes to.</param>
    /// <param name="cutoff">The newest a notice may be and still have gone quiet.</param>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private async Task QueueMailAsync(
        Guid recipientId, DateTimeOffset cutoff, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // A fresh context for this recipient
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Who the mail goes to
        var recipient = await dbContext.Users
            .Where(user => user.Id == recipientId)
            .Select(user => new { user.Email, user.CountryCode, user.Username, user.IsDeleted })
            .SingleAsync(cancellationToken);

        // The language the recipient is written to in
        var language = Language.OfCountry(recipient.CountryCode);

        // The recipient's unclaimed notices up to the cutoff
        var notices = await dbContext.GradeMessageNotices
            .Where(notice => notice.RecipientId == recipientId && notice.MailId == null && notice.CreatedAt <= cutoff)
            .ToListAsync(cancellationToken);

        // What is still new for the recipient, where a deleted account has nothing coming
        var threads = recipient.IsDeleted
            ? []
            : await ReadThreadsAsync(
                dbContext, [.. notices.Select(notice => notice.Id)], recipientId, language, now, cancellationToken);

        // Nothing left to say, or nowhere to say it, spends the notices with no mail
        if (threads.Count == 0 || recipient.Email is not { Length: > 0 } email)
        {
            // The notices gone
            dbContext.GradeMessageNotices.RemoveRange(notices);
            await dbContext.SaveChangesAsync(cancellationToken);

            // Log that nothing went
            logger.LogInformation(
                "Nothing to mail user {RecipientId} of {NoticeCount} notices", recipientId, notices.Count);

            // No mail
            return;
        }

        // The mail as the recipient reads it
        var rendered = GradeMessageMail.Render(
            siteSettings.Value.Url, now.Year, new GradeMessageMailContent(language, recipient.Username, threads));

        // The mail, queued
        var mail = OutgoingMails.Queue(dbContext, email, rendered, now);

        // Each of the recipient's notices up to the cutoff, claimed by the mail
        foreach (var notice in notices)
            notice.Mail = mail;

        // The mail and its claim, saved together
        await dbContext.SaveChangesAsync(cancellationToken);

        // Log the mail with whom it is for
        logger.LogInformation("Queued mail {MailId} to user {RecipientId}", mail.Id, recipientId);
    }

    /// <summary>
    /// Reads what is still new for a recipient, by conversation, oldest news first. A message the notices point at
    /// counts while it stands and the recipient has written nothing in its conversation since, and a conversation
    /// counts while its student can see it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="noticeIds">The notices to read the news of.</param>
    /// <param name="recipientId">Who the news is for.</param>
    /// <param name="language">The language the recipient is written to in.</param>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Each conversation with something new in it.</returns>
    private async Task<IReadOnlyList<GradeThreadNews>> ReadThreadsAsync(
        MathCompsDbContext dbContext,
        IReadOnlyList<Guid> noticeIds,
        Guid recipientId,
        Language language,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        // Every message of every grade conversation
        var links = dbContext.HostedGradeComments;

        // The notices' messages that still stand, each with the conversation it was written in, where the recipient
        // has written nothing there since, writing there counting as having seen it
        var messages = await dbContext.GradeMessageNotices
            .Where(notice => noticeIds.Contains(notice.Id) && notice.Comment.Status == CommentStatus.Active)
            .Join(links, notice => notice.CommentId, link => link.CommentId, (notice, link) => new { notice, link })
            .Where(noticed => !links.Any(answer => answer.EntryId == noticed.link.EntryId
                && answer.ProblemId == noticed.link.ProblemId
                && answer.Comment.AuthorId == recipientId
                && answer.Comment.CreatedAt > noticed.notice.CreatedAt))
            .Select(noticed => new NoticedMessage(
                noticed.notice.CreatedAt,
                noticed.link.EntryId,
                noticed.link.ProblemId,
                noticed.link.Entry.UserId,
                noticed.link.Entry.User.IsDeleted ? null : noticed.link.Entry.User.Username,
                noticed.link.Problem.Number,
                noticed.link.Entry.Round.HostedGroup!.Slug,
                noticed.link.Entry.Round.Competition.Path,
                noticed.link.Entry.Round.Competition.Parent!.Path,
                noticed.link.Entry.Round.Season.StartYear))
            .ToListAsync(cancellationToken);

        // The messages by conversation, the one with the oldest news first
        var conversations = messages
            .GroupBy(message => (message.EntryId, message.ProblemId))
            .OrderBy(conversation => conversation.Min(message => message.CreatedAt))
            .Select(conversation => conversation.ToList())
            .ToList();

        // The conversations still out to their student, each as the mail tells it
        return await conversations
            .ToAsyncEnumerable()
            .Where(async (conversation, token) =>
                await HostedGrading.IsOutToStudentAsync(
                    dbContext, conversation[0].EntryId, conversation[0].ProblemId, now, token))
            .Select(conversation => ToNews(conversation, recipientId, language))
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Tells what is new in one conversation, with the link into it from the recipient's side.
    /// </summary>
    /// <param name="messages">The conversation's new messages, at least one.</param>
    /// <param name="recipientId">Who the mail goes to.</param>
    /// <param name="language">The language the recipient is written to in.</param>
    /// <returns>The conversation's news.</returns>
    private GradeThreadNews ToNews(IReadOnlyList<NoticedMessage> messages, Guid recipientId, Language language)
    {
        // Where the conversation sits, which every one of its messages shares
        var conversation = messages[0];

        // The site's addresses in the recipient's language
        var links = new SiteLinks(siteSettings.Value.Url, language);

        // The link from the recipient's side: the student's competition page, or a grader's board
        var link = recipientId == conversation.StudentId
            ? links.StudentThread(
                HostedRoundSlug.Build(
                    localization.GetNodeUrlSlugs(conversation.CompetitionPath)[language],
                    conversation.SeasonStartYear),
                conversation.ProblemId)
            : links.GraderThread(
                conversation.GroupSlug,
                HostedTaxonomy.CategoryOf(conversation.CompetitionPath)
                    ?? throw new InvalidOperationException(
                        $"Competition {conversation.CompetitionPath} runs at no level, so no board grades it."),
                conversation.StudentId,
                conversation.ProblemId);

        // The news, naming the student to a grader
        return new GradeThreadNews(
            CompetitionName: localization.GetNodeShortName(language, conversation.CompetitionPath),
            CategoryName: localization.GetNodeShortName(language, conversation.CategoryPath),
            SeasonStartYear: conversation.SeasonStartYear,
            ProblemNumber: conversation.ProblemNumber,
            Student: recipientId == conversation.StudentId ? null : new GradeThreadStudent(conversation.StudentName),
            MessageCount: messages.Count,
            Link: link);
    }

    /// <summary>
    /// One message a notice points at, with where its conversation sits.
    /// </summary>
    /// <param name="CreatedAt"><inheritdoc cref="GradeMessageNotice.CreatedAt" path="/summary"/></param>
    /// <param name="EntryId"><inheritdoc cref="HostedGradeComment.EntryId" path="/summary"/></param>
    /// <param name="ProblemId"><inheritdoc cref="HostedGradeComment.ProblemId" path="/summary"/></param>
    /// <param name="StudentId">The student the conversation is with.</param>
    /// <param name="StudentName">The student's <see cref="User.Username"/>, or null for a deleted account.</param>
    /// <param name="ProblemNumber"><inheritdoc cref="Problem.Number" path="/summary"/></param>
    /// <param name="GroupSlug">What addresses the group the student entered.</param>
    /// <param name="CompetitionPath">The path of the competition the student's round ran under.</param>
    /// <param name="CategoryPath">The path of the level the student's round ran at.</param>
    /// <param name="SeasonStartYear"><inheritdoc cref="Season.StartYear" path="/summary"/></param>
    private sealed record NoticedMessage(
        DateTimeOffset CreatedAt,
        Guid EntryId,
        Guid ProblemId,
        Guid StudentId,
        string? StudentName,
        int ProblemNumber,
        string GroupSlug,
        string CompetitionPath,
        string CategoryPath,
        int SeasonStartYear);
}

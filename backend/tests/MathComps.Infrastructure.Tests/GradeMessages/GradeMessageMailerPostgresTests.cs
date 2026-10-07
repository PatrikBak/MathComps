using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.GradeMessages;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Mail;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;
using static MathComps.Infrastructure.Tests.TestInfrastructure.HostedSeed;

namespace MathComps.Infrastructure.Tests.GradeMessages;

/// <summary>
/// Integration tests for <see cref="IGradeMessageMailer"/> against a real PostgreSQL database, with the
/// <see cref="IMailOutbox"/> behind it and a fake sender in place of the provider: that a recipient's mail waits for
/// ten quiet minutes and then covers every conversation that changed, that a recipient hears at most once an hour
/// however long a mail waits to go, and never waits on a mail given up, that each side's mail links in from its own
/// side in its own language, that what no longer stands or what its recipient wrote after falls out of the mail, a
/// recipient with nothing left getting none, and that a mail breaking while being written holds up nobody else's.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class GradeMessageMailerPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IGradeMessageMailer>(fixture)
{
    /// <summary>
    /// The site address the mail's links start with.
    /// </summary>
    private const string SiteUrl = "https://mathcomps.test";

    /// <summary>
    /// When the students' clocks started, days before the group closed.
    /// </summary>
    private static readonly DateTimeOffset _startedAt = new(2026, 9, 15, 10, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// When most tests write their first message, long after the group closed.
    /// </summary>
    private static readonly DateTimeOffset _writtenAt = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// The grader, who competes from Slovakia.
    /// </summary>
    private readonly Guid _graderId = Guid.CreateVersion7();

    /// <summary>
    /// The student, who competes from Czechia.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// Another student, who sat the same round.
    /// </summary>
    private readonly Guid _classmateId = Guid.CreateVersion7();

    /// <summary>
    /// The round's first problem.
    /// </summary>
    private readonly Guid _firstProblemId = Guid.CreateVersion7();

    /// <summary>
    /// The round's second problem.
    /// </summary>
    private readonly Guid _secondProblemId = Guid.CreateVersion7();

    /// <summary>
    /// The student's entry.
    /// </summary>
    private readonly Guid _studentEntryId = Guid.CreateVersion7();

    /// <summary>
    /// The classmate's entry.
    /// </summary>
    private readonly Guid _classmateEntryId = Guid.CreateVersion7();

    /// <summary>
    /// The sender standing in for the provider.
    /// </summary>
    private readonly FakeMailSender _sender = new();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The fake sender, registered first so the mail module keeps it
        services.AddSingleton<IMailSender>(_sender);

        // The test site, the outbox and the grade message mail, and no provider key
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Site:Url"] = SiteUrl,
                ["Site:ContactAddress"] = "contact@mathcomps.test",
                ["MailOutbox:PollInterval"] = "00:01:00",
                ["MailOutbox:RetryDelays:0"] = "00:01:00",
                ["GradeMessageMail:PollInterval"] = "00:01:00",
                ["GradeMessageMail:QuietPeriod"] = "00:10:00",
                ["GradeMessageMail:MinimumGap"] = "01:00:00",
            })
            .Build();

        // The site, the mail module over it, and the grade message mail over both
        services
            .AddSiteSettings(configuration)
            .AddMail(configuration, Mock.Of<IHostEnvironment>(environment => environment.EnvironmentName == "Test"))
            .AddGradeMessageMail(configuration);
    }

    /// <summary>
    /// A recipient's mail goes once ten minutes pass with nothing new for them, measured from their newest message,
    /// and covers every conversation that changed with how many new messages each holds.
    /// </summary>
    [Fact]
    public Task A_recipient_gets_one_mail_once_ten_quiet_minutes_pass() => RunTestAsync(async mailer =>
    {
        // Two messages to the student about the first problem and one about the second, the last three minutes in
        await QueryAsync(async context =>
        {
            // The grader's message about the first problem, owed to the student
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt), _studentId);

            // A second message about the first problem, a minute later
            Notice(
                context,
                NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt.AddMinutes(1)),
                _studentId);

            // A message about the second problem, three minutes in
            Notice(
                context,
                NewMessage(context, _studentEntryId, _secondProblemId, _graderId, _writtenAt.AddMinutes(3)),
                _studentId);

            // Save the messages and their notices
            await context.SaveChangesAsync();
        });

        // A pass a second short of ten quiet minutes after the newest message
        await PassAsync(mailer, _writtenAt.AddMinutes(13).AddSeconds(-1));

        // Nothing has gone
        Assert.Empty(_sender.Sent);

        // A pass at ten quiet minutes
        await PassAsync(mailer, _writtenAt.AddMinutes(13));

        // One mail, to the student, about both problems with their counts
        var sent = Assert.Single(_sender.Sent);
        Assert.Equal("student@example.com", sent.To);
        Assert.Contains($"feedback={_firstProblemId}", sent.Mail.Html);
        Assert.Contains($">{Messages(Language.CS, 2)}<", sent.Mail.Html);
        Assert.Contains($"feedback={_secondProblemId}", sent.Mail.Html);
        Assert.Contains($">{Messages(Language.CS, 1)}<", sent.Mail.Html);

        // The mail recorded as sent, with every notice claimed by it
        var mail = await QueryValueAsync(context => context.OutgoingMails.AsNoTracking().SingleAsync());
        Assert.Equal(OutgoingMailStatus.Sent, mail.Status);
        Assert.Equal(sent.MailId, mail.Id);
        Assert.True(await QueryValueAsync(context =>
            context.GradeMessageNotices.AllAsync(notice => notice.MailId == mail.Id)));

        // A pass later on
        await PassAsync(mailer, _writtenAt.AddHours(1));

        // Still only the one mail
        Assert.Single(_sender.Sent);
    });

    /// <summary>
    /// A recipient hears at most once an hour: a message arriving soon after their mail waits, however quiet it has
    /// gone, until an hour after that mail, and then comes in the next one, alone.
    /// </summary>
    [Fact]
    public Task A_recipient_hears_at_most_once_an_hour() => RunTestAsync(async mailer =>
    {
        // A message to the student
        await QueryAsync(async context =>
        {
            // The grader's message, owed to the student
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt), _studentId);

            // Save the message and its notice
            await context.SaveChangesAsync();
        });

        // The student's mail, ten quiet minutes on
        await PassAsync(mailer, _writtenAt.AddMinutes(10));

        // Another message five minutes after the mail
        await QueryAsync(async context =>
        {
            // The grader's next message, owed to the student
            Notice(
                context,
                NewMessage(context, _studentEntryId, _secondProblemId, _graderId, _writtenAt.AddMinutes(15)),
                _studentId);

            // Save the message and its notice
            await context.SaveChangesAsync();
        });

        // A pass a second short of an hour after the first mail, long after the second message went quiet
        await PassAsync(mailer, _writtenAt.AddMinutes(70).AddSeconds(-1));

        // Only the first mail has gone
        Assert.Single(_sender.Sent);

        // A pass an hour after the first mail
        await PassAsync(mailer, _writtenAt.AddMinutes(70));

        // The second mail, about the second message and not again about the first
        Assert.Equal(2, _sender.Sent.Count);
        Assert.Contains($"feedback={_secondProblemId}", _sender.Sent[1].Mail.Html);
        Assert.DoesNotContain($"feedback={_firstProblemId}", _sender.Sent[1].Mail.Html);
    });

    /// <summary>
    /// A mail still waiting to go holds back its recipient's next one however long it waits, and the hour between
    /// mails counts from when it went, so a spent quota never stacks up mails to one person for the next day.
    /// </summary>
    [Fact]
    public Task A_waiting_mail_holds_back_the_next_until_an_hour_after_it_goes() => RunTestAsync(async mailer =>
    {
        // A message to the student
        await QueryAsync(async context =>
        {
            // The grader's message, owed to the student
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt), _studentId);

            // Save the message and its notice
            await context.SaveChangesAsync();
        });

        // The quota is spent
        _sender.Next = () => new MailQuotaExhausted("daily_quota_exceeded");

        // The student's mail, turned away ten quiet minutes on and put off to midnight UTC
        await PassAsync(mailer, _writtenAt.AddMinutes(10));

        // Another message to the student, twenty minutes after that mail
        await QueryAsync(async context =>
        {
            // The grader's next message, owed to the student
            Notice(
                context,
                NewMessage(context, _studentEntryId, _secondProblemId, _graderId, _writtenAt.AddMinutes(30)),
                _studentId);

            // Save the message and its notice
            await context.SaveChangesAsync();
        });

        // A pass hours later, long after the second message went quiet
        await PassAsync(mailer, _writtenAt.AddHours(5));

        // Still the one mail, waiting
        Assert.Equal(1, await QueryValueAsync(context => context.OutgoingMails.CountAsync()));

        // The quota renews
        _sender.Next = () => new MailSent("provider-id");

        // Midnight UTC on the next day
        var midnight = new DateTimeOffset(2026, 10, 2, 0, 0, 0, TimeSpan.Zero);

        // A pass at midnight UTC, when the first mail goes
        await PassAsync(mailer, midnight);

        // A pass a second short of an hour after the first mail went
        await PassAsync(mailer, midnight.AddHours(1).AddSeconds(-1));

        // Still the one mail, now sent
        Assert.Equal(1, await QueryValueAsync(context => context.OutgoingMails.CountAsync()));

        // A pass an hour after the first mail went
        await PassAsync(mailer, midnight.AddHours(1));

        // The second mail, about the second message alone
        Assert.Equal(2, await QueryValueAsync(context => context.OutgoingMails.CountAsync()));
        Assert.Contains($"feedback={_secondProblemId}", _sender.Sent[^1].Mail.Html);
        Assert.DoesNotContain($"feedback={_firstProblemId}", _sender.Sent[^1].Mail.Html);
    });

    /// <summary>
    /// A mail given up on holds up no later mail: its recipient never got it, so the hour between mails does not
    /// count from it.
    /// </summary>
    [Fact]
    public Task A_mail_given_up_on_holds_up_no_later_mail() => RunTestAsync(async mailer =>
    {
        // A message to the student
        await QueryAsync(async context =>
        {
            // The grader's message, owed to the student
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt), _studentId);

            // Save the message and its notice
            await context.SaveChangesAsync();
        });

        // Every attempt fails
        _sender.Next = () => new MailFailed("503: unavailable");

        // The student's mail, failing ten quiet minutes on
        await PassAsync(mailer, _writtenAt.AddMinutes(10));

        // The mail's retry a minute later, failing again, which gives it up
        await PassAsync(mailer, _writtenAt.AddMinutes(11));

        // Attempts go through again
        _sender.Next = () => new MailSent("provider-id");

        // Another message five minutes after the mail was given up
        await QueryAsync(async context =>
        {
            // The grader's next message, owed to the student
            Notice(
                context,
                NewMessage(context, _studentEntryId, _secondProblemId, _graderId, _writtenAt.AddMinutes(16)),
                _studentId);

            // Save the message and its notice
            await context.SaveChangesAsync();
        });

        // A pass once the second message has gone quiet, well inside an hour of the mail given up
        await PassAsync(mailer, _writtenAt.AddMinutes(26));

        // The second message's mail went after the two failed attempts, with no wait after the one given up
        Assert.Equal(3, _sender.Sent.Count);
        Assert.Contains($"feedback={_secondProblemId}", _sender.Sent[^1].Mail.Html);
    });

    /// <summary>
    /// Each side's mail links into the conversation from its own side, in its own language: the Czech student into
    /// their competition's page under its Czech address, the year in it the season's, the Slovak grader into the
    /// grading board at the student. Only the grader's mail names who wrote: the student.
    /// </summary>
    [Fact]
    public Task Each_side_links_in_from_its_own_side_in_its_own_language() => RunTestAsync(async mailer =>
    {
        // A day in the new year, months into the season that started in the autumn before
        var writtenAt = new DateTimeOffset(2027, 1, 15, 9, 0, 0, TimeSpan.Zero);

        // A grader's message to the student about one problem, and the student's to the grader about the other
        await QueryAsync(async context =>
        {
            // The grader's message, owed to the student
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _graderId, writtenAt), _studentId);

            // The student's message, owed to the grader
            Notice(
                context,
                NewMessage(context, _studentEntryId, _secondProblemId, _studentId, writtenAt.AddMinutes(1)),
                _graderId);

            // Save the messages and their notices
            await context.SaveChangesAsync();
        });

        // A pass once both sides have gone quiet
        await PassAsync(mailer, writtenAt.AddMinutes(20));

        // What addresses the competition in Czech, under the year its season started
        var czechSlug = string.Empty;
        await QueryAsync<IMetadataLocalizationService>((_, localization) =>
        {
            // The Czech node slug with the season's year
            czechSlug = HostedRoundSlug.Build(
                localization.GetNodeUrlSlugs("mathcomps-advanced-september")[Language.CS], 2026);

            // Nothing more to read
            return Task.CompletedTask;
        });

        // The student's mail, opening the conversation on their competition's Czech page
        var studentMail = Assert.Single(_sender.Sent, sent => sent.To == "student@example.com");
        Assert.Contains(
            AsInHtml(new SiteLinks(SiteUrl, Language.CS).StudentThread(czechSlug, _firstProblemId)),
            studentMail.Mail.Html);

        // The grader's message counted, its writer unnamed
        Assert.Contains($">{Messages(Language.CS, 1)}<", studentMail.Mail.Html);

        // The grader's mail, opening the student's grade on the Slovak board
        var graderMail = Assert.Single(_sender.Sent, sent => sent.To == "grader@example.com");
        Assert.Contains(
            AsInHtml(new SiteLinks(SiteUrl, Language.SK).GraderThread(
                "mc-graded", HostedCompetitionCategory.Advanced, _studentId, _secondProblemId)),
            graderMail.Mail.Html);

        // The student's message counted under the student's name
        Assert.Contains($">{MessagesFrom(Language.SK, "Student", 1)}<", graderMail.Mail.Html);
    });

    /// <summary>
    /// A grader's mail keeps each student's conversation about one problem apart: a row per student, named and
    /// opening that student's grade.
    /// </summary>
    [Fact]
    public Task A_graders_mail_keeps_each_students_conversation_apart() => RunTestAsync(async mailer =>
    {
        // Both students write to the grader about the first problem
        await QueryAsync(async context =>
        {
            // The student's message, owed to the grader
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _studentId, _writtenAt), _graderId);

            // The classmate's message, owed to the grader too
            Notice(
                context, NewMessage(context, _classmateEntryId, _firstProblemId, _classmateId, _writtenAt), _graderId);

            // Save the messages and their notices
            await context.SaveChangesAsync();
        });

        // A pass once both students have gone quiet
        await PassAsync(mailer, _writtenAt.AddMinutes(10));

        // The grader's mail
        var html = Assert.Single(_sender.Sent).Mail.Html;

        // The site's addresses in Slovak, the grader's language
        var links = new SiteLinks(SiteUrl, Language.SK);

        // The student's row, named and opening the student's grade
        Assert.Contains($">{MessagesFrom(Language.SK, "Student", 1)}<", html);
        Assert.Contains(
            AsInHtml(links.GraderThread(
                "mc-graded", HostedCompetitionCategory.Advanced, _studentId, _firstProblemId)),
            html);

        // The classmate's row, named and opening the classmate's grade
        Assert.Contains($">{MessagesFrom(Language.SK, "Classmate", 1)}<", html);
        Assert.Contains(
            AsInHtml(links.GraderThread(
                "mc-graded", HostedCompetitionCategory.Advanced, _classmateId, _firstProblemId)),
            html);
    });

    /// <summary>
    /// What no longer stands by the time the mail is written falls out of it: a deleted message, and a conversation
    /// whose grade was taken back to a draft, so its student can no longer see it.
    /// </summary>
    [Fact]
    public Task What_no_longer_stands_falls_out_of_the_mail() => RunTestAsync(async mailer =>
    {
        // Two messages about the first problem, one since deleted, and one about the second
        await QueryAsync(async context =>
        {
            // The message that stands
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt), _studentId);

            // The message since deleted
            Notice(
                context,
                NewMessage(
                    context, _studentEntryId, _firstProblemId, _graderId, _writtenAt, CommentStatus.Deleted),
                _studentId);

            // The message about the second problem
            Notice(context, NewMessage(context, _studentEntryId, _secondProblemId, _graderId, _writtenAt), _studentId);

            // The second problem's grade taken back to a draft
            context.HostedGrades.Add(NewGrade(
                _studentEntryId, _secondProblemId, _graderId, mark: 4, help: 0, isFinal: false,
                _writtenAt.AddMinutes(2)));

            // Save the messages, their notices and the draft grade
            await context.SaveChangesAsync();
        });

        // A pass once the student's news has gone quiet
        await PassAsync(mailer, _writtenAt.AddMinutes(20));

        // One message about the first problem, nothing about the second
        var sent = Assert.Single(_sender.Sent);
        Assert.Contains($"feedback={_firstProblemId}", sent.Mail.Html);
        Assert.Contains($">{Messages(Language.CS, 1)}<", sent.Mail.Html);
        Assert.DoesNotContain($"feedback={_secondProblemId}", sent.Mail.Html);
    });

    /// <summary>
    /// A message its recipient wrote after in the same conversation falls out of their mail, writing there counting as
    /// having seen it, and a mail left with nothing goes nowhere. Writing in another student's conversation
    /// about the same problem takes nothing out.
    /// </summary>
    [Fact]
    public Task A_message_its_recipient_wrote_after_falls_out_of_their_mail() => RunTestAsync(async mailer =>
    {
        // The student asks, the classmate asks about the same problem, the grader answers the student, and the
        // student asks again
        await QueryAsync(async context =>
        {
            // The student's question, owed to the grader
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _studentId, _writtenAt), _graderId);

            // The classmate's question in their own conversation, owed to the grader too
            Notice(
                context,
                NewMessage(context, _classmateEntryId, _firstProblemId, _classmateId, _writtenAt.AddMinutes(1)),
                _graderId);

            // The grader's answer, owed to the student
            Notice(
                context,
                NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt.AddMinutes(2)),
                _studentId);

            // The student's next question, owed to the grader
            Notice(
                context,
                NewMessage(context, _studentEntryId, _firstProblemId, _studentId, _writtenAt.AddMinutes(4)),
                _graderId);

            // Save the messages and their notices
            await context.SaveChangesAsync();
        });

        // A pass once both sides have gone quiet
        await PassAsync(mailer, _writtenAt.AddMinutes(20));

        // One mail, to the grader, about the student's question still unanswered and the classmate's; the student
        // wrote after the answer
        var sent = Assert.Single(_sender.Sent);
        Assert.Equal("grader@example.com", sent.To);
        Assert.Contains($">{MessagesFrom(Language.SK, "Student", 1)}<", sent.Mail.Html);
        Assert.Contains($">{MessagesFrom(Language.SK, "Classmate", 1)}<", sent.Mail.Html);
    });

    /// <summary>
    /// A recipient with nothing left to hear of gets no mail, nor does an account deleted meanwhile, though the
    /// messages to it still stand. Their notices are deleted, so no later pass looks at them again.
    /// </summary>
    [Fact]
    public Task Nothing_to_say_or_nobody_to_say_it_to_queues_no_mail() => RunTestAsync(async mailer =>
    {
        // A deleted message to the student, and a standing one to the classmate, whose account is then deleted
        await QueryAsync(async context =>
        {
            // The grader's message to the student, since deleted
            Notice(
                context,
                NewMessage(
                    context, _studentEntryId, _firstProblemId, _graderId, _writtenAt, CommentStatus.Deleted),
                _studentId);

            // The grader's message to the classmate, standing
            Notice(
                context, NewMessage(context, _classmateEntryId, _firstProblemId, _graderId, _writtenAt), _classmateId);

            // The classmate's account, deleted with its address kept
            (await context.Users.SingleAsync(user => user.Id == _classmateId)).IsDeleted = true;

            // Save the messages, their notices and the deleted account
            await context.SaveChangesAsync();
        });

        // A pass once both messages have gone quiet
        await PassAsync(mailer, _writtenAt.AddMinutes(20));

        // Nothing went, nothing was queued, and no notice is left
        Assert.Empty(_sender.Sent);
        Assert.False(await QueryValueAsync(context => context.OutgoingMails.AnyAsync()));
        Assert.False(await QueryValueAsync(context => context.GradeMessageNotices.AnyAsync()));
    });

    /// <summary>
    /// A mail that breaks while being written holds up nobody else's: the student still gets theirs, the pass then
    /// fails, and the grader's notice waits for the next pass. The grader's mail breaks because
    /// its conversation sits in a round run at no level, which no grading board could link to.
    /// </summary>
    [Fact]
    public Task A_mail_that_breaks_while_being_written_holds_up_nobody_else() => RunTestAsync(async mailer =>
    {
        // A message to the student, and one to the grader about a round run at no level
        await QueryAsync(async context =>
        {
            // The grader's message, owed to the student
            Notice(context, NewMessage(context, _studentEntryId, _firstProblemId, _graderId, _writtenAt), _studentId);

            // The seeded season and group
            var season = await context.Seasons.SingleAsync(candidate => candidate.EditionNumber == 76);
            var group = await context.HostedGroups.SingleAsync(candidate => candidate.Slug == "mc-graded");

            // A round at no level in the seeded season and group, with one problem
            var roundId = Guid.CreateVersion7();
            var problemId = Guid.CreateVersion7();
            NewRound(context, season, group, roundId, "mathcomps-september", problemId);

            // The classmate's entry into the round at no level
            var entry = NewEntry(_classmateId, roundId, _startedAt);
            context.HostedEntries.Add(entry);

            // The entry's final grade
            context.HostedGrades.Add(
                NewGrade(entry.Id, problemId, _graderId, mark: 3, help: 0, isFinal: true, _startedAt.AddDays(6)));

            // The classmate's message about the problem in the round at no level, owed to the grader
            Notice(context, NewMessage(context, entry.Id, problemId, _classmateId, _writtenAt), _graderId);

            // Save the round, its entry and grade, and both messages with their notices
            await context.SaveChangesAsync();
        });

        // A pass of the mailer once both messages have gone quiet
        var failure = await Record.ExceptionAsync(() =>
            mailer.QueueMailsAsync(_writtenAt.AddMinutes(10), CancellationToken.None));

        // The pass failed, once everybody else had their mail
        Assert.IsType<AggregateException>(failure);

        // The one mail queued, the student's
        var mail = await QueryValueAsync(context => context.OutgoingMails.AsNoTracking().SingleAsync());
        Assert.Equal("student@example.com", mail.RecipientAddress);

        // The grader's notice still unclaimed, for the next pass
        Assert.Null(await QueryValueAsync(context =>
            context.GradeMessageNotices.Where(notice => notice.RecipientId == _graderId)
                .Select(notice => notice.MailId)
                .SingleAsync()));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The grader, the student and the classmate
        var grader = NewUser(_graderId, "Grader");
        var student = NewUser(_studentId, "Student");
        var classmate = NewUser(_classmateId, "Classmate");
        context.Users.AddRange(grader, student, classmate);

        // The grader competes from Slovakia, both students from Czechia
        grader.CountryCode = "SK";
        student.CountryCode = "CZ";
        classmate.CountryCode = "CZ";

        // The one season the round sits in
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the site's own competitions hang off
        CompetitionTreeSeed.Root(context, "mathcomps", 100);

        // The group, closed long before any message
        var group = NewGroup(context, "mc-graded", _startedAt.AddDays(-5), _startedAt.AddDays(5));

        // The group's round with both problems
        var roundId = Guid.CreateVersion7();
        NewRound(context, season, group, roundId, "mathcomps-advanced-september", _firstProblemId, _secondProblemId);

        // Both students' entries, under the ids the tests address them by
        var studentEntry = NewEntry(_studentId, roundId, _startedAt);
        var classmateEntry = NewEntry(_classmateId, roundId, _startedAt);
        studentEntry.Id = _studentEntryId;
        classmateEntry.Id = _classmateEntryId;

        // Both students sat the round
        context.HostedEntries.AddRange(studentEntry, classmateEntry);

        // When the grades were given, a day after the group closed
        var gradedAt = _startedAt.AddDays(6);

        // Every grade final
        context.HostedGrades.AddRange(
            NewGrade(_studentEntryId, _firstProblemId, _graderId, mark: 2, help: 0, isFinal: true, gradedAt),
            NewGrade(_studentEntryId, _secondProblemId, _graderId, mark: 5, help: 0, isFinal: true, gradedAt),
            NewGrade(_classmateEntryId, _firstProblemId, _graderId, mark: 7, help: 0, isFinal: true, gradedAt));

        // Save seeded data
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Runs one pass of the mailer, then one of the outbox, both at the same instant.
    /// </summary>
    /// <param name="mailer">The mailer under test.</param>
    /// <param name="now">The instant both passes run at.</param>
    /// <returns>A task representing both passes.</returns>
    private async Task PassAsync(IGradeMessageMailer mailer, DateTimeOffset now)
    {
        // A mail for everybody whose news has gone quiet, written and queued
        await mailer.QueueMailsAsync(now, CancellationToken.None);

        // Every queued mail that is due, sent
        await QueryAsync<IMailOutbox>((_, outbox) => outbox.SendDueAsync(now, CancellationToken.None));
    }

    /// <summary>
    /// Writes how many new messages a conversation holds, the way a mail in the language counts them.
    /// </summary>
    /// <param name="language">The mail's language.</param>
    /// <param name="count">How many new messages.</param>
    /// <returns>The count in words.</returns>
    private static string Messages(Language language, int count) =>
        // The count in the language's plural form
        new LocalizedCopy(language, "gradeMessageMail").Format("messages", new { count });

    /// <summary>
    /// Writes how many new messages a student wrote, the way a grader's mail in the language counts them.
    /// </summary>
    /// <param name="language">The mail's language.</param>
    /// <param name="student">The student's username.</param>
    /// <param name="count">How many new messages.</param>
    /// <returns>The count in words, by the student.</returns>
    private static string MessagesFrom(Language language, string student, int count) =>
        // The count beside the student's name
        new LocalizedCopy(language, "gradeMessageMail")
            .Format("messagesFrom", new { student, messages = Messages(language, count) });

    /// <summary>
    /// Writes a link the way it stands in an HTML attribute, its ampersands escaped.
    /// </summary>
    /// <param name="link">The link.</param>
    /// <returns>The link as the HTML carries it.</returns>
    private static string AsInHtml(string link) =>
        // The one character of a link HTML gives a meaning to
        link.Replace("&", "&amp;");

    /// <summary>
    /// Tracks a notice: one person owed word of a message.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="message">The message.</param>
    /// <param name="recipientId"><inheritdoc cref="GradeMessageNotice.RecipientId" path="/summary"/></param>
    private static void Notice(MathCompsDbContext context, Comment message, Guid recipientId) =>
        // The notice, unclaimed, written when the message was
        context.GradeMessageNotices.Add(new GradeMessageNotice
        {
            RecipientId = recipientId,
            CommentId = message.Id,
            CreatedAt = message.CreatedAt,
        });
}

using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Mail;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;

namespace MathComps.Infrastructure.Tests.Mail;

/// <summary>
/// Integration tests for <see cref="IMailOutbox"/> against a real PostgreSQL database, with a fake sender in place
/// of the provider: how a failed mail is retried and given up, how a spent quota holds every due mail back to the
/// next UTC day, and that a mail breaking on the way out holds up no other.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class MailOutboxPostgresTests(PostgresContainerFixture fixture) : PostgresTestBase<IMailOutbox>(fixture)
{
    /// <summary>
    /// When the mails in the tests are queued.
    /// </summary>
    private static readonly DateTimeOffset _queuedAt = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// The sender standing in for the provider.
    /// </summary>
    private readonly FakeMailSender _sender = new();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The fake sender, registered first so the module keeps it
        services.AddSingleton<IMailSender>(_sender);

        // The outbox's poll interval and retry schedule, and no provider key
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MailOutbox:PollInterval"] = "00:01:00",
                ["MailOutbox:RetryDelays:0"] = "00:01:00",
                ["MailOutbox:RetryDelays:1"] = "00:05:00",
                ["MailOutbox:RetryDelays:2"] = "00:30:00",
                ["MailOutbox:RetryDelays:3"] = "02:00:00",
                ["MailOutbox:RetryDelays:4"] = "12:00:00",
            })
            .Build();

        // The mail module
        services.AddMail(configuration, Mock.Of<IHostEnvironment>(environment => environment.EnvironmentName == "Test"));
    }

    /// <summary>
    /// A mail that fails is tried again after one minute, then five, thirty, two hours and twelve hours, and the
    /// sixth failure gives it up. A pass before the next attempt is due leaves it alone.
    /// </summary>
    [Fact]
    public Task A_failed_mail_is_retried_with_growing_delays_and_given_up() => RunTestAsync(async outbox =>
    {
        // One mail to the student
        await QueueAsync("student@example.com");

        // Every attempt fails
        _sender.Next = () => new MailFailed("503: unavailable");

        // When the latest attempt ran, the first as soon as the mail is queued
        var attemptAt = _queuedAt;

        // The first attempt
        await outbox.SendDueAsync(attemptAt, CancellationToken.None);

        // The delay each failure earned
        var delays = new List<TimeSpan>();

        // Each retry the schedule allows, made the moment the mail is due
        for (var attempt = 0; attempt < 5; attempt += 1)
        {
            // When the mail is next due, which a pending mail always has
            var nextAttemptAt = await QueryValueAsync(context =>
                context.OutgoingMails.Select(mail => mail.NextAttemptAt!.Value).SingleAsync());

            // The delay since the attempt that failed
            delays.Add(nextAttemptAt - attemptAt);

            // A pass a second before the mail is due changes nothing
            await outbox.SendDueAsync(nextAttemptAt.AddSeconds(-1), CancellationToken.None);

            // The latest attempt moves to the moment the mail is due
            attemptAt = nextAttemptAt;

            // The pass at the moment the mail is due tries it again
            await outbox.SendDueAsync(attemptAt, CancellationToken.None);
        }

        // The delays, growing
        Assert.Equal(
            [
                TimeSpan.FromMinutes(1),
                TimeSpan.FromMinutes(5),
                TimeSpan.FromMinutes(30),
                TimeSpan.FromHours(2),
                TimeSpan.FromHours(12),
            ],
            delays);

        // Six attempts in all
        Assert.Equal(6, _sender.Sent.Count);

        // The mail as stored
        var mail = await QueryValueAsync(context => context.OutgoingMails.AsNoTracking().SingleAsync());

        // The mail given up after its sixth failure
        Assert.Equal(OutgoingMailStatus.Failed, mail.Status);
        Assert.Equal(6, mail.Attempts);
    });

    /// <summary>
    /// A spent sending quota puts every mail still due off to the start of the next UTC day without counting it as a
    /// failure, the ones behind the refused mail untried.
    /// </summary>
    [Fact]
    public Task A_spent_quota_puts_every_due_mail_off_to_the_next_utc_day() => RunTestAsync(async outbox =>
    {
        // A mail to the student and one to the classmate
        await QueueAsync("student@example.com");
        await QueueAsync("classmate@example.com");

        // The quota is spent
        _sender.Next = () => new MailQuotaExhausted("daily_quota_exceeded");

        // A pass late in the day
        await outbox.SendDueAsync(new DateTimeOffset(2026, 10, 1, 22, 30, 0, TimeSpan.Zero), CancellationToken.None);

        // Only one of the two mails was tried
        Assert.Single(_sender.Sent);

        // Every mail as stored
        var mails = await QueryValueAsync(context => context.OutgoingMails.AsNoTracking().ToListAsync());

        // Just the two queued
        Assert.Equal(2, mails.Count);

        // Both mails wait for midnight UTC, still pending, with no failure counted
        Assert.All(mails, mail =>
        {
            // Pending until midnight UTC
            Assert.Equal(OutgoingMailStatus.Pending, mail.Status);
            Assert.Equal(new DateTimeOffset(2026, 10, 2, 0, 0, 0, TimeSpan.Zero), mail.NextAttemptAt);

            // With no failure counted
            Assert.Equal(0, mail.Attempts);
        });
    });

    /// <summary>
    /// A mail that breaks on the way out counts as a failed attempt, and the mails behind it still go.
    /// </summary>
    [Fact]
    public Task A_mail_that_breaks_never_holds_up_the_rest() => RunTestAsync(async outbox =>
    {
        // A mail to the student and one to the classmate
        await QueueAsync("student@example.com");
        await QueueAsync("classmate@example.com");

        // The first mail breaks, the rest go
        _sender.Next = () => _sender.Sent.Count == 1
            ? throw new InvalidOperationException("broke")
            : new MailSent("provider-id");

        // Ten minutes after the mails were queued
        var now = _queuedAt.AddMinutes(10);

        // A pass over the outbox
        await outbox.SendDueAsync(now, CancellationToken.None);

        // Both mails were tried
        Assert.Equal(2, _sender.Sent.Count);

        // Every mail as stored
        var mails = await QueryValueAsync(context => context.OutgoingMails.AsNoTracking().ToListAsync());

        // The mail that broke, the first the sender was handed
        var broken = Assert.Single(mails, mail => mail.Id == _sender.Sent[0].MailId);

        // Counted a failed attempt, and due again in a minute
        Assert.Equal(OutgoingMailStatus.Pending, broken.Status);
        Assert.Equal(1, broken.Attempts);
        Assert.Equal(now.AddMinutes(1), broken.NextAttemptAt);

        // The other mail went
        Assert.Equal(OutgoingMailStatus.Sent, Assert.Single(mails, mail => mail.Id != broken.Id).Status);
    });

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // The outbox needs nothing but the mails each test queues
        Task.CompletedTask;

    /// <summary>
    /// Queues one mail, saved at once.
    /// </summary>
    /// <param name="to"><inheritdoc cref="OutgoingMails.Queue" path="/param[@name='to']"/></param>
    /// <returns>A task representing the queueing.</returns>
    private Task QueueAsync(string to) => QueryAsync(async context =>
    {
        // The mail, queued when every test queues
        OutgoingMails.Queue(context, to, new RenderedMail("New comments on the marking", "<p>Hi,</p>"), _queuedAt);

        // Save the mail
        await context.SaveChangesAsync();
    });
}

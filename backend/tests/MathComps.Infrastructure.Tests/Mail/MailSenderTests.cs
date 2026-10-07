using System.Net;
using System.Text;
using System.Text.Json;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;

namespace MathComps.Infrastructure.Tests.Mail;

/// <summary>
/// Unit tests for the sender the mail module registers: that without a Resend key nothing leaves the machine, that
/// outside production a key needs a redirect beside it, that with a key each mail goes to Resend signed with it,
/// saying who calls and keyed by the mail's id, that a redirect takes every mail away from its recipient, and how
/// Resend's answers are read.
/// </summary>
public class MailSenderTests
{
    /// <summary>
    /// The mail sent wherever a test sends one.
    /// </summary>
    private static readonly RenderedMail _mail = new("New comments on the marking", "<p>Hi,</p>");

    /// <summary>
    /// The id <see cref="_mail"/> is sent under.
    /// </summary>
    private static readonly Guid _mailId = Guid.Parse("01994f6e-0000-7000-8000-00000000000a");

    /// <summary>
    /// Without a Resend key the module registers the sender that only logs, and outside production asks for no
    /// redirect. An empty key is no key, which is what the compose file passes wherever RESEND_API_KEY is unset.
    /// </summary>
    /// <param name="resendApiKey">The key configured: none, or empty.</param>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Without_a_key_mail_only_goes_to_the_log(string? resendApiKey)
    {
        // A development machine with no key, or an empty one
        using var provider = BuildProvider(
            resendApiKey, new AnsweringHandler(HttpStatusCode.OK, "{}"), Environments.Development);

        // The sender the mail module registered
        var sender = provider.GetRequiredService<IMailSender>();

        // The sender that only logs
        Assert.IsType<LoggingMailSender>(sender);
    }

    /// <summary>
    /// With a key, a mail goes to Resend's send endpoint from the site's address, signed with the key, saying who
    /// calls and keyed by the mail's id. The id Resend files it under comes back.
    /// </summary>
    [Fact]
    public async Task With_a_key_mail_goes_to_resend()
    {
        // Resend accepting the mail
        var handler = new AnsweringHandler(HttpStatusCode.OK, /*lang=json,strict*/ """{"id":"resend-id"}""");

        // A production machine with a key
        await using var provider = BuildProvider("re_test", handler);

        // Send the mail
        var result = await provider.GetRequiredService<IMailSender>()
            .SendAsync(_mailId, "student@example.com", _mail, CancellationToken.None);

        // Sent, under Resend's id
        Assert.Equal(new MailSent("resend-id"), result);

        // The only request Resend got
        var request = Assert.Single(handler.Requests);

        // To the send endpoint, signed with the key, saying who calls and keyed by the mail's id
        Assert.Equal(new Uri("https://api.resend.com/emails"), request.Uri);
        Assert.Equal("Bearer re_test", request.Authorization);
        Assert.Equal("MathComps", request.UserAgent);
        Assert.Equal(_mailId.ToString(), request.IdempotencyKey);

        // The body Resend got
        using var body = JsonDocument.Parse(request.Body);

        // Carrying the mail from the site's address
        Assert.Equal("MathComps <contact@mathcomps.test>", body.RootElement.GetProperty("from").GetString());
        Assert.Equal("student@example.com", body.RootElement.GetProperty("to")[0].GetString());
        Assert.Equal(_mail.Subject, body.RootElement.GetProperty("subject").GetString());
        Assert.Equal(_mail.Html, body.RootElement.GetProperty("html").GetString());
    }

    /// <summary>
    /// A refusal over a spent daily or monthly quota is read as the quota running out, while Resend's per-second
    /// rate limit is a failure worth another attempt.
    /// </summary>
    /// <param name="body">The body Resend answers with.</param>
    /// <param name="isQuota">Whether the answer means the quota is spent.</param>
    [Theory]
    [InlineData(/*lang=json,strict*/ """{"statusCode":429,"name":"daily_quota_exceeded","message":"m"}""", true)]
    [InlineData(/*lang=json,strict*/ """{"statusCode":429,"name":"monthly_quota_exceeded","message":"m"}""", true)]
    [InlineData(/*lang=json,strict*/ """{"statusCode":429,"name":"rate_limit_exceeded","message":"m"}""", false)]
    public async Task A_refusal_reads_as_a_spent_quota_or_a_failure(string body, bool isQuota)
    {
        // Resend refusing the mail as too many
        await using var provider = BuildProvider(
            "re_test", new AnsweringHandler(HttpStatusCode.TooManyRequests, body));

        // Send the mail
        var result = await provider.GetRequiredService<IMailSender>()
            .SendAsync(_mailId, "student@example.com", _mail, CancellationToken.None);

        // A spent quota or a failure, as the answer says
        Assert.IsType(isQuota ? typeof(MailQuotaExhausted) : typeof(MailFailed), result);
    }

    /// <summary>
    /// With a redirect set, every mail goes to it and never to its recipient.
    /// </summary>
    [Fact]
    public async Task A_redirect_takes_every_mail_away_from_its_recipient()
    {
        // Resend accepting the mail
        var handler = new AnsweringHandler(HttpStatusCode.OK, /*lang=json,strict*/ """{"id":"resend-id"}""");

        // A development machine redirecting every mail
        await using var provider = BuildProvider(
            "re_test", handler, Environments.Development, "delivered@resend.dev");

        // Send the student's mail
        await provider.GetRequiredService<IMailSender>()
            .SendAsync(_mailId, "student@example.com", _mail, CancellationToken.None);

        // The body of the only request Resend got
        using var body = JsonDocument.Parse(Assert.Single(handler.Requests).Body);

        // Sent to the redirect alone
        var to = Assert.Single(body.RootElement.GetProperty("to").EnumerateArray());
        Assert.Equal("delivered@resend.dev", to.GetString());
    }

    /// <summary>
    /// Outside production the module refuses a key with no redirect beside it, and with a redirect it registers the
    /// sender that goes through Resend.
    /// </summary>
    [Fact]
    public void Outside_production_a_key_needs_a_redirect()
    {
        // What the mail module throws on a development machine with a key and nowhere to redirect
        var withoutRedirect = Record.Exception(() =>
            BuildProvider("re_test", new AnsweringHandler(HttpStatusCode.OK, "{}"), Environments.Development));

        // Refused
        Assert.IsType<InvalidOperationException>(withoutRedirect);

        // A development machine with a key, redirecting every mail
        using var provider = BuildProvider(
            "re_test", new AnsweringHandler(HttpStatusCode.OK, "{}"), Environments.Development, "delivered@resend.dev");

        // Sends through Resend
        Assert.IsType<ResendMailSender>(provider.GetRequiredService<IMailSender>());
    }

    /// <summary>
    /// Builds a provider holding the mail module, with Resend's transport replaced by a handler.
    /// </summary>
    /// <param name="resendApiKey">The Resend key configured, or null for none.</param>
    /// <param name="handler">The handler standing in for Resend.</param>
    /// <param name="environmentName">The environment the module is registered in.</param>
    /// <param name="redirectTo"><inheritdoc cref="MailSettings.RedirectTo" path="/summary"/></param>
    /// <returns>The provider, which the caller disposes.</returns>
    private static ServiceProvider BuildProvider(
        string? resendApiKey,
        AnsweringHandler handler,
        string environmentName = "Production",
        string? redirectTo = null)
    {
        // The test site, with or without a key and a redirect
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Site:Url"] = "https://mathcomps.test",
                ["Site:ContactAddress"] = "contact@mathcomps.test",
                ["Mail:ResendApiKey"] = resendApiKey,
                ["Mail:RedirectTo"] = redirectTo,
            })
            .Build();

        // The environment the module is registered in
        var environment = Mock.Of<IHostEnvironment>(candidate => candidate.EnvironmentName == environmentName);

        // The mail module over the site
        var services = new ServiceCollection()
            .AddLogging()
            .AddSiteSettings(configuration)
            .AddMail(configuration, environment);

        // Resend's transport swapped for the handler
        services.AddHttpClient(ResendMailSender.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => handler);

        // The provider
        return services.BuildServiceProvider();
    }

    /// <summary>
    /// One request as it reached the stand-in for Resend.
    /// </summary>
    /// <param name="Uri">Where it was sent.</param>
    /// <param name="Authorization">Its authorization header.</param>
    /// <param name="UserAgent">Who it said was calling.</param>
    /// <param name="IdempotencyKey">The key Resend deduplicates it on.</param>
    /// <param name="Body">Its body.</param>
    private sealed record CapturedRequest(
        Uri? Uri, string? Authorization, string UserAgent, string? IdempotencyKey, string Body);

    /// <summary>
    /// A handler standing in for Resend: it keeps every request it was handed and answers each with the same status
    /// and body.
    /// </summary>
    /// <param name="status">The status to answer with.</param>
    /// <param name="body">The body to answer with.</param>
    private sealed class AnsweringHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        /// <summary>
        /// Every request handed over, in order.
        /// </summary>
        public List<CapturedRequest> Requests { get; } = [];

        /// <inheritdoc/>
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            // Keep the request as it arrived
            Requests.Add(new CapturedRequest(
                request.RequestUri,
                request.Headers.Authorization?.ToString(),
                request.Headers.UserAgent.ToString(),
                request.Headers.TryGetValues("Idempotency-Key", out var keys) ? keys.Single() : null,
                request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken)));

            // Answer with the canned status and body
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8) };
        }
    }
}

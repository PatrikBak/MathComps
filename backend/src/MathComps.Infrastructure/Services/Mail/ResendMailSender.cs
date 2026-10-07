using System.Net;
using System.Net.Mime;
using System.Text;
using System.Text.Json;
using MathComps.Infrastructure.Options;
using MathComps.Shared.Serialization;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// An <see cref="IMailSender"/> posting to Resend's email API through the named <see cref="HttpClientName"/>
/// client, which carries the base address, the API key and who is calling. The mail id rides as Resend's
/// idempotency key, which Resend honours for a day. Where <see cref="MailSettings.RedirectTo"/> is set, every mail
/// goes there in place of its recipient.
/// </summary>
/// <param name="httpClientFactory">Mints the named client per send.</param>
/// <param name="siteSettings">The address every mail comes from.</param>
/// <param name="mailSettings">Where every mail goes in place of its recipient, if anywhere.</param>
public sealed class ResendMailSender(
    IHttpClientFactory httpClientFactory, IOptions<SiteSettings> siteSettings, IOptions<MailSettings> mailSettings)
    : IMailSender
{
    /// <summary>
    /// The name the Resend client is registered under.
    /// </summary>
    public const string HttpClientName = "Resend";

    /// <summary>
    /// The error names Resend gives a request refused because a sending quota is spent: the daily one, renewed at
    /// midnight UTC, or the monthly one, renewed with the billing cycle.
    /// </summary>
    private static readonly HashSet<string> _quotaErrors = ["daily_quota_exceeded", "monthly_quota_exceeded"];

    /// <inheritdoc/>
    public async Task<MailSendResult> SendAsync(
        Guid mailId, string to, RenderedMail mail, CancellationToken cancellationToken)
    {
        // Who the mail comes from, under the site's name
        var from = $"MathComps <{siteSettings.Value.ContactAddress}>";

        // Who the mail goes to: the recipient, or wherever every mail is redirected
        var recipient = mailSettings.Value.RedirectTo ?? to;

        // A send to Resend's email endpoint
        using var request = new HttpRequestMessage(HttpMethod.Post, "emails");

        // The mail as Resend reads it
        request.Content = new StringContent(
            new ResendEmail(from, [recipient], mail.Subject, mail.Html).ToJson(writeIndented: false),
            Encoding.UTF8,
            MediaTypeNames.Application.Json);

        // The mail's id, so Resend sends a retried request only once
        request.Headers.Add("Idempotency-Key", mailId.ToString());

        try
        {
            // Send the request
            using var response = await httpClientFactory.CreateClient(HttpClientName)
                .SendAsync(request, cancellationToken);

            // What Resend answered
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            // Accepted, with the id Resend filed it under
            if (response.IsSuccessStatusCode)
                return new MailSent(body.FromJson<ResendAccepted>().Id);

            // A spent quota, which no retry before it renews gets past
            if (response.StatusCode == HttpStatusCode.TooManyRequests && ReadErrorName(body) is { } name
                && _quotaErrors.Contains(name))
                return new MailQuotaExhausted(name);

            // Any other refusal, a failed attempt
            return new MailFailed($"{(int)response.StatusCode}: {body}");
        }
        catch (HttpRequestException exception)
        {
            // The connection failing, in its own words
            return new MailFailed(exception.Message);
        }
        catch (TaskCanceledException exception) when (exception.InnerException is TimeoutException)
        {
            // No answer within the client's timeout
            return new MailFailed(exception.Message);
        }
    }

    /// <summary>
    /// Reads the error name off a Resend error body.
    /// </summary>
    /// <param name="body">The body of a refused request.</param>
    /// <returns>The name, or null when the body is not a Resend error.</returns>
    private static string? ReadErrorName(string body)
    {
        try
        {
            // The name Resend files the error under
            return body.FromJson<ResendError>().Name;
        }
        catch (JsonException)
        {
            // A body that is no JSON at all, say a proxy's error page
            return null;
        }
    }

    /// <summary>
    /// The body Resend's send endpoint takes.
    /// </summary>
    /// <param name="From">Who the mail comes from.</param>
    /// <param name="To">Who the mail goes to.</param>
    /// <param name="Subject">The subject line.</param>
    /// <param name="Html">The HTML body, which Resend also derives the plain-text part from.</param>
    private sealed record ResendEmail(string From, IReadOnlyList<string> To, string Subject, string Html);

    /// <summary>
    /// What Resend answers an accepted mail with.
    /// </summary>
    /// <param name="Id">The id Resend filed the mail under.</param>
    private sealed record ResendAccepted(string Id);

    /// <summary>
    /// What Resend answers a refused request with.
    /// </summary>
    /// <param name="Name">The machine-readable name of the error.</param>
    private sealed record ResendError(string? Name);
}

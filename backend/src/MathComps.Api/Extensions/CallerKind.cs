using System.Text.RegularExpressions;

namespace MathComps.Api.Extensions;

/// <summary>
/// Who sent the request an error happened in, read off its User-Agent, so an error a visitor met can be told apart
/// from one a script or a crawler caused.
/// </summary>
internal static class CallerKind
{
    /// <summary>
    /// A visitor's browser.
    /// </summary>
    private const string Browser = "browser";

    /// <summary>
    /// The website's own server, fetching for a page it renders.
    /// </summary>
    private const string Website = "website";

    /// <summary>
    /// A service delivering a webhook, such as Clerk's account events.
    /// </summary>
    private const string Webhook = "webhook";

    /// <summary>
    /// A search engine or another crawler announcing itself.
    /// </summary>
    private const string Crawler = "crawler";

    /// <summary>
    /// A command-line tool, a script or an automated browser.
    /// </summary>
    private const string Script = "script";

    /// <summary>
    /// The API's own work outside any request.
    /// </summary>
    public const string Background = "background";

    /// <summary>
    /// The User-Agent of the website's server, which fetches with Node's built-in client.
    /// </summary>
    private const string WebsiteUserAgent = "node";

    /// <summary>
    /// Matches the User-Agent of a crawler, every major one naming itself a bot, a crawler or a spider.
    /// </summary>
    private static readonly Regex _crawlerPattern =
        new("bot|crawler|spider", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Matches the User-Agent of a browser a script drives, which otherwise reads like a visitor's.
    /// </summary>
    private static readonly Regex _automatedBrowserPattern = new("HeadlessChrome|Playwright", RegexOptions.Compiled);

    /// <summary>
    /// Reads who sent a request from its User-Agent.
    /// </summary>
    /// <remarks>
    /// Every browser opens its User-Agent with <c>Mozilla/</c>, so anything else is a tool, curl and the HTTP clients
    /// of every language among them.
    /// </remarks>
    /// <param name="userAgent">The request's User-Agent, empty when it sent none.</param>
    /// <returns>One of the kinds this class names, never <see cref="Background"/>.</returns>
    public static string Of(string userAgent) =>
        userAgent switch
        {
            // The website's server, named by its exact agent
            WebsiteUserAgent => Website,

            // Svix, which delivers Clerk's webhooks
            _ when userAgent.StartsWith("Svix-Webhooks/", StringComparison.Ordinal) => Webhook,

            // A crawler, which may also present itself as a browser
            _ when _crawlerPattern.IsMatch(userAgent) => Crawler,

            // A browser a script drives
            _ when _automatedBrowserPattern.IsMatch(userAgent) => Script,

            // A visitor's browser
            _ when userAgent.StartsWith("Mozilla/", StringComparison.Ordinal) => Browser,

            // Anything else, an empty agent included
            _ => Script,
        };
}

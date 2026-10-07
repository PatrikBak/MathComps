using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Whether the API's mail leaves the machine at all, and to whom.
/// </summary>
public class MailSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "Mail";

    /// <summary>
    /// The Resend API key mail goes out through, or null where mail only goes to the log.
    /// </summary>
    public string? ResendApiKey { get; set; }

    /// <summary>
    /// The one address every mail goes to in place of its recipient, or null where each goes to its own. It lets a
    /// machine outside production send through Resend for real without reaching anybody in its data, say to
    /// <c>delivered@resend.dev</c> or a test inbox.
    /// </summary>
    [EmailAddress]
    public string? RedirectTo { get; set; }
}

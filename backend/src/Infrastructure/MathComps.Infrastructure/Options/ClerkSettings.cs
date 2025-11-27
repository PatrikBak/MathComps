namespace MathComps.Infrastructure.Options;

/// <summary>
/// Configuration settings for Clerk integration.
/// </summary>
public class ClerkSettings
{
    /// <summary>
    /// The configuration section name for Clerk settings.
    /// </summary>
    public const string SectionName = "Clerk";

    /// <summary>
    /// The secret key used to verify Clerk webhooks.
    /// </summary>
    public string WebhookSecret { get; set; } = string.Empty;
}

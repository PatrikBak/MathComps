using MathComps.Domain.Localization;
namespace MathComps.Infrastructure.Options;

/// <summary>
/// Options for localization configured via appsettings.json.
/// </summary>
public class LocalizationOptions
{
    /// <summary>
    /// The name of the configuration section for localization options.
    /// </summary>
    public const string ConfigurationSectionName = "Localization";

    /// <summary>
    /// The default locale (language) to use when Accept-Language header is missing
    /// or contains an unsupported language.
    /// </summary>
    public required Language DefaultLocale { get; init; }
}

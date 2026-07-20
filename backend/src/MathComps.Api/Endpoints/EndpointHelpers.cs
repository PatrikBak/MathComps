using System.Globalization;
using MathComps.Domain.Localization;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Shared helpers for the minimal-API endpoint groups.
/// </summary>
internal static class EndpointHelpers
{
    /// <summary>
    /// Gets the request language from the current thread culture.
    /// The RequestLocalization middleware sets CurrentCulture based on Accept-Language header.
    /// </summary>
    /// <returns>The Language enum value for the current request.</returns>
    /// <exception cref="InvalidOperationException">Thrown when culture cannot be parsed to Language enum.</exception>
    public static Language GetRequestLanguage()
        => Enum.TryParse<Language>(
                CultureInfo.CurrentCulture.TwoLetterISOLanguageName,
                ignoreCase: true,
                out var language)
            ? language
            : throw new InvalidOperationException($"Unsupported culture '{CultureInfo.CurrentCulture.TwoLetterISOLanguageName}'");
}

using System.Globalization;
using System.Net.Http.Headers;
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

    /// <summary>
    /// Reads the credential a request sends in its <c>Authorization</c> header under one scheme.
    /// </summary>
    /// <param name="request">The request carrying the header.</param>
    /// <param name="scheme">The scheme the credential is sent under.</param>
    /// <returns>The credential.</returns>
    /// <exception cref="BadHttpRequestException">
    /// Thrown when the header is missing, unreadable, under another scheme, or carries no credential.
    /// </exception>
    public static string GetAuthorizationCredential(HttpRequest request, string scheme)
        // The credential sent under the scheme, a request without one refused as unreadable
        => AuthenticationHeaderValue.TryParse(request.Headers.Authorization.ToString(), out var header)
            && string.Equals(header.Scheme, scheme, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(header.Parameter)
                ? header.Parameter
                : throw new BadHttpRequestException($"The request must carry its credential under {scheme}.");
}

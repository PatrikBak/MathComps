using System.Globalization;
using MathComps.Infrastructure.Services.Users;
using MathComps.Domain.Localization;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Shared helpers for the minimal-API endpoint groups — resolving the current user and request language.
/// </summary>
internal static class EndpointHelpers
{
    /// <summary>
    /// Extracts the internal user ID from the HTTP context if a user is authenticated.
    /// </summary>
    /// <param name="context">The HTTP context containing user claims.</param>
    /// <param name="userManager">User manager for resolving external to internal user IDs.</param>
    /// <returns>The internal user ID if authenticated, otherwise null.</returns>
    public static async Task<Guid?> GetUserIdAsync(HttpContext context, IUserManager userManager)
    {
        // Extract Clerk user ID from JWT claims
        var userExternalId = context.User.FindFirst("sub")?.Value;

        // If we have a user, get their internal ID
        return !string.IsNullOrEmpty(userExternalId)
            ? await userManager.GetUserIdAsync(userExternalId)
            : null;
    }

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

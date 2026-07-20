using MathComps.Api.Constants;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Resolves the current request's internal user from an <see cref="IUserManager"/>, bridging the caller's subject
/// claim on the HTTP context to the internal user id.
/// </summary>
internal static class UserManagerExtensions
{
    /// <summary>
    /// Resolves the internal user id for a request that requires one, throwing
    /// <see cref="UserNotResolvedException"/> when the caller can't be resolved to a user.
    /// </summary>
    /// <param name="userManager">Resolves an external provider id to the internal user id.</param>
    /// <param name="context">The HTTP context carrying the caller's claims.</param>
    /// <returns>The internal user id of the current caller.</returns>
    public static async Task<Guid> RequireUserIdAsync(this IUserManager userManager, HttpContext context)
    {
        // Resolve the caller, faulting when there's no user behind the request
        return await userManager.GetUserIdAsync(context)
            ?? throw new UserNotResolvedException();
    }

    /// <summary>
    /// Resolves the internal user id for the current request, or null when the request carries no resolvable user.
    /// </summary>
    /// <param name="userManager">Resolves an external provider id to the internal user id.</param>
    /// <param name="context">The HTTP context carrying the caller's claims.</param>
    /// <returns>The internal user id, or null when the request is anonymous or unresolvable.</returns>
    public static async Task<Guid?> GetUserIdAsync(this IUserManager userManager, HttpContext context)
    {
        // The subject claim identifying the caller, if the request carries one
        var userExternalId = context.User.FindFirst(ClerkClaims.Subject)?.Value;

        // Resolve it to an internal id, treating a missing claim as no user
        return !string.IsNullOrEmpty(userExternalId)
            ? await userManager.GetUserIdAsync(userExternalId)
            : null;
    }
}

/// <summary>
/// Thrown when an authenticated request reaches a handler that needs a user but the caller
/// can't be resolved to one.
/// </summary>
public sealed class UserNotResolvedException() : Exception("The authenticated caller could not be resolved to a user");

using System.Security.Claims;
using MathComps.Api.Constants;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension members reading who a request's caller is off the claims of their Clerk-issued token.
/// </summary>
internal static class ClaimsPrincipalExtensions
{
    extension(ClaimsPrincipal user)
    {
        /// <summary>
        /// The caller's Clerk user id, or null when the request carries no subject claim.
        /// </summary>
        public string? ClerkId => user.FindFirst(ClerkClaims.Subject)?.Value;
    }
}

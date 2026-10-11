using System.Security.Claims;
using MathComps.Api.Constants;

namespace MathComps.Api.Tests;

/// <summary>
/// Builds the callers the tests send, shaped the way the API reads a Clerk session token.
/// </summary>
internal static class TestCallers
{
    /// <summary>
    /// Builds a caller signed in under a subject.
    /// </summary>
    /// <param name="subject">The subject the caller signs in under.</param>
    /// <param name="isAdmin">Whether the caller carries the admin role.</param>
    /// <returns>The caller.</returns>
    public static ClaimsPrincipal SignedIn(string subject, bool isAdmin) =>
        // Signed in under the subject, with the admin role where the caller has it
        new(new ClaimsIdentity(
            [
                new Claim(ClerkClaims.Subject, subject),
                .. isAdmin ? [new Claim(ClerkClaims.RoleClaimType, ClerkClaims.AdminRole)] : Array.Empty<Claim>(),
            ],
            authenticationType: "test",
            nameType: ClerkClaims.Subject,
            roleType: ClerkClaims.RoleClaimType));
}

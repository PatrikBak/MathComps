namespace MathComps.Api.Constants;

/// <summary>
/// Names and values of the Clerk-issued JWT claims the API reads.
/// </summary>
public static class ClerkClaims
{
    /// <summary>
    /// The claim holding Clerk's external user id.
    /// </summary>
    public const string Subject = "sub";

    /// <summary>
    /// The flat claim holding the user's Role, shaped in Clerk from <c>public_metadata.role</c>.
    /// </summary>
    public const string RoleClaimType = "role";

    /// <summary>
    /// The Role value granting administrative access.
    /// </summary>
    public const string AdminRole = "admin";
}

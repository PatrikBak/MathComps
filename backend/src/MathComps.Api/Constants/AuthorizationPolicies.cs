using MathComps.Domain.EfCoreEntities;

namespace MathComps.Api.Constants;

/// <summary>
/// Constants for authorization policy names used throughout the API.
/// </summary>
public static class AuthorizationPolicies
{
    /// <summary>
    /// Restricts an endpoint to users carrying the admin Role.
    /// </summary>
    public const string Admin = "Admin";

    /// <summary>
    /// Restricts an endpoint to accounts holding <see cref="UserCapability.PrepareCompetitions"/>.
    /// </summary>
    public const string PreparesCompetitions = "PreparesCompetitions";

    /// <summary>
    /// Restricts an endpoint to users carrying the admin Role and to accounts holding
    /// <see cref="UserCapability.PrepareCompetitions"/>. A route carrying it decides for itself what anybody but an
    /// admin reaches through it.
    /// </summary>
    public const string AdminOrPreparesCompetitions = "AdminOrPreparesCompetitions";
}

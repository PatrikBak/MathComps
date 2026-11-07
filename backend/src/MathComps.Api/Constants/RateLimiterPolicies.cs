namespace MathComps.Api.Constants;

/// <summary>
/// Constants for rate limiter policy names used throughout the API.
/// </summary>
public static class RateLimiterPolicies
{
    /// <summary>
    /// General API rate limiting policy for standard endpoints.
    /// </summary>
    public const string ApiRateLimit = "ApiRateLimit";

    /// <summary>
    /// Search-specific rate limiting policy for heavier database operations.
    /// </summary>
    public const string SearchRateLimit = "SearchRateLimit";
}

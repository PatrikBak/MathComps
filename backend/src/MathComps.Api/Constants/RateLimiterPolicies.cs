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

    /// <summary>
    /// Rate limiting policy for routes a signed-in page asks every few seconds, counted per account.
    /// </summary>
    public const string AccountPollRateLimit = "AccountPollRateLimit";

    /// <summary>
    /// Rate limiting policy for routes a page with no account asks every few seconds, counted per address on a budget
    /// of its own.
    /// </summary>
    public const string AddressPollRateLimit = "AddressPollRateLimit";
}

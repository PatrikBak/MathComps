using System.ComponentModel.DataAnnotations;

namespace MathComps.Api.Options;

/// <summary>
/// How many requests one caller may make in a window, for search, for the routes a page asks every few seconds and for
/// the other limited routes. A caller is one IPv4 address or one IPv6 /64, except on the signed-in polled routes, where
/// it is one account.
/// </summary>
internal class RateLimitSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "RateLimits";

    /// <summary>
    /// The window a caller's requests are counted over, starting afresh once it ends.
    /// </summary>
    [Range(typeof(TimeSpan), "00:00:01", "1.00:00:00", ParseLimitsInInvariantCulture = true)]
    public TimeSpan Window { get; set; }

    /// <summary>
    /// The requests a caller may make in one window to the limited routes outside search.
    /// </summary>
    [Range(1, int.MaxValue)]
    public int ApiPermitLimit { get; set; }

    /// <summary>
    /// How many more requests outside search wait for the next window once a caller reaches
    /// <see cref="ApiPermitLimit"/>, before the rest are refused.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int ApiQueueLimit { get; set; }

    /// <summary>
    /// The searches a caller may make in one window.
    /// </summary>
    [Range(1, int.MaxValue)]
    public int SearchPermitLimit { get; set; }

    /// <summary>
    /// How many more searches wait for the next window once a caller reaches <see cref="SearchPermitLimit"/>,
    /// before the rest are refused.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int SearchQueueLimit { get; set; }

    /// <summary>
    /// The requests one account may make in one window to the routes a signed-in page asks every few seconds.
    /// </summary>
    [Range(1, int.MaxValue)]
    public int AccountPollPermitLimit { get; set; }

    /// <summary>
    /// How many more polls of an account wait for the next window once it reaches
    /// <see cref="AccountPollPermitLimit"/>, before the rest are refused.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int AccountPollQueueLimit { get; set; }

    /// <summary>
    /// The requests one caller may make in one window to the routes a page with no account asks every few seconds.
    /// </summary>
    [Range(1, int.MaxValue)]
    public int AddressPollPermitLimit { get; set; }

    /// <summary>
    /// How many more polls of a caller with no account wait for the next window once it reaches
    /// <see cref="AddressPollPermitLimit"/>, before the rest are refused.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int AddressPollQueueLimit { get; set; }
}

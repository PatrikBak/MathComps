namespace MathComps.Infrastructure.Options;

/// <summary>
/// Options for server-side pagination enforcement.
/// </summary>
public class PaginationOptions
{
    /// <summary>
    /// The name of the configuration section for pagination options.
    /// </summary>
    public const string ConfigurationSectionName = "Pagination";

    /// <summary>
    /// How many items a page holds where the server decides its size rather than the caller.
    /// </summary>
    public int DefaultPageSize { get; init; } = 25;

    /// <summary>
    /// Maximum page size the server allows a caller to ask for.
    /// </summary>
    public int MaxPageSize { get; init; } = 100;

    /// <summary>
    /// How far into a set of results a request may ask to skip, in pages. Bounded rather than merely floored
    /// because the offset is the page number multiplied by the page size, and an unbounded one overflows to a
    /// negative skip.
    /// </summary>
    public int MaxPageNumber { get; init; } = 10_000;
}

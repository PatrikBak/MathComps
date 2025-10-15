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
    /// Maximum page size the server allows for data queries.
    /// </summary>
    public int MaxPageSize { get; init; } = 100;

    /// <summary>
    /// Default page size for queries when not specified by the client.
    /// </summary>
    public int DefaultPageSize { get; init; } = 50;
}



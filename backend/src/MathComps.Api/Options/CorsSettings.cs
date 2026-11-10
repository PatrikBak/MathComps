namespace MathComps.Api.Options;

/// <summary>
/// Which browser origins may call the API.
/// </summary>
internal class CorsSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "Cors";

    /// <summary>
    /// The origins let in, a <c>*</c> in one matching any run of characters.
    /// </summary>
    public IReadOnlyList<string> Origins { get; set; } = [];
}

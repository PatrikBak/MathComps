namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for assembling the app's configuration sources.
/// </summary>
public static class ConfigurationExtensions
{
    /// <summary>
    /// Adds a JSON config file together with its optional environment-specific overlay: a base file
    /// carrying the shared defaults, plus an <c>appsettings.foo.{Environment}.json</c> that layers on top
    /// to override individual keys per environment (mirroring how <c>appsettings.{Environment}.json</c>
    /// overrides <c>appsettings.json</c>).
    /// </summary>
    /// <param name="builder">The configuration builder to add the sources to.</param>
    /// <param name="fileName">The base file name, e.g. <c>appsettings.examiner.json</c>.</param>
    /// <param name="environment">The host environment whose name selects the overlay file.</param>
    /// <returns>The configuration builder for chaining.</returns>
    public static IConfigurationBuilder AddJsonFileWithEnvironmentOverlay(
        this IConfigurationBuilder builder,
        string fileName,
        IHostEnvironment environment)
    {
        // Splice the environment name in front of the extension: appsettings.examiner.Production.json.
        var overlayFileName =
            $"{Path.GetFileNameWithoutExtension(fileName)}.{environment.EnvironmentName}{Path.GetExtension(fileName)}";

        // Base file is required; the environment overlay is optional and wins where it sets a key.
        return builder
            .AddJsonFile(fileName, optional: false, reloadOnChange: true)
            .AddJsonFile(overlayFileName, optional: true, reloadOnChange: true);
    }
}

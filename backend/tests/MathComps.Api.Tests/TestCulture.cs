using System.Globalization;
using System.Runtime.CompilerServices;

namespace MathComps.Api.Tests;

/// <summary>
/// The culture every test in the assembly runs under: English, a language the API serves. A test calling a route
/// directly skips the localization middleware that sets each request's culture, so the route reads the culture of the
/// machine running it, which on a CI runner is the invariant one and names no language.
/// </summary>
internal static class TestCulture
{
    /// <summary>
    /// Pins the culture as the test assembly loads, before any test runs.
    /// </summary>
    [ModuleInitializer]
    internal static void Initialize() =>
        // English, wherever a test sets no culture of its own
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.GetCultureInfo("en");
}

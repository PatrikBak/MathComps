using System.Text.RegularExpressions;

namespace MathComps.Api.Tests;

/// <summary>
/// Reads what the web's committed modules declare.
/// </summary>
internal static class WebSource
{
    /// <summary>
    /// Reads one <c>const NAME = value</c> out of a web module.
    /// </summary>
    /// <param name="path">The module.</param>
    /// <param name="name">The constant's name.</param>
    /// <returns>Everything the constant was assigned, up to the end of its line.</returns>
    public static string ReadConstant(string path, string name)
    {
        // The declaration, whatever it was assigned
        var match = Regex.Match(File.ReadAllText(path), $"const {name} = (.+)");

        // A constant the web no longer declares is drift of the loudest kind
        Assert.True(match.Success, $"{Path.GetFileName(path)} declares no {name}.");

        // What it was assigned
        return match.Groups[1].Value.Trim();
    }
}

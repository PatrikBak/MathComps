using System.Text.RegularExpressions;
using MathComps.Infrastructure.Services.Users;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the frontend refuses exactly the usernames the backend refuses.
/// </summary>
/// <remarks>
/// These rules live twice on purpose: the browser has to say what is wrong with a value while it can still be
/// retyped, and it cannot call a .NET regex or read a C# constant to find out. Drift is the failure that
/// matters, because a value the form accepts and the backend then rejects is a dead end, and for a username it
/// is a dead end at the one moment nothing is undoable.
/// </remarks>
public class ProfileRuleParityTests
{
    /// <summary>
    /// Reads one <c>const NAME = value</c> out of a committed frontend module.
    /// </summary>
    /// <param name="fileName">The module's file name, under the profile feature folder.</param>
    /// <param name="name">The constant's name.</param>
    /// <returns>Everything the constant was assigned, up to the end of its line.</returns>
    private static string ReadTsConstant(string fileName, string name)
    {
        // The module as the frontend ships it
        var source = File.ReadAllText(
            RepoPaths.Resolve("web", "src", "components", "features", "profile", fileName));

        // The declaration, whatever it was assigned
        var match = Regex.Match(source, $"const {name} = (.+)");

        // A rule the frontend no longer declares is drift of the loudest kind
        Assert.True(match.Success, $"{fileName} declares no {name}.");

        // What it was assigned
        return match.Groups[1].Value.Trim();
    }

    /// <summary>
    /// Both ends bound a username's length the same way.
    /// </summary>
    [Fact]
    public void Ts_lengths_match_the_backend()
    {
        // The floor a name has to clear
        Assert.Equal(
            UserManager.MinUsernameLength.ToString(),
            ReadTsConstant("username-schema.ts", "MIN_USERNAME_LENGTH"));

        // And the ceiling it has to stay under
        Assert.Equal(
            UserManager.MaxUsernameLength.ToString(),
            ReadTsConstant("username-schema.ts", "MAX_USERNAME_LENGTH"));
    }

    /// <summary>
    /// Both ends allow a username the same characters.
    /// </summary>
    [Fact]
    public void Ts_pattern_matches_the_backend()
    {
        // The backend's pattern, which is the source of truth
        var backendPattern = UserManager.UsernamePattern().ToString();

        // The same thing as a JavaScript literal: Unicode property escapes need the u flag to mean anything
        Assert.Equal($"/{backendPattern}/u", ReadTsConstant("username-schema.ts", "USERNAME_PATTERN"));
    }
}

using System.Text.RegularExpressions;
using MathComps.Infrastructure.Services.Users;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the frontend refuses exactly the usernames the backend refuses.
/// </summary>
/// <remarks>
/// The rules live twice on purpose: the browser has to say what is wrong with a name while it can still be
/// retyped, and it cannot call a .NET regex to find out. Drift is the failure that matters, because a name the
/// form accepts and the backend then rejects is a dead end at the one moment nothing is undoable.
/// </remarks>
public class UsernameRuleParityTests
{
    /// <summary>
    /// The committed schema as the frontend ships it.
    /// </summary>
    private static string TsSource => File.ReadAllText(
        RepoPaths.Resolve("web", "src", "components", "features", "profile", "username-schema.ts"));

    /// <summary>
    /// Reads one <c>const NAME = value</c> out of the schema.
    /// </summary>
    /// <param name="name">The constant's name.</param>
    /// <returns>Everything up to the end of that line.</returns>
    private static string ReadTsConstant(string name)
    {
        // The declaration, whatever it was assigned
        var match = Regex.Match(TsSource, $"const {name} = (.+)");

        // A rule the frontend no longer declares is drift of the loudest kind
        Assert.True(match.Success, $"username-schema.ts declares no {name}.");

        // What it was assigned
        return match.Groups[1].Value.Trim();
    }

    /// <summary>
    /// Both ends bound the length the same way.
    /// </summary>
    [Fact]
    public void Ts_lengths_match_the_backend()
    {
        // The floor a name has to clear
        Assert.Equal(UserManager.MinUsernameLength.ToString(), ReadTsConstant("MIN_USERNAME_LENGTH"));

        // And the ceiling it has to stay under
        Assert.Equal(UserManager.MaxUsernameLength.ToString(), ReadTsConstant("MAX_USERNAME_LENGTH"));
    }

    /// <summary>
    /// Both ends allow the same characters.
    /// </summary>
    [Fact]
    public void Ts_pattern_matches_the_backend()
    {
        // The backend's pattern, which is the source of truth
        var backendPattern = UserManager.UsernamePattern().ToString();

        // The same thing as a JavaScript literal: Unicode property escapes need the u flag to mean anything
        Assert.Equal($"/{backendPattern}/u", ReadTsConstant("USERNAME_PATTERN"));
    }
}

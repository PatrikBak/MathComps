using MathComps.Domain;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Users;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the frontend holds the backend's profile rules: the usernames it refuses and the earliest
/// graduation year it takes.
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
    /// The web's module holding the username rules.
    /// </summary>
    private static string UsernameSchemaPath =>
        RepoPaths.Resolve("web", "src", "components", "features", "profile", "username-schema.ts");

    /// <summary>
    /// The web's module listing the graduation years.
    /// </summary>
    private static string GraduationYearPath =>
        RepoPaths.Resolve("web", "src", "components", "features", "profile", "graduation-year.ts");

    /// <summary>
    /// Both ends bound a username's length the same way.
    /// </summary>
    [Fact]
    public void Ts_lengths_match_the_backend()
    {
        // The floor a name has to clear
        Assert.Equal(
            UserManager.MinUsernameLength.ToString(),
            WebSource.ReadConstant(UsernameSchemaPath, "MIN_USERNAME_LENGTH"));

        // And the ceiling it has to stay under
        Assert.Equal(
            User.MaxUsernameLength.ToString(),
            WebSource.ReadConstant(UsernameSchemaPath, "MAX_USERNAME_LENGTH"));
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
        Assert.Equal($"/{backendPattern}/u", WebSource.ReadConstant(UsernameSchemaPath, "USERNAME_PATTERN"));
    }

    /// <summary>
    /// Both ends start the graduation years at the same one.
    /// </summary>
    [Fact]
    public void Ts_earliest_graduation_year_matches_the_backend() =>
        // The first year the form offers is the first the backend takes
        Assert.Equal(
            SchoolYear.EarliestGraduationYear.ToString(),
            WebSource.ReadConstant(GraduationYearPath, "EARLIEST_GRADUATION_YEAR"));
}

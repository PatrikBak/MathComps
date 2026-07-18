using System.Text.RegularExpressions;
using MathComps.Api.Errors;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the frontend's <c>BACKEND_ERROR_CODES</c> list names exactly the members of the backend's
/// <see cref="ApiErrorCode"/> enum, so every code on the wire has a matching client type.
/// </summary>
public class ApiErrorCodeParityTests
{
    /// <summary>
    /// The committed TypeScript code list names exactly the enum members.
    /// </summary>
    [Fact]
    public void Ts_codes_match_the_enum()
    {
        // The backend enum is the source of truth
        var enumCodes = Enum.GetNames<ApiErrorCode>().ToHashSet();

        // Read the committed frontend list
        var tsSource = File.ReadAllText(RepoPaths.Resolve("web", "src", "types", "backend-error-codes.ts"));

        // Pull each single-quoted member out of the array (identifiers may carry digits or underscores)
        var tsCodes = Regex.Matches(tsSource, "'([A-Za-z0-9_]+)'")
            .Select(match => match.Groups[1].Value)
            .ToHashSet();

        // Neither side may drift from the other
        Assert.Equal(enumCodes, tsCodes);
    }
}

using System.Text.RegularExpressions;
using MathComps.Api.Errors;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the frontend's <c>BACKEND_ERROR_CODES</c> list names exactly the codes the backend can answer with: one
/// per business exception, named after its type, plus the API's own <see cref="ApiErrorCode"/> members. Every code on
/// the wire then has a matching client type, and a code whose exception is gone shows up as a leftover.
/// </summary>
public class ApiErrorCodeParityTests
{
    /// <summary>
    /// The committed TypeScript code list names exactly the codes the backend answers with.
    /// </summary>
    [Fact]
    public void Ts_codes_match_the_backend_codes()
    {
        // The business exceptions' codes and the API's own are the source of truth
        var backendCodes = BusinessExceptions.Types.Select(BusinessExceptions.CodeOf)
            .Concat(Enum.GetNames<ApiErrorCode>())
            .ToHashSet();

        // Read the committed frontend list
        var tsSource = File.ReadAllText(RepoPaths.Resolve("web", "src", "types", "backend-error-codes.ts"));

        // Pull each single-quoted member out of the array (identifiers may carry digits or underscores)
        var tsCodes = Regex.Matches(tsSource, "'([A-Za-z0-9_]+)'")
            .Select(match => match.Groups[1].Value)
            .ToHashSet();

        // Neither side may drift from the other
        Assert.Equal(backendCodes, tsCodes);
    }
}

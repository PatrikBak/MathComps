using MathComps.Domain.EfCoreEntities;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the web names MathComps' organization by the slug the backend files it under.
/// </summary>
/// <remarks>
/// The slug lives twice on purpose: the web builds the address of MathComps' selection out of it, and it cannot read
/// a C# constant to find out. Drift is the failure that matters, because every read through that address is then
/// refused as though the reader were on no list, with nothing red on either side.
/// </remarks>
public class OrganizationSlugParityTests
{
    /// <summary>
    /// Both ends name MathComps' organization alike.
    /// </summary>
    [Fact]
    public void Ts_mathcomps_slug_matches_the_backend() =>
        // The slug the web's addresses carry is the one the backend knows MathComps by
        Assert.Equal(
            $"'{Organization.MathCompsSlug}'",
            WebSource.ReadConstant(
                RepoPaths.Resolve(
                    "web", "src", "components", "features", "problem-selection", "model", "selection-types.ts"),
                "MATHCOMPS_ORGANIZATION_SLUG"));
}

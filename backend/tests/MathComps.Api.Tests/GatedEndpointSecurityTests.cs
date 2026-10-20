using MathComps.Api.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that every route of a gated area is closed to everybody but the accounts its policy lets in, and
/// rate-limited. Each route opts in with its own call, so a route left without it serves whatever it reads
/// (students' emails, reference solutions, grades, the problems competitions are picked from) to anybody who asks,
/// and nothing else fails: the pages keep working for the accounts using them.
/// </summary>
public class GatedEndpointSecurityTests
{
    /// <summary>
    /// The routes of the gated areas open to anybody signed in, by method and pattern: the ones on one conversation,
    /// which decide for themselves who reaches the conversation they name.
    /// </summary>
    private static readonly HashSet<string> _signedInRoutes =
    [
        "GET /admin/defense/sessions/{id:guid}",
        "PUT /admin/defense/sessions/{id:guid}/review",
        "DELETE /admin/defense/sessions/{id:guid}/review",
        "PUT /admin/defense/sessions/{id:guid}/review/from/{turnId:guid}",
        "POST /admin/defense/notes",
        "PUT /admin/defense/notes/{noteId:guid}",
        "DELETE /admin/defense/notes/{noteId:guid}",
        "PUT /admin/defense/notes/{noteId:guid}/resolution",
        "DELETE /admin/defense/notes/{noteId:guid}/resolution",
    ];

    /// <summary>
    /// Every route of a gated area carries the area's policy and no other, and a rate limit, and none lets an
    /// anonymous caller through. The routes open to anybody signed in carry the default policy alone instead: a
    /// named one beside it would shut out the callers they are for.
    /// </summary>
    /// <param name="area">The path every route of the area starts with.</param>
    /// <param name="policy">The policy closing the area.</param>
    [Theory]
    [InlineData("/admin", AuthorizationPolicies.Admin)]
    [InlineData("/problem-selection", AuthorizationPolicies.OrganizationMember)]
    public void Every_gated_route_requires_its_policy_and_is_rate_limited(string area, string policy)
    {
        // The area's routes as the API maps them
        var gatedRoutes = MappedApi.Build().Routes
            .Where(route => route.RoutePattern.RawText?.StartsWith(area, StringComparison.Ordinal) == true)
            .ToList();

        // Found, so the checks below have routes to read
        Assert.NotEmpty(gatedRoutes);

        // Each one, checked on its own so a failure names the route
        foreach (var route in gatedRoutes)
        {
            // The route's name
            var name = route.DisplayName;

            // The policy it has to carry: the default one on a route open to anybody signed in, the area's elsewhere
            var required = _signedInRoutes.Contains(MappedApi.NameOf(route)) ? null : policy;

            // Every policy the route carries
            var policies = route.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Select(authorize => authorize.Policy)
                .ToList();

            // Closed by that one policy alone
            Assert.True(
                policies.Count > 0 && policies.All(carried => carried == required),
                $"{name} requires {string.Join(", ", policies)} rather than the {required ?? "default"} policy alone.");

            // With nothing opening it back up
            Assert.True(route.Metadata.GetMetadata<IAllowAnonymous>() is null, $"{name} allows anonymous callers.");

            // And a limit on how often it is asked
            Assert.True(
                route.Metadata.GetMetadata<EnableRateLimitingAttribute>() is not null,
                $"{name} is not rate-limited.");
        }
    }
}

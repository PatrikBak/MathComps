using MathComps.Api.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that every route of a gated area is closed to everybody but the accounts its policy lets in, bar the routes
/// named here as open to anybody, and rate-limited. Each route opts in with its own call, so a route left without it
/// serves whatever it reads (students' emails, reference solutions, grades, the problems competitions are picked from)
/// to anybody who asks, and nothing else fails: the pages keep working for the accounts using them.
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
    /// The routes of the gated areas open to anybody at all, by method and pattern: the phone's side of the photo
    /// handoff, where the code in the request is the only thing letting a caller in.
    /// </summary>
    private static readonly HashSet<string> _anonymousRoutes =
    [
        "GET /defense/photos/handoff",
        "POST /defense/photos/handoff/photos",
    ];

    /// <summary>
    /// Every route of a gated area carries the area's policy and no other, and a rate limit, and none lets an
    /// anonymous caller through. The routes open to anybody signed in carry the default policy alone instead: a
    /// named one beside it would shut out the callers they are for. The routes open to anybody at all carry no policy.
    /// </summary>
    /// <param name="area">The path every route of the area starts with.</param>
    /// <param name="policy">The policy closing the area, or null for an area open to anybody signed in, whose
    /// routes decide for themselves what the caller reaches.</param>
    [Theory]
    [InlineData("/admin", AuthorizationPolicies.Admin)]
    [InlineData("/problem-selection", AuthorizationPolicies.OrganizationMember)]
    [InlineData("/defense/photos", null)]
    [InlineData("/files", null)]
    public void Every_gated_route_requires_its_policy_and_is_rate_limited(string area, string? policy)
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

            // A limit on how often the route is asked
            Assert.True(
                route.Metadata.GetMetadata<EnableRateLimitingAttribute>() is not null,
                $"{name} is not rate-limited.");

            // Every policy the route carries
            var policies = route.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Select(authorize => authorize.Policy)
                .ToList();

            // A route open to anybody at all
            if (_anonymousRoutes.Contains(MappedApi.NameOf(route)))
            {
                // Carries no policy
                Assert.True(policies.Count == 0, $"{name} is closed to anonymous callers.");
                continue;
            }

            // The policy the route has to carry: the default one on a route open to anybody signed in, else the area's
            var required = _signedInRoutes.Contains(MappedApi.NameOf(route)) ? null : policy;

            // Closed by that one policy alone
            Assert.True(
                policies.Count > 0 && policies.All(carried => carried == required),
                $"{name} requires {string.Join(", ", policies)} rather than the {required ?? "default"} policy alone.");

            // With nothing opening it back up
            Assert.True(route.Metadata.GetMetadata<IAllowAnonymous>() is null, $"{name} allows anonymous callers.");
        }
    }

    /// <summary>
    /// Every route named here as open is one the API maps, so a name left behind by a removed route can't open a later
    /// route that takes it.
    /// </summary>
    [Fact]
    public void Every_route_named_as_open_is_mapped()
    {
        // Every route the API maps, by method and pattern
        var mapped = MappedApi.Build().Routes.Select(MappedApi.NameOf).ToHashSet();

        // The routes named as open that the API doesn't map
        var unmapped = _signedInRoutes.Concat(_anonymousRoutes).Where(name => !mapped.Contains(name)).ToList();

        // None
        Assert.Empty(unmapped);
    }
}

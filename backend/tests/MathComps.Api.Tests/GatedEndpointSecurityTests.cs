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
    /// The admin routes the problem selection's reviewers reach their conversations about the proposals through, by
    /// method and pattern.
    /// </summary>
    private static readonly HashSet<string> _conversationRoutes =
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
    /// anonymous caller through. The admin routes the reviewers reach their conversations through carry
    /// <see cref="AuthorizationPolicies.AdminOrOrganizationMember"/> instead, and they alone: a second policy beside
    /// it would shut the reviewers out.
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

            // The policy it has to carry: the reviewers' own on their conversation routes, the area's elsewhere
            var required = _conversationRoutes.Contains(MappedApi.NameOf(route))
                ? AuthorizationPolicies.AdminOrOrganizationMember
                : policy;

            // Every policy the route carries
            var policies = route.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Select(authorize => authorize.Policy)
                .ToList();

            // Closed by that one policy alone
            Assert.True(
                policies.Count > 0 && policies.All(carried => carried == required),
                $"{name} requires {string.Join(", ", policies)} rather than the {required} policy alone.");

            // With nothing opening it back up
            Assert.True(route.Metadata.GetMetadata<IAllowAnonymous>() is null, $"{name} allows anonymous callers.");

            // And a limit on how often it is asked
            Assert.True(
                route.Metadata.GetMetadata<EnableRateLimitingAttribute>() is not null,
                $"{name} is not rate-limited.");
        }
    }
}

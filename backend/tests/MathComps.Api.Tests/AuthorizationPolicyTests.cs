using System.Security.Claims;
using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using MathComps.Api.Extensions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Organizations;
using MathComps.Infrastructure.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers the policies the API registers, each weighed for every kind of caller. A route only names its policy, so
/// a policy loosened where it is registered opens every route naming it, and nothing else fails. Among those routes
/// are the problems competitions are picked from.
/// </summary>
public class AuthorizationPolicyTests
{
    /// <summary>
    /// The slug of the second organization, whose list holds the commissioner alone.
    /// </summary>
    private const string OlympiadSlug = "olympiad";

    /// <summary>
    /// The account on the MathComps organization's list.
    /// </summary>
    private static readonly Guid _reviewerId = Guid.CreateVersion7();

    /// <summary>
    /// The account on the olympiad's list.
    /// </summary>
    private static readonly Guid _commissionerId = Guid.CreateVersion7();

    /// <summary>
    /// Every account, by the subject it signs in under.
    /// </summary>
    private static readonly Dictionary<string, Guid> _accounts = new()
    {
        ["student"] = Guid.CreateVersion7(),
        ["reviewer"] = _reviewerId,
        ["commissioner"] = _commissionerId,
        ["admin"] = Guid.CreateVersion7(),
    };

    /// <summary>
    /// Each policy lets in exactly the callers it is for: the admins' one only the admins, and the members' one only
    /// the accounts on the list of the organization the route names, never a student, an admin on no list, a member
    /// of another organization, or anybody signed out. A route naming no organization lets nobody in through it.
    /// </summary>
    /// <param name="policy">The policy weighed.</param>
    /// <param name="organization">The slug the route names the organization by; null for a route naming none.</param>
    /// <param name="caller">Who is asking: <c>anonymous</c>, or the subject of a <c>student</c>, a
    /// <c>reviewer</c> on MathComps' list, a <c>commissioner</c> on the olympiad's, or an <c>admin</c> on
    /// none.</param>
    /// <param name="letsIn">Whether the policy lets the caller in.</param>
    [Theory]
    [InlineData(AuthorizationPolicies.Admin, null, "anonymous", false)]
    [InlineData(AuthorizationPolicies.Admin, null, "student", false)]
    [InlineData(AuthorizationPolicies.Admin, null, "reviewer", false)]
    [InlineData(AuthorizationPolicies.Admin, null, "admin", true)]
    [InlineData(AuthorizationPolicies.OrganizationMember, Organization.MathCompsSlug, "anonymous", false)]
    [InlineData(AuthorizationPolicies.OrganizationMember, Organization.MathCompsSlug, "student", false)]
    [InlineData(AuthorizationPolicies.OrganizationMember, Organization.MathCompsSlug, "reviewer", true)]
    [InlineData(AuthorizationPolicies.OrganizationMember, Organization.MathCompsSlug, "commissioner", false)]
    [InlineData(AuthorizationPolicies.OrganizationMember, Organization.MathCompsSlug, "admin", false)]
    [InlineData(AuthorizationPolicies.OrganizationMember, OlympiadSlug, "reviewer", false)]
    [InlineData(AuthorizationPolicies.OrganizationMember, OlympiadSlug, "commissioner", true)]
    [InlineData(AuthorizationPolicies.OrganizationMember, null, "reviewer", false)]
    public async Task A_policy_lets_in_its_callers_alone(
        string policy, string? organization, string caller, bool letsIn)
    {
        // Each subject resolving to its account
        var userManager = new Mock<IUserManager>();
        foreach (var (subject, userId) in _accounts)
            userManager
                .Setup(manager => manager.GetUserIdAsync(subject, It.IsAny<CancellationToken>()))
                .ReturnsAsync(userId);

        // The reviewer's address alone on the MathComps organization's list, the commissioner's on the olympiad's
        var members = new Mock<IOrganizationMemberService>();
        members
            .Setup(service => service.IsMemberAsync(
                _reviewerId, Organization.MathCompsSlug, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        members
            .Setup(service => service.IsMemberAsync(_commissionerId, OlympiadSlug, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // The policies as the API registers them, reading accounts and the lists off the stand-ins
        await using var services = new ServiceCollection()
            .AddLogging()
            .AddApiAuthorization()
            .AddScoped(_ => userManager.Object)
            .AddScoped(_ => members.Object)
            .BuildServiceProvider();

        // One request's worth of services
        await using var scope = services.CreateAsyncScope();

        // The caller
        var user = UserOf(caller);

        // Their request
        var request = new DefaultHttpContext { User = user };

        // Its route naming the organization, where the case has one
        if (organization is not null)
            request.Request.RouteValues[OrganizationMemberRequirement.OrganizationRouteValue] = organization;

        // Put to the policy
        var result = await scope.ServiceProvider.GetRequiredService<IAuthorizationService>()
            .AuthorizeAsync(user, request, policy);

        // Let in exactly when the policy is for them
        Assert.Equal(letsIn, result.Succeeded);
    }

    /// <summary>
    /// Builds a caller.
    /// </summary>
    /// <param name="caller">Who is asking, as the test cases name them.</param>
    /// <returns>Nobody signed in for <c>anonymous</c>; otherwise signed in under the subject, an admin carrying the
    /// admin role.</returns>
    private static ClaimsPrincipal UserOf(string caller) =>
        // Signed out, or signed in under the subject with the admin role where the caller is the admin
        caller == "anonymous"
            ? new ClaimsPrincipal(new ClaimsIdentity())
            : TestCallers.SignedIn(caller, isAdmin: caller == "admin");
}

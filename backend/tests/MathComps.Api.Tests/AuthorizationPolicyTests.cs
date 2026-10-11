using System.Security.Claims;
using MathComps.Api.Constants;
using MathComps.Api.Extensions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers the policies the API registers, each weighed for every kind of caller. A route only names its policy, so
/// a policy loosened where it is registered opens every route naming it, and nothing else fails. Among those routes
/// are the problems competitions are picked from and the reviewers' conversations about them.
/// </summary>
public class AuthorizationPolicyTests
{
    /// <summary>
    /// The account holding the grant to prepare the competitions.
    /// </summary>
    private static readonly Guid _preparerId = Guid.CreateVersion7();

    /// <summary>
    /// Every account, by the subject it signs in under.
    /// </summary>
    private static readonly Dictionary<string, Guid> _accounts = new()
    {
        ["student"] = Guid.CreateVersion7(),
        ["preparer"] = _preparerId,
        ["admin"] = Guid.CreateVersion7(),
    };

    /// <summary>
    /// Each policy lets in exactly the callers it is for: the admins' one only the admins, the preparers' one only the
    /// accounts holding the grant, and the one the reviewers reach their conversations through both of those, never a
    /// student or anybody signed out.
    /// </summary>
    /// <param name="policy">The policy weighed.</param>
    /// <param name="caller">Who is asking: <c>anonymous</c>, or the subject of a <c>student</c>, a
    /// <c>preparer</c> holding the grant, or an <c>admin</c> holding none.</param>
    /// <param name="letsIn">Whether the policy lets the caller in.</param>
    [Theory]
    [InlineData(AuthorizationPolicies.Admin, "anonymous", false)]
    [InlineData(AuthorizationPolicies.Admin, "student", false)]
    [InlineData(AuthorizationPolicies.Admin, "preparer", false)]
    [InlineData(AuthorizationPolicies.Admin, "admin", true)]
    [InlineData(AuthorizationPolicies.PreparesCompetitions, "anonymous", false)]
    [InlineData(AuthorizationPolicies.PreparesCompetitions, "student", false)]
    [InlineData(AuthorizationPolicies.PreparesCompetitions, "preparer", true)]
    [InlineData(AuthorizationPolicies.PreparesCompetitions, "admin", false)]
    [InlineData(AuthorizationPolicies.AdminOrPreparesCompetitions, "anonymous", false)]
    [InlineData(AuthorizationPolicies.AdminOrPreparesCompetitions, "student", false)]
    [InlineData(AuthorizationPolicies.AdminOrPreparesCompetitions, "preparer", true)]
    [InlineData(AuthorizationPolicies.AdminOrPreparesCompetitions, "admin", true)]
    public async Task A_policy_lets_in_its_callers_alone(string policy, string caller, bool letsIn)
    {
        // Each subject resolving to its account
        var userManager = new Mock<IUserManager>();
        foreach (var (subject, userId) in _accounts)
            userManager
                .Setup(manager => manager.GetUserIdAsync(subject, It.IsAny<CancellationToken>()))
                .ReturnsAsync(userId);

        // The grant standing against the preparer's account alone
        var grants = new Mock<IUserGrantService>();
        grants
            .Setup(service => service.HasAsync(
                _preparerId, UserCapability.PrepareCompetitions, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // The policies as the API registers them, reading accounts and grants off the stand-ins
        await using var services = new ServiceCollection()
            .AddLogging()
            .AddApiAuthorization()
            .AddScoped(_ => userManager.Object)
            .AddScoped(_ => grants.Object)
            .BuildServiceProvider();

        // One request's worth of services
        await using var scope = services.CreateAsyncScope();

        // The caller
        var user = UserOf(caller);

        // Their request, put to the policy
        var result = await scope.ServiceProvider.GetRequiredService<IAuthorizationService>()
            .AuthorizeAsync(user, new DefaultHttpContext { User = user }, policy);

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

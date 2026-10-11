using MathComps.Api.Authorization;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers <see cref="UserCapabilityHandler"/>. A handler meeting its requirement for anybody signed in would hand
/// every account the problems competitions are picked from, and the reviewers picking them would notice nothing.
/// </summary>
public class UserCapabilityHandlerTests
{
    /// <summary>
    /// The signed-in caller's account.
    /// </summary>
    private static readonly Guid _userId = Guid.CreateVersion7();

    /// <summary>
    /// A requirement admitting no admins is met for a caller whose account holds the capability, and only for one.
    /// </summary>
    /// <param name="holdsGrant">Whether a grant of the capability stands against the account.</param>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_requirement_admitting_no_admins_is_met_only_for_an_account_holding_the_capability(
        bool holdsGrant)
    {
        // The caller's subject resolves to their account
        var userManager = new Mock<IUserManager>();
        userManager
            .Setup(manager => manager.GetUserIdAsync("ext-reviewer", It.IsAny<CancellationToken>()))
            .ReturnsAsync(_userId);

        // A grant of the capability against the account, or none
        var grants = new Mock<IUserGrantService>();
        grants
            .Setup(service => service.HasAsync(
                _userId, UserCapability.PrepareCompetitions, It.IsAny<CancellationToken>()))
            .ReturnsAsync(holdsGrant);

        // The caller, signed in under the account's subject
        var user = TestCallers.SignedIn("ext-reviewer", isAdmin: false);

        // The requirement the caller has to meet
        var requirement = new UserCapabilityRequirement(UserCapability.PrepareCompetitions);

        // The caller's request, put to the requirement
        var context = new AuthorizationHandlerContext([requirement], user, new DefaultHttpContext { User = user });

        // The requirement weighed
        await new UserCapabilityHandler(userManager.Object, grants.Object).HandleAsync(context);

        // Met exactly when the grant stands
        Assert.Equal(holdsGrant, context.HasSucceeded);
    }

    /// <summary>
    /// An admin holding no grant meets the requirement where it admits admins, and only there.
    /// </summary>
    /// <param name="admitsAdmins">Whether the requirement lets admins in.</param>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task An_admin_meets_the_requirement_only_where_it_admits_admins(bool admitsAdmins)
    {
        // The caller's subject resolves to their account
        var userManager = new Mock<IUserManager>();
        userManager
            .Setup(manager => manager.GetUserIdAsync("ext-admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(_userId);

        // No grant stands against the account
        var grants = new Mock<IUserGrantService>();

        // The caller, signed in as an admin
        var user = TestCallers.SignedIn("ext-admin", isAdmin: true);

        // The requirement the caller has to meet
        var requirement = new UserCapabilityRequirement(UserCapability.PrepareCompetitions, admitsAdmins);

        // The caller's request, put to the requirement
        var context = new AuthorizationHandlerContext([requirement], user, new DefaultHttpContext { User = user });

        // The requirement weighed
        await new UserCapabilityHandler(userManager.Object, grants.Object).HandleAsync(context);

        // Met exactly where admins are let in
        Assert.Equal(admitsAdmins, context.HasSucceeded);
    }
}

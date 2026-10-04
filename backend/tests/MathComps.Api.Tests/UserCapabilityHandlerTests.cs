using System.Security.Claims;
using MathComps.Api.Authorization;
using MathComps.Api.Constants;
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
    /// The requirement is met for a caller whose account holds the capability, and only for one.
    /// </summary>
    /// <param name="holdsGrant">Whether a grant of the capability stands against the account.</param>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task The_requirement_is_met_only_for_an_account_holding_the_capability(bool holdsGrant)
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
        var user = new ClaimsPrincipal(
            new ClaimsIdentity([new Claim(ClerkClaims.Subject, "ext-reviewer")], authenticationType: "test"));

        // The requirement the caller has to meet
        var requirement = new UserCapabilityRequirement(UserCapability.PrepareCompetitions);

        // The caller's request, put to the requirement
        var context = new AuthorizationHandlerContext([requirement], user, new DefaultHttpContext { User = user });

        // The requirement weighed
        await new UserCapabilityHandler(userManager.Object, grants.Object).HandleAsync(context);

        // Met exactly when the grant stands
        Assert.Equal(holdsGrant, context.HasSucceeded);
    }
}

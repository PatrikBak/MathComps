using System.Text.Json;
using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using MathComps.Infrastructure.Services.Selection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Routing;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers <see cref="ProposalConversationFilter"/>, on its own and through the request pipeline of each route it
/// guards. A route checking the wrong id, or none, would hand a reviewer every student's conversation the moment
/// they guessed its id, and the reviewers' own pages would go on working.
/// </summary>
public class ProposalConversationFilterTests
{
    /// <summary>
    /// A reviewer who is no admin has the conversation each guarded route names checked before the route does
    /// anything: the note's, where the route names a note, else the one in the route or in a new note's body. Each
    /// check refuses here, and the refusal is what comes back.
    /// </summary>
    [Fact]
    public async Task A_reviewer_has_the_conversation_each_route_names_checked_first()
    {
        // The API's routes, mapped
        var mapped = MappedApi.Build();

        // The routes the reviewers reach their conversations through
        var guarded = GuardedRoutes(mapped);

        // Found, so the checks below have routes to read
        Assert.NotEmpty(guarded);

        // Each one, checked on its own so a failure names the route
        foreach (var route in guarded)
        {
            // A check refusing every conversation
            var proposalConversations = new Mock<IProposalConversations>(MockBehavior.Strict);
            proposalConversations
                .Setup(check => check.EnsureNoteAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new SelectionTargetNotFoundException());
            proposalConversations
                .Setup(check => check.EnsureConversationAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new SelectionTargetNotFoundException());

            // A reviewer's request to it, naming a conversation in its body and anything its route names
            var (request, routeIds, bodySessionId) = NewRequest(
                route, new GuardedServices(mapped.Services, proposalConversations.Object), isAdmin: false);

            // Sent through the route
            var refusal = await Record.ExceptionAsync(() => route.RequestDelegate!(request));

            // Refused by the check
            Assert.True(refusal is SelectionTargetNotFoundException, $"{route.DisplayName} let the reviewer through.");

            // Which checked the note the route names
            if (routeIds.TryGetValue(ProposalConversationFilter.NoteIdRouteValue, out var noteId))
                proposalConversations.Verify(
                    check => check.EnsureNoteAsync(noteId, It.IsAny<CancellationToken>()),
                    Times.Once,
                    $"{route.DisplayName} did not check the note it names.");

            // Or the conversation it names, or else the one the new note's body names
            else
                proposalConversations.Verify(
                    check => check.EnsureConversationAsync(
                        routeIds.GetValueOrDefault(ProposalConversationFilter.SessionIdRouteValue, bodySessionId),
                        It.IsAny<CancellationToken>()),
                    Times.Once,
                    $"{route.DisplayName} did not check the conversation it names.");
        }
    }

    /// <summary>
    /// An admin reaches the route behind the filter with nothing checked, since every conversation is theirs to read,
    /// and a reviewer reaches it once the check has passed the conversation the route names.
    /// </summary>
    /// <param name="isAdmin">Whether the caller is an admin.</param>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_caller_let_in_reaches_the_route(bool isAdmin)
    {
        // The conversation the route names
        var sessionId = Guid.NewGuid();

        // A check passing that conversation, and failing the test if asked anything else
        var proposalConversations = new Mock<IProposalConversations>(MockBehavior.Strict);
        proposalConversations
            .Setup(check => check.EnsureConversationAsync(sessionId, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // The caller's request, its route naming the conversation
        var request = new DefaultHttpContext { User = TestCallers.SignedIn("ext-reviewer", isAdmin) };
        request.Request.RouteValues[ProposalConversationFilter.SessionIdRouteValue] = sessionId.ToString();

        // Whether the route behind the filter ran
        var reached = false;

        // Put to the filter
        await new ProposalConversationFilter(proposalConversations.Object).InvokeAsync(
            new DefaultEndpointFilterInvocationContext(request),
            _ =>
            {
                // Reached
                reached = true;

                // With nothing to say
                return ValueTask.FromResult<object?>(null);
            });

        // Reached
        Assert.True(reached);

        // With the conversation checked for the reviewer alone
        proposalConversations.Verify(
            check => check.EnsureConversationAsync(sessionId, It.IsAny<CancellationToken>()),
            isAdmin ? Times.Never() : Times.Once());
    }

    /// <summary>
    /// A route naming no conversation lets nobody but an admin through, so the filter put on the wrong route fails
    /// closed.
    /// </summary>
    [Fact]
    public async Task A_route_naming_no_conversation_lets_no_reviewer_through()
    {
        // A check that fails the test if anything asks it
        var proposalConversations = new Mock<IProposalConversations>(MockBehavior.Strict);

        // A reviewer's request naming nothing
        var request = new DefaultHttpContext { User = TestCallers.SignedIn("ext-reviewer", isAdmin: false) };

        // Whether the route behind the filter ran
        var reached = false;

        // Put to the filter
        var refusal = await Record.ExceptionAsync(async () => await new ProposalConversationFilter(
                proposalConversations.Object)
            .InvokeAsync(
                new DefaultEndpointFilterInvocationContext(request),
                _ =>
                {
                    // Reached
                    reached = true;

                    // With nothing to say
                    return ValueTask.FromResult<object?>(null);
                }));

        // Refused by the filter
        Assert.IsType<SelectionTargetNotFoundException>(refusal);

        // The route never reached
        Assert.False(reached);
    }

    /// <summary>
    /// Picks out the routes the reviewers reach their conversations through, which are the ones carrying their policy.
    /// </summary>
    /// <param name="mapped">The API's routes.</param>
    /// <returns>The routes.</returns>
    private static List<RouteEndpoint> GuardedRoutes(MappedApi mapped) =>
        // Every route carrying the reviewers' policy
        [
            .. mapped.Routes.Where(route => route.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Any(authorize => authorize.Policy == AuthorizationPolicies.AdminOrPreparesCompetitions)),
        ];

    /// <summary>
    /// Builds a request to a route: every id its pattern holds filled with an id of its own, and a body naming a
    /// conversation of its own and saying something, valid for every guarded route that reads a body.
    /// </summary>
    /// <param name="route">The route.</param>
    /// <param name="services">The services the request is handed.</param>
    /// <param name="isAdmin">Whether the caller is an admin.</param>
    /// <returns>The request, the id filled into each of its route values, and the conversation its body names.</returns>
    private static (HttpContext Request, Dictionary<string, Guid> RouteIds, Guid BodySessionId) NewRequest(
        RouteEndpoint route, IServiceProvider services, bool isAdmin)
    {
        // An id for every value the route's pattern holds
        var routeIds = route.RoutePattern.Parameters.ToDictionary(parameter => parameter.Name, _ => Guid.NewGuid());

        // And one for the conversation the body names
        var bodySessionId = Guid.NewGuid();

        // The body, written as a client would
        var body = JsonSerializer.SerializeToUtf8Bytes(new { sessionId = bodySessionId, content = "A note" });

        // The request from the caller
        var request = new DefaultHttpContext
        {
            User = TestCallers.SignedIn("ext-reviewer", isAdmin),
            RequestServices = services,
        };

        // Carrying each id in its route value
        foreach (var (name, id) in routeIds)
            request.Request.RouteValues[name] = id.ToString();

        // And the body
        request.Request.ContentType = "application/json";
        request.Request.Body = new MemoryStream(body);
        request.Request.ContentLength = body.Length;

        // A bare request reads no body until it says it can carry one
        request.Features.Set<IHttpRequestBodyDetectionFeature>(new CarriesBody());

        // The request, with what it names
        return (request, routeIds, bodySessionId);
    }

    /// <summary>
    /// The services a request is handed, with the check on the reviewers' conversations swapped for the test's own.
    /// </summary>
    /// <param name="services">The services the test's check is swapped into.</param>
    /// <param name="proposalConversations">The test's check.</param>
    private sealed class GuardedServices(IServiceProvider services, IProposalConversations proposalConversations)
        : IServiceProvider
    {
        /// <inheritdoc/>
        public object? GetService(Type serviceType) =>
            // The test's check where it is asked for, the stand-ins otherwise
            serviceType == typeof(IProposalConversations) ? proposalConversations : services.GetService(serviceType);
    }

    /// <summary>
    /// Says a request can carry a body, as a server says of every request with content.
    /// </summary>
    private sealed class CarriesBody : IHttpRequestBodyDetectionFeature
    {
        /// <inheritdoc/>
        public bool CanHaveBody => true;
    }
}

using System.Text.Json;
using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Routing;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers <see cref="ConversationAccessFilter"/>, on its own and through the request pipeline of each route it
/// guards. A route checking the wrong id, or none, would hand anybody signed in any conversation the moment they
/// guessed its id, while the pages using the routes would go on working.
/// </summary>
public class ConversationAccessFilterTests
{
    /// <summary>
    /// The account every caller here signs in as.
    /// </summary>
    private static readonly Guid _callerId = Guid.CreateVersion7();

    /// <summary>
    /// The subject every caller here signs in under.
    /// </summary>
    private const string CallerSubject = "ext-caller";

    /// <summary>
    /// A caller has the conversation each guarded route names checked before the route does anything, an admin as
    /// much as anybody: the note's, where the route names a note, else the one in the route or in a new note's body.
    /// Each check refuses here, and the refusal is what comes back.
    /// </summary>
    /// <param name="isAdmin">Whether the caller is an admin.</param>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_caller_has_the_conversation_each_route_names_checked_first(bool isAdmin)
    {
        // The API's routes, mapped
        var mapped = MappedApi.Build();

        // The routes reading or writing against one conversation
        var guarded = GuardedRoutes(mapped);

        // Found, so the checks below have routes to read
        Assert.NotEmpty(guarded);

        // Each one, checked on its own so a failure names the route
        foreach (var route in guarded)
        {
            // The caller, as the check is handed them
            var viewer = new ConversationViewer(_callerId, isAdmin);

            // A check refusing every conversation
            var conversationAccess = new Mock<IConversationAccess>(MockBehavior.Strict);
            conversationAccess
                .Setup(check => check.EnsureNoteAsync(It.IsAny<Guid>(), viewer, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DefenseSessionNotFoundException());
            conversationAccess
                .Setup(check => check.EnsureConversationAsync(
                    It.IsAny<Guid>(), viewer, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DefenseSessionNotFoundException());

            // The caller's request to it, naming a conversation in its body and anything its route names
            var (request, routeIds, bodySessionId) = NewRequest(
                route, new GuardedServices(mapped.Services, CallerAccount(), conversationAccess.Object), isAdmin);

            // Sent through the route
            var refusal = await Record.ExceptionAsync(() => route.RequestDelegate!(request));

            // Refused by the check
            Assert.True(refusal is DefenseSessionNotFoundException, $"{route.DisplayName} let the caller through.");

            // Which checked the note the route names
            if (routeIds.TryGetValue(ConversationAccessFilter.NoteIdRouteValue, out var noteId))
                conversationAccess.Verify(
                    check => check.EnsureNoteAsync(noteId, viewer, It.IsAny<CancellationToken>()),
                    Times.Once,
                    $"{route.DisplayName} did not check the note it names.");

            // Or the conversation it names, or else the one the new note's body names
            else
                conversationAccess.Verify(
                    check => check.EnsureConversationAsync(
                        routeIds.GetValueOrDefault(ConversationAccessFilter.SessionIdRouteValue, bodySessionId),
                        viewer,
                        It.IsAny<CancellationToken>()),
                    Times.Once,
                    $"{route.DisplayName} did not check the conversation it names.");
        }
    }

    /// <summary>
    /// A route naming no conversation lets nobody through, an admin included, so the filter put on the wrong route
    /// fails closed.
    /// </summary>
    /// <param name="isAdmin">Whether the caller is an admin.</param>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_route_naming_no_conversation_lets_nobody_through(bool isAdmin)
    {
        // A check that fails the test if anything asks it
        var conversationAccess = new Mock<IConversationAccess>(MockBehavior.Strict);

        // The caller's request naming nothing
        var request = new DefaultHttpContext { User = TestCallers.SignedIn(CallerSubject, isAdmin) };

        // Whether the route behind the filter ran
        var reached = false;

        // Put to the filter
        var refusal = await Record.ExceptionAsync(async () => await new ConversationAccessFilter(
                CallerAccount(), conversationAccess.Object)
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
        Assert.IsType<DefenseSessionNotFoundException>(refusal);

        // The route never reached
        Assert.False(reached);
    }

    /// <summary>
    /// Picks out the routes reading or writing against one conversation, which are the admin routes open to anybody
    /// signed in rather than to the admins alone.
    /// </summary>
    /// <param name="mapped">The API's routes.</param>
    /// <returns>The routes.</returns>
    private static List<RouteEndpoint> GuardedRoutes(MappedApi mapped) =>
        // Every admin route carrying no admins' policy
        [
            .. mapped.Routes.Where(route =>
                route.RoutePattern.RawText?.StartsWith("/admin", StringComparison.Ordinal) == true
                && route.Metadata.GetOrderedMetadata<IAuthorizeData>()
                    .All(authorize => authorize.Policy != AuthorizationPolicies.Admin)),
        ];

    /// <summary>
    /// Builds the lookup resolving the caller's subject to their account.
    /// </summary>
    /// <returns>The lookup.</returns>
    private static IUserManager CallerAccount()
    {
        // The caller's subject resolving to their account, and every other subject to none
        var userManager = new Mock<IUserManager>();
        userManager
            .Setup(manager => manager.GetUserIdAsync(CallerSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(_callerId);

        // The lookup
        return userManager.Object;
    }

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
            User = TestCallers.SignedIn(CallerSubject, isAdmin),
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
    /// The services a request is handed, with the caller's account lookup and the check on the conversations swapped
    /// for the test's own.
    /// </summary>
    /// <param name="services">The services the test's own are swapped into.</param>
    /// <param name="userManager">The test's account lookup.</param>
    /// <param name="conversationAccess">The test's check.</param>
    private sealed class GuardedServices(
        IServiceProvider services, IUserManager userManager, IConversationAccess conversationAccess)
        : IServiceProvider
    {
        /// <inheritdoc/>
        public object? GetService(Type serviceType) =>
            // The test's own where they are asked for, the stand-ins otherwise
            serviceType == typeof(IConversationAccess) ? conversationAccess
            : serviceType == typeof(IUserManager) ? userManager
            : services.GetService(serviceType);
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

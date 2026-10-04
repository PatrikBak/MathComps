using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Selection;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints of the problem selection: one read returning the whole of it, and one write per change a
/// reviewer makes. Every route is gated by the <see cref="AuthorizationPolicies.PreparesCompetitions"/> policy,
/// since the proposals are problems no student may see.
/// </summary>
public static class ProblemSelectionEndpoints
{
    /// <summary>
    /// The base path the selection's endpoints hang off.
    /// </summary>
    private const string SelectionPath = "/problem-selection";

    /// <summary>
    /// The path of one slot, below the base path.
    /// </summary>
    private const string SlotPath =
        $"{SelectionPath}/boards/{{boardId:guid}}/papers/{{paperId:guid}}/slots/{{index:int}}";

    /// <summary>
    /// The path of one proposal, below the base path.
    /// </summary>
    private const string ProposalPath = $"{SelectionPath}/proposals/{{proposalId:guid}}";

    /// <summary>
    /// Maps the <c>/problem-selection</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapProblemSelectionEndpoints(this IEndpointRouteBuilder app)
    {
        // Read the whole selection
        app.MapGet(SelectionPath, async (
            IProblemSelectionService selectionService,
            CancellationToken cancellationToken) =>
        {
            // The selection, its cycles named in the caller's language
            var selection = await selectionService.GetSelectionAsync(
                EndpointHelpers.GetRequestLanguage(), cancellationToken);

            // Return it
            return Results.Ok(selection);
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Put a proposal into a slot
        app.MapPut(SlotPath, async (
            Guid boardId,
            Guid paperId,
            int index,
            PlaceProposalRequest request,
            ISelectionBoardService boardService,
            CancellationToken cancellationToken) =>
        {
            // A placement naming no proposal names nothing to place
            if (request.ProposalId is not { } proposalId)
                throw new BadHttpRequestException("A placement must name the proposal.");

            // Place it
            await boardService.PlaceAsync(new SlotAddress(boardId, paperId, index), proposalId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Empty a slot
        app.MapDelete(SlotPath, async (
            Guid boardId,
            Guid paperId,
            int index,
            ISelectionBoardService boardService,
            CancellationToken cancellationToken) =>
        {
            // Empty it
            await boardService.ClearSlotAsync(new SlotAddress(boardId, paperId, index), cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Trade a slot with its neighbour
        app.MapPost($"{SlotPath}/move", async (
            Guid boardId,
            Guid paperId,
            int index,
            MoveSlotRequest request,
            ISelectionBoardService boardService,
            CancellationToken cancellationToken) =>
        {
            // A move naming no direction names no neighbour to trade with
            if (request.Direction is not { } direction)
                throw new BadHttpRequestException("A move must say which way it goes.");

            // Trade them
            await boardService.MoveSlotAsync(new SlotAddress(boardId, paperId, index), direction, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Finalize a board into a cycle's rounds
        app.MapPost($"{SelectionPath}/boards/{{boardId:guid}}/finalization", async (
            Guid boardId,
            FinalizeBoardRequest request,
            ISelectionBoardService boardService,
            CancellationToken cancellationToken) =>
        {
            // A finalization naming no cycle has nowhere to put the papers
            if (request.CycleId is not { } cycleId)
                throw new BadHttpRequestException("A finalization must name the cycle.");

            // Finalize it
            await boardService.FinalizeAsync(boardId, cycleId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Set a proposal aside, or bring it back
        app.MapPut($"{ProposalPath}/set-aside", async (
            Guid proposalId,
            SetAsideRequest request,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // A change saying neither way changes nothing
            if (request.IsSetAside is not { } isSetAside)
                throw new BadHttpRequestException("The change must say whether the proposal is set aside.");

            // Change it
            await proposalService.SetAsideAsync(proposalId, isSetAside, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Recommend a proposal for one category, or take it back
        app.MapPut($"{ProposalPath}/recommended", async (
            Guid proposalId,
            SetRecommendedRequest request,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // A change naming no category, or saying neither way, changes nothing
            if (request is not { Category: { } category, IsRecommended: { } isRecommended })
                throw new BadHttpRequestException("The change must name the category and say which way it goes.");

            // Change it
            await proposalService.SetRecommendedAsync(proposalId, category, isRecommended, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Delete a proposal from the selection
        app.MapDelete(ProposalPath, async (
            Guid proposalId,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // Delete it
            await proposalService.DeleteAsync(proposalId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Comment on a proposal
        app.MapPost($"{ProposalPath}/comments", async (
            Guid proposalId,
            AddProposalCommentRequest request,
            HttpContext context,
            IUserManager userManager,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // A comment saying nothing says nothing
            if (string.IsNullOrWhiteSpace(request.Content))
                throw new BadHttpRequestException("A comment must say something.");

            // The reviewer writing it, taken from the caller rather than from what they sent
            var userId = await userManager.RequireUserIdAsync(context);

            // Write it
            await proposalService.AddCommentAsync(userId, proposalId, request.Content, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.PreparesCompetitions)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

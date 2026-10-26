using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Selection;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints of the problem selection, each organization's selection at its own address: one read
/// returning the whole of it, one returning its discussions, one returning how far the caller has seen them, and
/// one write per change a reviewer makes. Every route is gated by the
/// <see cref="AuthorizationPolicies.OrganizationMember"/> policy, since the proposals are problems no student
/// may see.
/// </summary>
public static class ProblemSelectionEndpoints
{
    /// <summary>
    /// The path each organization's selection hangs off.
    /// </summary>
    private const string OrganizationsPath = "/problem-selection";

    /// <summary>
    /// The base path of one organization's selection, the organization named by its slug.
    /// </summary>
    private const string SelectionPath =
        $"{OrganizationsPath}/{{{OrganizationMemberRequirement.OrganizationRouteValue}}}";

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
    /// The path of how far the caller has seen the selection's discussions, below the base path.
    /// </summary>
    private const string DiscussionsSeenPath = $"{SelectionPath}/comments/seen";

    /// <summary>
    /// Maps the <c>/problem-selection</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapProblemSelectionEndpoints(this IEndpointRouteBuilder app)
    {
        // Read the whole selection
        app.MapGet(SelectionPath, async (
            string organization,
            HttpContext context,
            IUserManager userManager,
            IProblemSelectionService selectionService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer reading the selection
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // The organization's selection, its cycles named in the caller's language
            var selection = await selectionService.GetSelectionAsync(
                organization, reviewerId, EndpointHelpers.GetRequestLanguage(), cancellationToken);

            // Return it
            return Results.Ok(selection);
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Read every discussion the selection holds
        app.MapGet($"{SelectionPath}/comments", async (
            string organization,
            HttpContext context,
            IUserManager userManager,
            ISelectionDiscussionService discussionService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer reading the discussions
            var viewer = await CommentEndpoints.RequireViewerAsync(userManager, context);

            // The discussions of every proposal and paper the organization's selection holds
            var discussions = await discussionService.GetDiscussionsAsync(organization, viewer, cancellationToken);

            // Return the discussions
            return Results.Ok(discussions);
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Read how far the caller has seen every discussion the selection holds
        app.MapGet(DiscussionsSeenPath, async (
            string organization,
            HttpContext context,
            IUserManager userManager,
            ISelectionDiscussionService discussionService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer reading
            var viewer = await CommentEndpoints.RequireViewerAsync(userManager, context);

            // How far the reviewer has seen each discussion, beside what somebody else posted in it since
            var discussionsSeen = await discussionService.GetDiscussionsSeenAsync(
                organization, viewer, cancellationToken);

            // Return it
            return Results.Ok(discussionsSeen);
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Mark some of the discussions as seen by the caller, each up to its own moment
        app.MapPut(DiscussionsSeenPath, async (
            string organization,
            MarkDiscussionsSeenRequest request,
            HttpContext context,
            IUserManager userManager,
            ISelectionDiscussionService discussionService,
            CancellationToken cancellationToken) =>
        {
            // A body leaving out either kind of discussion is not a request that can be read
            if (request is not { Proposals: { } proposals, Papers: { } papers })
                throw new BadHttpRequestException("A mark must name its proposals and its papers.");

            // The reviewer who saw the discussions
            var viewer = await CommentEndpoints.RequireViewerAsync(userManager, context);

            // Mark the discussions as seen
            var marked = await discussionService.MarkDiscussionsSeenAsync(
                organization, viewer, proposals, papers, cancellationToken);

            // Return each discussion marked, with the moment it is now seen at least up to
            return Results.Ok(marked);
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Put a proposal into a slot
        app.MapPut(SlotPath, async (
            string organization,
            Guid boardId,
            Guid paperId,
            int index,
            PlaceProposalRequest request,
            HttpContext context,
            IUserManager userManager,
            ISelectionBoardService boardService,
            CancellationToken cancellationToken) =>
        {
            // A placement naming no proposal names nothing to place
            if (request.ProposalId is not { } proposalId)
                throw new BadHttpRequestException("A placement must name the proposal.");

            // The reviewer placing the proposal
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Place it
            await boardService.PlaceAsync(
                organization, reviewerId, new SlotAddress(boardId, paperId, index), proposalId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Empty a slot
        app.MapDelete(SlotPath, async (
            string organization,
            Guid boardId,
            Guid paperId,
            int index,
            HttpContext context,
            IUserManager userManager,
            ISelectionBoardService boardService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer emptying the slot
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Empty it
            await boardService.ClearSlotAsync(
                organization, reviewerId, new SlotAddress(boardId, paperId, index), cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Trade a slot with its neighbour
        app.MapPost($"{SlotPath}/move", async (
            string organization,
            Guid boardId,
            Guid paperId,
            int index,
            MoveSlotRequest request,
            HttpContext context,
            IUserManager userManager,
            ISelectionBoardService boardService,
            CancellationToken cancellationToken) =>
        {
            // A move naming no direction names no neighbour to trade with
            if (request.Direction is not { } direction)
                throw new BadHttpRequestException("A move must say which way it goes.");

            // The reviewer trading the slots
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Trade them
            await boardService.MoveSlotAsync(
                organization, reviewerId, new SlotAddress(boardId, paperId, index), direction, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Finalize a board into a cycle's rounds
        app.MapPost($"{SelectionPath}/boards/{{boardId:guid}}/finalization", async (
            string organization,
            Guid boardId,
            FinalizeBoardRequest request,
            IBoardFinalizationService finalization,
            CancellationToken cancellationToken) =>
        {
            // A finalization naming no cycle has nowhere to put the papers
            if (request.CycleId is not { } cycleId)
                throw new BadHttpRequestException("A finalization must name the cycle.");

            // Finalize it
            await finalization.FinalizeAsync(organization, boardId, cycleId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Set a proposal aside, or bring it back
        app.MapPut($"{ProposalPath}/set-aside", async (
            string organization,
            Guid proposalId,
            SetAsideRequest request,
            HttpContext context,
            IUserManager userManager,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // A change saying neither way changes nothing
            if (request.IsSetAside is not { } isSetAside)
                throw new BadHttpRequestException("The change must say whether the proposal is set aside.");

            // The reviewer setting it aside or bringing it back
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Change it
            await proposalService.SetAsideAsync(organization, reviewerId, proposalId, isSetAside, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Recommend a proposal for one category, or take it back
        app.MapPut($"{ProposalPath}/recommended", async (
            string organization,
            Guid proposalId,
            SetRecommendedRequest request,
            HttpContext context,
            IUserManager userManager,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // A change naming no category, or saying neither way, changes nothing
            if (request is not { Category: { } category, IsRecommended: { } isRecommended })
                throw new BadHttpRequestException("The change must name the category and say which way it goes.");

            // The reviewer switching the category
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Change it
            await proposalService.SetRecommendedAsync(
                organization, reviewerId, proposalId, category, isRecommended, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Rate a proposal, or take the rating back
        app.MapPut($"{ProposalPath}/rating", async (
            string organization,
            Guid proposalId,
            SetRatingRequest request,
            HttpContext context,
            IUserManager userManager,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // The caller, whose rating it is
            var raterId = await userManager.RequireUserIdAsync(context);

            // Change it
            await proposalService.RateAsync(
                organization, proposalId, raterId, request.Beauty, request.Difficulty, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Delete a proposal from the selection
        app.MapDelete(ProposalPath, async (
            string organization,
            Guid proposalId,
            HttpContext context,
            IUserManager userManager,
            IProposalService proposalService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer deleting it
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Delete it
            await proposalService.DeleteAsync(organization, reviewerId, proposalId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.OrganizationMember)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

using System.Collections.Immutable;
using System.Data;
using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.Contracts.Users;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Organizations;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="IProblemSelectionService"/> over the database, the discussions through the comment service.
/// The selection read takes in every hosted group that has not opened, since a finalized board's slots read off its
/// group's rounds.
/// </summary>
/// <param name="dbContextFactory">Creates the context each read runs on.</param>
/// <param name="localization">The names the taxonomy gives the groups' nodes.</param>
/// <param name="members">Reads when each conversation's author became a member of the MathComps organization.</param>
/// <param name="comments">Reads the discussions of what the selection holds.</param>
public sealed class ProblemSelectionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService localization,
    IOrganizationMemberService members,
    ICommentService comments)
    : IProblemSelectionService
{
    /// <summary>
    /// One of a problem's texts, as the database holds it.
    /// </summary>
    /// <param name="DocumentType"><inheritdoc cref="ProblemText.DocumentType" path="/summary"/></param>
    /// <param name="Language"><inheritdoc cref="ProblemText.Language" path="/summary"/></param>
    /// <param name="Body">
    /// The text as markdown, the raw source standing in on a row that carries none; null on a row holding neither.
    /// </param>
    private sealed record ProblemBody(DocumentType DocumentType, Language Language, string? Body);

    /// <inheritdoc/>
    public async Task<SelectionDto> GetSelectionAsync(
        Guid reviewerId, Language language, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // One snapshot for every query below, so the selection reads as it stood at one instant.
        await using var snapshot = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.RepeatableRead, cancellationToken);

        // One instant for everything the read weighs against a group opening.
        var now = DateTimeOffset.UtcNow;

        // Every group that has not opened, soonest first, its rounds in the taxonomy's order with what each holds.
        var groups = await dbContext.HostedGroups
            .AsNoTracking()
            .Where(group => group.OpensAt > now)
            .OrderBy(group => group.OpensAt)
            .Select(group => new
            {
                group.Id,
                group.OpensAt,
                group.ClosesAt,
                group.ProblemCount,
                Rounds = group.Rounds
                    .OrderBy(round => round.Competition.SortPath)
                    .Select(round => new
                    {
                        CompetitionPath = round.Competition.Path,
                        Problems = round.Problems
                            .OrderBy(problem => problem.Number)
                            .Select(problem => problem.Id)
                            .ToList(),
                    })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // Every proposal not deleted and outside the groups that have opened, lowest number first, with where its
        // problem sits, every text it carries, the language it was first written in, and every rating it was given,
        // by the raters' usernames with a rater showing none last. Split, because the texts and the ratings are two
        // collections off one row: joined in a single query the database would return every pairing of them, each
        // repeating the text.
        var proposals = await dbContext.Proposals
            .AsNoTracking()
            .AsSplitQuery()
            .WhereSelectionMayHold(now)
            .OrderBy(proposal => proposal.Number)
            .Select(proposal => new
            {
                proposal.ProblemId,
                proposal.Number,
                proposal.Title,
                proposal.Area,
                proposal.Recommended,
                proposal.IsSetAside,
                CompetitionPath = proposal.Problem.Round.Competition.Path,
                GroupOpensAt = (DateTimeOffset?)proposal.Problem.Round.HostedGroup!.OpensAt,
                Texts = proposal.Problem.Texts
                    .Select(text => new ProblemBody(
                        text.DocumentType, text.Language, text.MarkdownText ?? text.RawText))
                    .ToList(),
                OriginalLanguage = proposal.Problem.Texts
                    .Where(text => text.IsOriginal)
                    .Select(text => (Language?)text.Language)
                    .FirstOrDefault(),
                Ratings = proposal.Ratings
                    .OrderBy(rating => rating.User.IsDeleted ? null : rating.User.Username)
                    .ThenBy(rating => rating.UserId)
                    .Select(rating => new ProposalRatingDto(
                        new UserIdentityDto(
                            rating.UserId, rating.User.IsDeleted ? null : rating.User.Username, rating.User.Email),
                        rating.UserId == reviewerId,
                        rating.Beauty,
                        rating.Difficulty))
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // Each group's name in the language asked for, keyed by the group.
        var groupNames = groups.ToDictionary(
            group => group.Id,
            group => HostedGroupName.Of(localization, group.Rounds.FirstOrDefault()?.CompetitionPath)[language]);

        // The proposals still in the selection.
        var selected = proposals
            .Where(proposal => SelectionRules.IsInSelection(proposal.CompetitionPath, proposal.GroupOpensAt, now))
            .ToList();

        // The selected proposals' ids.
        var selectedIds = selected.Select(proposal => proposal.ProblemId).ToList();

        // Every conversation held about a selected proposal, newest first, with how much was said and whether the
        // statement it was argued against is one the problem still has in some language.
        var conversations = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => selectedIds.Contains(defense.ProblemId))
            .OrderByDescending(defense => defense.DefenseSession.CreatedAt)
            .Select(defense => new ReviewConversationDto(
                defense.DefenseSessionId,
                defense.ProblemId,
                new UserIdentityDto(
                    defense.DefenseSession.UserId,
                    defense.DefenseSession.User.IsDeleted ? null : defense.DefenseSession.User.Username,
                    defense.DefenseSession.User.Email),
                defense.DefenseSession.CreatedAt,
                defense.DefenseSession.Turns.Count,
                !defense.Problem.Texts.Any(text => text.DocumentType == DocumentType.Statement
                    && (text.MarkdownText ?? text.RawText) == defense.DefenseSession.ProblemStatement)))
            .ToListAsync(cancellationToken);

        // Every board with its papers and their slot rows, oldest first.
        var boards = await dbContext.SelectionBoards
            .AsNoTracking()
            .OrderBy(board => board.CreatedAt)
            .Select(board => new
            {
                board.Id,
                board.Name,
                board.HostedGroupId,
                GroupOpensAt = (DateTimeOffset?)board.HostedGroup!.OpensAt,
                Papers = board.Papers
                    .OrderBy(paper => paper.Position)
                    .Select(paper => new
                    {
                        paper.Id,
                        paper.Name,
                        paper.Category,
                        paper.SlotCount,
                        Slots = paper.Slots.Select(slot => new { slot.Position, slot.ProblemId }).ToList(),
                    })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // The groups that have not opened, by id.
        var groupsById = groups.ToDictionary(group => group.Id);

        // When each conversation's author became a member of the MathComps organization, for those who still are.
        var memberSince = await members.GetMemberSinceAsync(
            [.. conversations.Select(conversation => conversation.Author.Id).Distinct()],
            Organization.MathCompsSlug,
            cancellationToken);

        // Only the conversations the reviewers held.
        var reviewersConversations = conversations
            .Where(conversation => SelectionRules.IsReviewersConversation(
                memberSince.TryGetValue(conversation.Author.Id, out var since) ? since : null,
                conversation.StartedAt))
            .ToList();

        // Whether the MathComps organization's problems need every language.
        var needsEveryLanguage = await dbContext.Organizations
            .Where(organization => organization.Slug == Organization.MathCompsSlug)
            .Select(organization => organization.NeedsEveryLanguage)
            .SingleAsync(cancellationToken);

        // The selection.
        return new SelectionDto(
            [
                .. selected.Select(proposal => new ProposalDto(
                    proposal.ProblemId,
                    proposal.Number,
                    proposal.Title,
                    proposal.Area,
                    proposal.Recommended,
                    TextsOf(proposal.Texts),
                    proposal.OriginalLanguage,
                    proposal.IsSetAside,
                    IsUsed: !SelectionRules.IsInPool(proposal.CompetitionPath),
                    proposal.Ratings)),
            ],
            [
                // Drafts, and the boards finalized into a group that has not opened
                .. boards
                    .Where(board => SelectionRules.IsBoardInSelection(board.GroupOpensAt, now))
                    .Select(board => new SelectionBoardDto(
                        board.Id,
                        board.Name,
                        [
                            .. board.Papers.Select(paper => new SelectionPaperDto(
                                paper.Id,
                                paper.Name,
                                paper.Category,
                                // The paper's slots, by whether its board has been finalized
                                board.HostedGroupId is { } groupId
                                    // A finalized paper's slots are its group's round of the paper's category,
                                    // empty where the group runs none
                                    ? groupsById[groupId].Rounds
                                        .FirstOrDefault(round =>
                                            HostedTaxonomy.CategoryOf(round.CompetitionPath) == paper.Category)
                                        ?.Problems.Select(problemId => (Guid?)problemId).ToList()
                                    ?? [.. Enumerable.Repeat<Guid?>(null, paper.SlotCount)]
                                    // A draft paper's slots are its slot rows, an empty slot holding none
                                    : [
                                        .. Enumerable.Range(0, paper.SlotCount).Select(index => paper.Slots
                                            .FirstOrDefault(slot => slot.Position == index)?.ProblemId),
                                    ])),
                        ],
                        // The group the board filled, named the way the cycles are; none on a draft
                        board.HostedGroupId is { } finalizedInto
                            ? new BoardFinalizationDto(groupNames[finalizedInto], groupsById[finalizedInto].OpensAt)
                            : null)),
            ],
            [
                // The groups a board can still be finalized into
                .. groups
                    .Where(group => SelectionRules.TakesBoard(
                        group.OpensAt,
                        group.ClosesAt,
                        [.. group.Rounds.Select(round => round.Problems.Count)],
                        now))
                    .Select(group => new SelectionCycleDto(
                        group.Id,
                        groupNames[group.Id],
                        group.OpensAt,
                        [
                            .. group.Rounds
                                .Select(round => HostedTaxonomy.CategoryOf(round.CompetitionPath))
                                .OfType<HostedCompetitionCategory>(),
                        ],
                        group.ProblemCount)),
            ],
            reviewersConversations,
            needsEveryLanguage);
    }

    /// <inheritdoc/>
    public async Task<SelectionDiscussionsDto> GetDiscussionsAsync(
        CommentViewer viewer, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // One instant for everything the read weighs against a group opening.
        var now = DateTimeOffset.UtcNow;

        // Every proposal not deleted and outside the groups that have opened, with where its problem sits.
        var proposals = await dbContext.Proposals
            .AsNoTracking()
            .WhereSelectionMayHold(now)
            .Select(proposal => new
            {
                proposal.ProblemId,
                CompetitionPath = proposal.Problem.Round.Competition.Path,
                GroupOpensAt = (DateTimeOffset?)proposal.Problem.Round.HostedGroup!.OpensAt,
            })
            .ToListAsync(cancellationToken);

        // The proposals the selection still holds, each as the id its discussion goes by.
        var proposalIds = proposals
            .Where(proposal => SelectionRules.IsInSelection(proposal.CompetitionPath, proposal.GroupOpensAt, now))
            .Select(proposal => proposal.ProblemId.ToString())
            .ToImmutableList();

        // Every paper, with when the group its board was finalized into opens.
        var papers = await dbContext.SelectionPapers
            .AsNoTracking()
            .Select(paper => new { paper.Id, GroupOpensAt = (DateTimeOffset?)paper.Board.HostedGroup!.OpensAt })
            .ToListAsync(cancellationToken);

        // The papers on a board the selection still holds, each as the id its discussion goes by.
        var paperIds = papers
            .Where(paper => SelectionRules.IsBoardInSelection(paper.GroupOpensAt, now))
            .Select(paper => paper.Id.ToString())
            .ToImmutableList();

        // The proposals' discussions, by the proposal.
        var proposalThreads = comments.GetThreadsAsync(
            CommentTargetType.Proposal, proposalIds, viewer, cancellationToken);

        // The papers' discussions, by the paper.
        var paperThreads = comments.GetThreadsAsync(
            CommentTargetType.SelectionPaper, paperIds, viewer, cancellationToken);

        // Wait for both reads, started together since neither needs the other.
        await Task.WhenAll(proposalThreads, paperThreads);

        // Each kind's discussions, by what they hang off.
        return new SelectionDiscussionsDto(await proposalThreads, await paperThreads);
    }

    /// <summary>
    /// Reads a problem's texts as a reviewer reads them: one entry per language it has a statement in.
    /// </summary>
    /// <param name="bodies">Every text the problem carries.</param>
    /// <returns>Its text in each language it has a statement in, keyed by that language.</returns>
    private static Dictionary<Language, ProposalTextDto> TextsOf(IReadOnlyList<ProblemBody> bodies) =>
        // One entry per language the problem has a statement in
        bodies
            .SelectMany<ProblemBody, KeyValuePair<Language, ProposalTextDto>>(body =>
                // Only a statement carrying a body gives its language an entry
                body is { DocumentType: DocumentType.Statement, Body: { } statement }
                    // The entry, with the solution and hints in the statement's language
                    ?
                    [
                        KeyValuePair.Create(body.Language, new ProposalTextDto(
                            statement,
                            BodyIn(bodies, DocumentType.Solution, body.Language),
                            HintsDocument.Split(BodyIn(bodies, DocumentType.Hints, body.Language)))),
                    ]
                    // Any other text gives none
                    : [])
            .ToDictionary();

    /// <summary>
    /// Picks one kind of text in one language out of a problem's texts.
    /// </summary>
    /// <param name="bodies">Every text the problem carries.</param>
    /// <param name="documentType">The kind wanted.</param>
    /// <param name="language">The language wanted.</param>
    /// <returns>The text, or null where the problem carries none.</returns>
    private static string? BodyIn(IReadOnlyList<ProblemBody> bodies, DocumentType documentType, Language language) =>
        // The one row of that kind in that language, a problem text being unique in the two
        bodies.FirstOrDefault(body => body.DocumentType == documentType && body.Language == language)?.Body;
}

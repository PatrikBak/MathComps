using System.Data;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="IProblemSelectionService"/> over the database. The hosted groups that have not opened are
/// read first, since they decide which finalized boards are still in play and which proposals have left the
/// selection with an opened one.
/// </summary>
/// <param name="dbContextFactory">Creates the context the read runs on.</param>
/// <param name="localization">The names the taxonomy gives the groups' nodes.</param>
public sealed class ProblemSelectionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService localization)
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
        Language language, CancellationToken cancellationToken = default)
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
        // problem sits and every text it carries.
        var proposals = await dbContext.Proposals
            .AsNoTracking()
            .Where(proposal => proposal.DeletedAt == null
                && (proposal.Problem.Round.HostedGroupId == null || proposal.Problem.Round.HostedGroup!.OpensAt > now))
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
                proposal.Problem.Round.HostedGroupId,
                Texts = proposal.Problem.Texts
                    .Select(text => new ProblemBody(
                        text.DocumentType, text.Language, text.MarkdownText ?? text.RawText))
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // Each group's name in the language asked for, keyed by the group.
        var groupNames = groups.ToDictionary(
            group => group.Id,
            group => HostedGroupName.Of(localization, group.Rounds.FirstOrDefault()?.CompetitionPath)[language]);

        // The proposals still in the selection: in the pool, or in a round of a group that has not opened.
        var selected = proposals
            .Where(proposal => SelectionRules.IsInPool(proposal.CompetitionPath)
                || (proposal.HostedGroupId is { } groupId && groupNames.ContainsKey(groupId)))
            .ToList();

        // The selected proposals' ids.
        var selectedIds = selected.Select(proposal => proposal.ProblemId).ToList();

        // Every conversation held about a selected proposal, newest first, with everything said in it.
        var conversations = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => selectedIds.Contains(defense.ProblemId))
            .OrderByDescending(defense => defense.DefenseSession.CreatedAt)
            .Select(defense => new ReviewConversationDto(
                defense.DefenseSessionId,
                defense.ProblemId,
                defense.DefenseSession.User.IsDeleted ? null : defense.DefenseSession.User.Username,
                defense.DefenseSession.CreatedAt,
                defense.DefenseSession.ProblemStatement,
                defense.DefenseSession.Turns
                    .OrderBy(turn => turn.Sequence)
                    .Select(turn => new DefenseTurnDto(turn.Id, turn.Role, turn.Content, turn.CreatedAt))
                    .ToList()))
            .ToListAsync(cancellationToken);

        // Every live comment under a selected proposal, oldest first, with the proposal it sits under.
        var comments = await dbContext.ProposalComments
            .AsNoTracking()
            .Where(link => selectedIds.Contains(link.ProposalId) && link.Comment.Status == CommentStatus.Active)
            .OrderBy(link => link.Comment.CreatedAt)
            .Select(link => new
            {
                link.ProposalId,
                Comment = new ReviewCommentDto(
                    link.CommentId,
                    link.Comment.Author.IsDeleted ? null : link.Comment.Author.Username,
                    link.Comment.Content,
                    link.Comment.CreatedAt),
            })
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
                    proposal.IsSetAside,
                    IsUsed: !SelectionRules.IsInPool(proposal.CompetitionPath))),
            ],
            [
                // Drafts, and the boards finalized into a group that has not opened
                .. boards
                    .Where(board => board.HostedGroupId is null || groupsById.ContainsKey(board.HostedGroupId.Value))
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
            conversations,
            comments
                .GroupBy(row => row.ProposalId)
                .ToDictionary(
                    thread => thread.Key,
                    IReadOnlyList<ReviewCommentDto> (thread) => [.. thread.Select(row => row.Comment)]));
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

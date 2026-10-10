using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Seeds the problem selection: the pool's problems parked in a proposals round, the hosted groups a board can be
/// finalized into, and the boards themselves. Every text is invented and named after what it is, so a wrong one
/// reads as wrong.
/// </summary>
public static class SelectionSeed
{
    /// <summary>
    /// The year the seeded season starts in.
    /// </summary>
    private const int SeasonYear = 2026;

    /// <summary>
    /// The paths of the competitions one group's rounds hang off, one per category in the order the categories run.
    /// </summary>
    /// <param name="month">The group's node under each category (e.g. <c>october</c>).</param>
    /// <returns>The paths.</returns>
    public static string[] RoundPaths(string month) =>
        // Every category's node for that month
        [
            $"{HostedTaxonomy.RootSlug}-elementary-{month}",
            $"{HostedTaxonomy.RootSlug}-intermediate-{month}",
            $"{HostedTaxonomy.RootSlug}-advanced-{month}",
        ];

    /// <summary>
    /// Tracks a season for the seeded rounds to sit in.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <returns>The season.</returns>
    public static Season NewSeason(MathCompsDbContext context)
    {
        // The season row
        var season = new Season
        {
            Id = Guid.CreateVersion7(),
            StartYear = SeasonYear,
            EditionNumber = Season.EditionFromStartYear(SeasonYear),
        };
        context.Seasons.Add(season);

        // The tracked season
        return season;
    }

    /// <summary>
    /// Tracks the round of the proposals node the pool's problems are parked in.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season it sits in.</param>
    /// <returns>The round.</returns>
    public static Round NewProposalsRound(MathCompsDbContext context, Season season)
    {
        // The round, kept back from readers the way the real one is
        var round = new Round
        {
            Id = Guid.CreateVersion7(),
            CompetitionId = CompetitionTreeSeed.Chain(context, HostedTaxonomy.ProposalsPath).Id,
            SeasonId = season.Id,
            Date = new DateOnly(SeasonYear, 9, 1),
            VisibleSince = HostedTaxonomy.ProposalsVisibleSince,
        };
        context.Rounds.Add(round);

        // The tracked round
        return round;
    }

    /// <summary>
    /// Tracks one problem in a round, written in the languages given, and the proposal filing it in the pool.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="round">The round it sits in.</param>
    /// <param name="number">
    /// The proposal's <see cref="Proposal.Number"/>, which its title and the problem's texts name too.
    /// </param>
    /// <param name="position"><inheritdoc cref="Problem.Number" path="/summary"/></param>
    /// <param name="languages">
    /// The languages it carries a statement and a solution in; every language the site is read in when none are
    /// given.
    /// </param>
    /// <returns>The problem's id, which is also the proposal's.</returns>
    public static Guid NewProposal(
        MathCompsDbContext context, Round round, int number, int position, params Language[] languages)
    {
        // The problem, at its position in the round
        var problemId = Guid.CreateVersion7();
        context.Problems.Add(new Problem
        {
            Id = problemId,
            RoundId = round.Id,
            Number = position,
            Slug = $"seeded-{round.Id:N}-{position}",
        });

        // A statement and a solution in each language the problem is written in
        foreach (var language in languages.Length > 0 ? languages : Enum.GetValues<Language>())
            foreach (var documentType in new[] { DocumentType.Statement, DocumentType.Solution })
                context.ProblemTexts.Add(NewText(problemId, documentType, language, number));

        // The proposal filing the problem in the pool, under a number of its own
        context.Proposals.Add(new Proposal
        {
            ProblemId = problemId,
            Number = number,
            Title = $"Proposal {number}",
            Area = ProposalArea.Algebra,
            Recommended = [],
        });

        // The id
        return problemId;
    }

    /// <summary>
    /// Builds one text of a problem, named after what it is, the English one marked as the original.
    /// </summary>
    /// <param name="problemId">The problem.</param>
    /// <param name="documentType"><inheritdoc cref="ProblemText.DocumentType" path="/summary"/></param>
    /// <param name="language"><inheritdoc cref="ProblemText.Language" path="/summary"/></param>
    /// <param name="number">The number the text names.</param>
    /// <returns>The text.</returns>
    public static ProblemText NewText(Guid problemId, DocumentType documentType, Language language, int number) =>
        // A text saying what it is
        new()
        {
            Id = Guid.CreateVersion7(),
            ProblemId = problemId,
            DocumentType = documentType,
            Language = language,
            MarkdownText = $"{documentType} {number} in {language}",
            IsOriginal = language == Language.EN,
            DateModified = DateTime.UtcNow,
        };

    /// <summary>
    /// Tracks a hosted group of four problems a paper, with one empty round per category.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season its rounds sit in.</param>
    /// <param name="month">The group's node under each category (e.g. <c>october</c>).</param>
    /// <param name="opensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
    /// <returns>The group, its rounds tracked beside it.</returns>
    public static HostedGroup NewGroup(
        MathCompsDbContext context, Season season, string month, DateTimeOffset opensAt)
    {
        // The group, closing a fortnight after it opens
        var group = HostedSeed.NewGroup(context, $"mc-{month}", opensAt, opensAt.AddDays(14));

        // Four problems a round, as many as a seeded board's papers have slots
        group.ProblemCount = 4;

        // One empty round per category
        foreach (var path in RoundPaths(month))
            HostedSeed.NewRound(context, season, group, Guid.CreateVersion7(), path);

        // The tracked group
        return group;
    }

    /// <summary>
    /// Tracks a draft board with one paper per category, each of four slots, filled from the ids given.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="name"><inheritdoc cref="SelectionBoard.Name" path="/summary"/></param>
    /// <param name="slots">
    /// What stands in each slot, paper after paper in the order the categories run; null for an empty slot.
    /// Missing trailing entries stand empty.
    /// </param>
    /// <returns>The board, its papers tracked beside it.</returns>
    public static SelectionBoard NewBoard(MathCompsDbContext context, string name, params Guid?[] slots)
    {
        // The board
        var board = new SelectionBoard { Id = Guid.CreateVersion7(), Name = name, CreatedAt = DateTimeOffset.UtcNow };
        context.SelectionBoards.Add(board);

        // The categories, in the order they run
        var categories = Enum.GetValues<HostedCompetitionCategory>();

        // One paper per category
        foreach (var position in Enumerable.Range(0, categories.Length))
        {
            // The paper
            var paper = new SelectionPaper
            {
                Id = Guid.CreateVersion7(),
                BoardId = board.Id,
                Position = position,
                Name = categories[position].ToString(),
                Category = categories[position],
                SlotCount = 4,
            };
            context.SelectionPapers.Add(paper);

            // The paper's filled slots, read off its run of the ids given
            foreach (var index in Enumerable.Range(0, paper.SlotCount))
                if (slots.ElementAtOrDefault((position * paper.SlotCount) + index) is { } problemId)
                    context.SelectionSlots.Add(
                        new SelectionSlot { PaperId = paper.Id, Position = index, ProblemId = problemId });
        }

        // The tracked board
        return board;
    }
}

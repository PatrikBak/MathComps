using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Seeds the problem selection: the pool's problems parked in a proposals round, the hosted groups a board can be
/// finalized into, the boards themselves, and the organizations picking the problems with the addresses on their
/// lists. Every text is invented and named after what it is, so a wrong one reads as wrong.
/// </summary>
public static class SelectionSeed
{
    /// <summary>
    /// The year the seeded season starts in.
    /// </summary>
    private const int SeasonYear = 2026;

    /// <summary>
    /// The paths of the competitions one group's rounds hang off, one per hosted level in the order the levels run.
    /// </summary>
    /// <param name="month">The group's node under each hosted level (e.g. <c>october</c>).</param>
    /// <returns>The paths.</returns>
    public static string[] RoundPaths(string month) =>
        // Every hosted level's node for that month
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
    /// Reads the id of the MathComps organization, which the migrations create.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <returns>The id.</returns>
    public static Guid MathCompsId(MathCompsDbContext context) =>
        // The one organization the slug names
        context.Organizations.Single(organization => organization.Slug == Organization.MathCompsSlug).Id;

    /// <summary>
    /// Tracks an address on the MathComps organization's list, which makes the account carrying it one of the people
    /// preparing the competitions (see <see cref="Organization.MathCompsSlug"/>).
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="email"><inheritdoc cref="OrganizationMember.Email" path="/summary"/></param>
    /// <param name="addedAt"><inheritdoc cref="OrganizationMember.AddedAt" path="/summary"/></param>
    public static void NewMember(MathCompsDbContext context, string email, DateTimeOffset addedAt) =>
        // The address on MathComps' list since the instant given
        NewMember(context, MathCompsId(context), email, addedAt);

    /// <summary>
    /// Tracks an address on an organization's list, which makes the account carrying it a member.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="organizationId">The organization whose list it goes on.</param>
    /// <param name="email"><inheritdoc cref="OrganizationMember.Email" path="/summary"/></param>
    /// <param name="addedAt"><inheritdoc cref="OrganizationMember.AddedAt" path="/summary"/></param>
    public static void NewMember(
        MathCompsDbContext context, Guid organizationId, string email, DateTimeOffset addedAt) =>
        // The address on the list since the instant given
        context.OrganizationMembers.Add(
            new OrganizationMember { OrganizationId = organizationId, Email = email, AddedAt = addedAt });

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
    /// Tracks one problem in a round, written in the languages given, and the proposal filing it in MathComps' pool.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="round">
    /// <inheritdoc cref="NewProposal(MathCompsDbContext, Guid, Round, int, int, Language[])"
    ///     path="/param[@name='round']"/>
    /// </param>
    /// <param name="number">
    /// <inheritdoc cref="NewProposal(MathCompsDbContext, Guid, Round, int, int, Language[])"
    ///     path="/param[@name='number']"/>
    /// </param>
    /// <param name="position"><inheritdoc cref="Problem.Number" path="/summary"/></param>
    /// <param name="languages">
    /// <inheritdoc cref="NewProposal(MathCompsDbContext, Guid, Round, int, int, Language[])"
    ///     path="/param[@name='languages']"/>
    /// </param>
    /// <returns>The problem's id, which is also the proposal's.</returns>
    public static Guid NewProposal(
        MathCompsDbContext context, Round round, int number, int position, params Language[] languages) =>
        // Filed in MathComps' pool
        NewProposal(context, MathCompsId(context), round, number, position, languages);

    /// <summary>
    /// Tracks one problem in a round, written in the languages given, and the proposal filing it in an
    /// organization's pool.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="organizationId">The organization whose pool the proposal is in.</param>
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
        MathCompsDbContext context,
        Guid organizationId,
        Round round,
        int number,
        int position,
        params Language[] languages)
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

        // The proposal filing the problem in the organization's pool, under a number of its own
        context.Proposals.Add(new Proposal
        {
            ProblemId = problemId,
            OrganizationId = organizationId,
            Number = number,
            Title = $"Proposal {number}",
            Area = ProposalArea.Algebra,
        });

        // The id
        return problemId;
    }

    /// <summary>
    /// Tracks the recommendations of a proposal for some of the MathComps organization's categories.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="proposalId">The proposal, which is its problem's id.</param>
    /// <param name="categories">The categories, by name.</param>
    public static void Recommend(MathCompsDbContext context, Guid proposalId, params string[] categories)
    {
        // One recommendation per category named
        foreach (var category in categories)
            context.ProposalRecommendations.Add(
                new ProposalRecommendation { ProposalId = proposalId, CategoryId = CategoryId(context, category) });
    }

    /// <summary>
    /// Tracks an organization other than MathComps, whose members the caller puts on its list, listing categories of
    /// its own that no hosted round runs, its problems needing any one language.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="slug"><inheritdoc cref="Organization.Slug" path="/summary"/></param>
    /// <param name="categories">Its categories by name, in the order they run.</param>
    /// <returns>The organization's id.</returns>
    public static Guid NewOrganization(MathCompsDbContext context, string slug, params string[] categories)
    {
        // The organization
        var organization = new Organization { Slug = slug, NeedsEveryLanguage = false };
        context.Organizations.Add(organization);

        // Its categories, each at its place in the order given
        foreach (var position in Enumerable.Range(0, categories.Length))
            context.OrganizationCategories.Add(new OrganizationCategory
            {
                OrganizationId = organization.Id,
                Position = position,
                Name = categories[position],
            });

        // Its id
        return organization.Id;
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
    /// Tracks a hosted group of four problems a paper, with one empty round per hosted level.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season its rounds sit in.</param>
    /// <param name="month">The group's node under each hosted level (e.g. <c>october</c>).</param>
    /// <param name="opensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
    /// <returns>The group, its rounds tracked beside it.</returns>
    public static HostedGroup NewGroup(
        MathCompsDbContext context, Season season, string month, DateTimeOffset opensAt)
    {
        // The group, closing a fortnight after it opens
        var group = HostedSeed.NewGroup(context, $"mc-{month}", opensAt, opensAt.AddDays(14));

        // Four problems a round, as many as a seeded board's papers have slots
        group.ProblemCount = 4;

        // One empty round per hosted level
        foreach (var path in RoundPaths(month))
            HostedSeed.NewRound(context, season, group, Guid.CreateVersion7(), path);

        // The tracked group
        return group;
    }

    /// <summary>
    /// Tracks a draft board with one paper per category of the MathComps organization, each of four slots, filled
    /// from the ids given.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="name"><inheritdoc cref="SelectionBoard.Name" path="/summary"/></param>
    /// <param name="slots">
    /// <inheritdoc cref="NewBoard(MathCompsDbContext, Guid, string, Guid?[])" path="/param[@name='slots']"/>
    /// </param>
    /// <returns>The board, its papers tracked beside it.</returns>
    public static SelectionBoard NewBoard(MathCompsDbContext context, string name, params Guid?[] slots) =>
        // MathComps' own
        NewBoard(context, MathCompsId(context), name, slots);

    /// <summary>
    /// Tracks a draft board of an organization with one paper per category, each of four slots, filled from the ids
    /// given.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="organizationId">The organization picking its papers.</param>
    /// <param name="name"><inheritdoc cref="SelectionBoard.Name" path="/summary"/></param>
    /// <param name="slots">
    /// What stands in each slot, paper after paper in the order the categories run; null for an empty slot.
    /// Missing trailing entries stand empty.
    /// </param>
    /// <returns>The board, its papers tracked beside it.</returns>
    public static SelectionBoard NewBoard(
        MathCompsDbContext context, Guid organizationId, string name, params Guid?[] slots)
    {
        // The board, the organization's own
        var board = new SelectionBoard
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = organizationId,
            Name = name,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        context.SelectionBoards.Add(board);

        // The organization's categories already written, tracked beside any the seed has yet to write
        context.OrganizationCategories.Where(category => category.OrganizationId == organizationId).Load();

        // All of them, in the order they run
        var categories = context.OrganizationCategories.Local
            .Where(category => category.OrganizationId == organizationId)
            .OrderBy(category => category.Position)
            .ToList();

        // One paper per category
        foreach (var position in Enumerable.Range(0, categories.Count))
        {
            // The paper, named after its category
            var paper = new SelectionPaper
            {
                Id = Guid.CreateVersion7(),
                BoardId = board.Id,
                Position = position,
                Name = categories[position].Name,
                CategoryId = categories[position].Id,
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

    /// <summary>
    /// Reads the id of one of the MathComps organization's categories, which the migrations create.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="name"><inheritdoc cref="OrganizationCategory.Name" path="/summary"/></param>
    /// <returns>The category's id.</returns>
    private static Guid CategoryId(MathCompsDbContext context, string name) =>
        // The one MathComps category the name names
        context.OrganizationCategories
            .Single(category => category.OrganizationId == MathCompsId(context) && category.Name == name)
            .Id;
}

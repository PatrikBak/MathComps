using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Names what a defense conversation was held against, for the surfaces that read conversations back. The
/// naming happens once a page is in hand rather than in the query, since it reads the taxonomy and the
/// database knows nothing of it. The proposals among a page's problems are read in one query of their own, by
/// the problems the page names.
/// </summary>
public static class NamedDefenseTargets
{
    /// <summary>
    /// What the database holds about the problem a conversation was held against. A conversation carries one
    /// arm's columns and nulls for the other's, since it is held against one problem of one kind.
    /// </summary>
    /// <param name="HandoutContentId"><inheritdoc cref="NamedHandoutTarget.HandoutContentId" path="/summary"/></param>
    /// <param name="EnvironmentId"><inheritdoc cref="NamedHandoutTarget.EnvironmentId" path="/summary"/></param>
    /// <param name="ProblemId"><inheritdoc cref="NamedProblemTarget.ProblemId" path="/summary"/></param>
    /// <param name="ProblemSlug"><inheritdoc cref="NamedProblemTarget.Slug" path="/summary"/></param>
    /// <param name="ProblemNumber"><inheritdoc cref="Problem.Number" path="/summary"/></param>
    /// <param name="CompetitionPath"><inheritdoc cref="Competition.Path" path="/summary"/></param>
    /// <param name="EditionNumber"><inheritdoc cref="Season.EditionNumber" path="/summary"/></param>
    /// <param name="SeasonStartYear"><inheritdoc cref="Season.StartYear" path="/summary"/></param>
    public sealed record Columns(
        string? HandoutContentId,
        string? EnvironmentId,
        Guid? ProblemId,
        string? ProblemSlug,
        int? ProblemNumber,
        string? CompetitionPath,
        int? EditionNumber,
        int? SeasonStartYear);

    /// <summary>
    /// Reads the proposals among the problems some conversations were held against, each as the target that
    /// names it. A problem counts as one while its round hangs under
    /// <see cref="HostedTaxonomy.ProposalsPath"/>, deleted proposals included, since a deleted one keeps its row
    /// and its name.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="columns">What the database holds about each conversation's problem.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The proposals, by the id of the problem each one files.</returns>
    public static async Task<IReadOnlyDictionary<Guid, NamedProposalTarget>> LoadProposalsAsync(
        MathCompsDbContext dbContext, IEnumerable<Columns> columns, CancellationToken cancellationToken)
    {
        // The problems parked among the proposals
        var problemIds = columns
            .Where(column => column.CompetitionPath is { } path
                && TaxonomySlugs.IsAtOrUnder(path, HostedTaxonomy.ProposalsPath))
            .Select(column => column.ProblemId)
            .OfType<Guid>()
            .Distinct()
            .ToList();

        // None, so there is nothing to read
        if (problemIds.Count == 0)
            return new Dictionary<Guid, NamedProposalTarget>();

        // The proposals filing them, by the problem each one files
        return await dbContext.Proposals
            .AsNoTracking()
            .Where(proposal => problemIds.Contains(proposal.ProblemId))
            .Select(proposal => new NamedProposalTarget(
                proposal.ProblemId, proposal.Problem.Slug, proposal.Number, proposal.Title))
            .ToDictionaryAsync(proposal => proposal.ProblemId, cancellationToken);
    }

    /// <summary>
    /// Names what a conversation was held against, in the reader's language.
    /// </summary>
    /// <param name="localization">The resolver of localized display names.</param>
    /// <param name="language">The language to name it in.</param>
    /// <param name="columns"><inheritdoc cref="Columns" path="/summary"/></param>
    /// <param name="proposals">The proposals among the problems being named, as
    /// <see cref="LoadProposalsAsync"/> reads them.</param>
    /// <returns>The problem as a surface reading conversations back names it.</returns>
    public static NamedDefenseTarget Build(
        IMetadataLocalizationService localization,
        Language language,
        Columns columns,
        IReadOnlyDictionary<Guid, NamedProposalTarget> proposals)
    {
        // A handout problem, which the reader's own side names from content it already holds.
        if (columns is { HandoutContentId: { } handoutContentId, EnvironmentId: { } environmentId })
            return new NamedHandoutTarget(handoutContentId, environmentId);

        // A proposal, which no competition has set, so it goes by what the reviewers quote it by.
        if (columns.ProblemId is { } proposedProblemId && proposals.TryGetValue(proposedProblemId, out var proposal))
            return proposal;

        // An archive problem, named here since the taxonomy doesn't reach the reader.
        if (columns is
            {
                ProblemId: { } problemId,
                ProblemSlug: { } slug,
                ProblemNumber: { } number,
                CompetitionPath: { } competitionPath,
                EditionNumber: { } editionNumber,
                SeasonStartYear: { } startYear,
            })
        {
            // Where it comes from: when it ran, what it ran in, and where in that.
            var source = ProblemSources.Build(
                localization, editionNumber, startYear, competitionPath, number, language);

            // What addresses the competition it was set in, in the language being named in.
            var competitionSlug = HostedRoundSlug.Build(
                localization.GetNodeUrlSlugs(competitionPath)[language], startYear);

            // The problem, addressed by its id and by the competition and archive slugs.
            return new NamedProblemTarget(problemId, competitionSlug, slug, source);
        }

        // Neither arm came back, which the queries reading this are written to rule out.
        throw new ArgumentOutOfRangeException(
            nameof(columns), columns, "The conversation was held against neither a handout nor a problem.");
    }

    /// <summary>
    /// Reduces a problem to whatever addresses it, so options over both kinds can be put in one order.
    /// </summary>
    /// <param name="target"><inheritdoc cref="NamedDefenseTarget" path="/summary"/></param>
    /// <returns>The problem as one string.</returns>
    public static string Key(NamedDefenseTarget target) => target switch
    {
        // A handout problem files under its handout, the pair being what locates it.
        NamedHandoutTarget handout => $"{handout.HandoutContentId}:{handout.EnvironmentId}",

        // An archive problem is addressed by its slug alone, and so is a proposal.
        NamedProblemTarget problem => problem.Slug,
        NamedProposalTarget proposal => proposal.Slug,

        // A target nothing here knows, which is a bug rather than a problem with the data.
        _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
    };
}

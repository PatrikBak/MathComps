using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Selection;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Names the problem a defense conversation was held against or a photo handoff sends to, for the surfaces that show
/// it. The naming happens once the rows are in hand rather than in the query, since it reads the taxonomy and the
/// database knows nothing of it. The proposals among the rows' problems are read in one query of their own, by the
/// problems the rows name.
/// </summary>
public static class NamedDefenseTargets
{
    /// <summary>
    /// What the database holds about one defense problem, the one a conversation was held against or a photo handoff
    /// sends to. It carries one arm's columns and nulls for every other arm's, since it is one problem of one kind.
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
        int? SeasonStartYear)
    {
        /// <summary>
        /// The problem the columns hold, as a defense names it: the handout pair, or the archive problem's id.
        /// </summary>
        public DefenseTarget Target => this switch
        {
            // A handout problem, which both content ids locate.
            { HandoutContentId: { } handoutContentId, EnvironmentId: { } environmentId } =>
                new HandoutEnvironmentTarget(handoutContentId, environmentId),

            // An archive problem, which its id identifies outright.
            { ProblemId: { } problemId } => new ProblemTarget(problemId),

            // Neither arm came back, which the queries reading this are written to rule out.
            _ => throw new InvalidOperationException("The columns hold neither a handout nor a problem."),
        };
    }

    /// <summary>
    /// Reads the proposals among some defense problems, each as the target that names it. A problem counts as one
    /// while the selection holds it (<see cref="SelectionRules.IsInSelection"/>), deleted proposals included, since a
    /// deleted one keeps its row and its name.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="columns">What the database holds about each problem.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The proposals, by the id of the problem each one files.</returns>
    public static async Task<IReadOnlyDictionary<Guid, NamedProposalTarget>> LoadProposalsAsync(
        MathCompsDbContext dbContext, IEnumerable<Columns> columns, CancellationToken cancellationToken)
    {
        // The problems being named
        var problemIds = columns
            .Select(column => column.ProblemId)
            .OfType<Guid>()
            .Distinct()
            .ToList();

        // None, so there is nothing to read
        if (problemIds.Count == 0)
            return new Dictionary<Guid, NamedProposalTarget>();

        // The instant every group's opening is read against
        var now = DateTimeOffset.UtcNow;

        // The proposals filing them, each with its organization and where its problem sits
        var proposals = await dbContext.Proposals
            .AsNoTracking()
            .Where(proposal => problemIds.Contains(proposal.ProblemId))
            .Select(proposal => new
            {
                proposal.ProblemId,
                OrganizationSlug = proposal.Organization.Slug,
                proposal.Problem.Slug,
                proposal.Number,
                proposal.Title,
                CompetitionPath = proposal.Problem.Round.Competition.Path,
                GroupOpensAt = (DateTimeOffset?)proposal.Problem.Round.HostedGroup!.OpensAt,
            })
            .ToListAsync(cancellationToken);

        // The ones the selection still holds, by the problem each one files
        return proposals
            .Where(proposal => SelectionRules.IsInSelection(proposal.CompetitionPath, proposal.GroupOpensAt, now))
            .ToDictionary(
                proposal => proposal.ProblemId,
                proposal => new NamedProposalTarget(
                    proposal.ProblemId, proposal.OrganizationSlug, proposal.Slug, proposal.Number, proposal.Title));
    }

    /// <summary>
    /// Names a defense problem, in the reader's language.
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

        // A proposal the selection still holds, which goes by what the reviewers quote it by.
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
            nameof(columns), columns, "The columns hold neither a handout nor a problem.");
    }

    /// <summary>
    /// Reduces a problem to whatever addresses it, so options over every kind can be put in one order.
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

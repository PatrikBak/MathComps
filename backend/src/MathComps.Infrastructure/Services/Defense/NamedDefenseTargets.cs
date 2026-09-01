using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Problems;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Names what a defense conversation was held against, for the surfaces that read conversations back. The
/// naming happens once a page is in hand rather than in the query, since it reads the taxonomy and the
/// database knows nothing of it.
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
    /// Names what a conversation was held against, in the reader's language.
    /// </summary>
    /// <param name="localization">The resolver of localized display names.</param>
    /// <param name="language">The language to name it in.</param>
    /// <param name="columns"><inheritdoc cref="Columns" path="/summary"/></param>
    /// <returns>The problem as a surface reading conversations back names it.</returns>
    public static NamedDefenseTarget Build(
        IMetadataLocalizationService localization, Language language, Columns columns)
    {
        // A handout problem, which the reader's own side names from content it already holds.
        if (columns is { HandoutContentId: { } handoutContentId, EnvironmentId: { } environmentId })
            return new NamedHandoutTarget(handoutContentId, environmentId);

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

        // An archive problem is addressed by its slug alone.
        NamedProblemTarget problem => problem.Slug,

        // A target nothing here knows, which is a bug rather than a problem with the data.
        _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
    };
}

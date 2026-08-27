using System.Collections.Immutable;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Services.Localization;

namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// Says where a problem comes from, in the reader's language. Shared, because the archive and the admin
/// review surface name a problem the same way and a second copy of this is a second set of labels.
/// </summary>
public static class ProblemSources
{
    /// <summary>
    /// Spells out where a problem comes from: when it ran, what it ran in, and where in that.
    /// </summary>
    /// <remarks>
    /// Static, and handed the localization service instead of reading a field, because the archive calls it
    /// from inside an expression tree: an instance member puts that service into the tree as a constant,
    /// which EF refuses to compile.
    /// </remarks>
    /// <param name="localization">The resolver of localized display names.</param>
    /// <param name="editionNumber">The season's edition number.</param>
    /// <param name="startYear">The calendar year the season started.</param>
    /// <param name="competitionPath">The path of the competition the problem sits in.</param>
    /// <param name="number">The problem's number within its competition.</param>
    /// <param name="language">The language to label everything in.</param>
    /// <returns>The problem's source.</returns>
    public static ProblemSource Build(
        IMetadataLocalizationService localization,
        int editionNumber,
        int startYear,
        string competitionPath,
        int number,
        Language language)
    {
        // The season, labelled from its own template.
        var season = new LabeledSlug(
            editionNumber.ToString(),
            localization.GetSeasonLabel(language, editionNumber, startYear));

        // The competition spelled out as every competition down to it, each addressed by its own path, which is what
        // its localized names are keyed by.
        var competition = CompetitionTree.Descend(competitionPath)
            .Select(node => new LabeledSlug(
                node.Path,
                localization.GetNodeShortName(language, node.Path),
                localization.GetNodeFullName(language, node.Path)))
            .ToImmutableList();

        // Which pins the problem down: when it ran, what it ran in, and where in that.
        return new ProblemSource(season, startYear, competition, number);
    }
}

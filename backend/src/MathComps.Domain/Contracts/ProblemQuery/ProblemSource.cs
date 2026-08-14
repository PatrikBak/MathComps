using System.Collections.Immutable;
using MathComps.Domain.Contracts.Helpers;

namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Canonical source metadata for a problem within a competition.
/// </summary>
/// <param name="Season">Season/year of the competition.</param>
/// <param name="Competition">
/// The competition the problem was set in, given as every competition down to it, root-first. Each entry's
/// <see cref="LabeledSlug.Slug"/> carries that competition's whole
/// <see cref="EfCoreEntities.Competition.Path"/> rather than its own segment, so an entry names its competition
/// at whatever depth it sits.
/// </param>
/// <param name="Number">Ordinal number within the given context, e.g. the 6th problem.</param>
public record ProblemSource(
    LabeledSlug Season,
    ImmutableList<LabeledSlug> Competition,
    int Number
);

using System.Collections.Immutable;
using MathComps.Domain.Contracts.Helpers;

namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Canonical source metadata for a problem within a competition.
/// </summary>
/// <param name="Season">Season/year of the competition.</param>
/// <param name="Contest">
/// The contest the problem was set in, given as every contest down to it, root-first. Each entry's
/// <see cref="LabeledSlug.Slug"/> carries that contest's whole
/// <see cref="EfCoreEntities.Competition.Path"/> rather than its own segment, so an entry names its contest
/// at whatever depth it sits.
/// </param>
/// <param name="Competition">Competition name and slug.</param>
/// <param name="Round">Round the problem was set in, absent when the competition has one implicit round.</param>
/// <param name="Category">Optional category (e.g., 'A', 'B', 'Z9').</param>
/// <param name="Number">Ordinal number within the given context, e.g. the 6th problem.</param>
public record ProblemSource(
    LabeledSlug Season,
    ImmutableList<LabeledSlug> Contest,
    LabeledSlug Competition,
    LabeledSlug? Round,
    LabeledSlug? Category,
    int Number
);

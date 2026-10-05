using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One competition: one category, one problem set, one clock.
/// </summary>
/// <param name="Slug">
/// What addresses the competition, keyed by the language it is written in. Any of them addresses it, whichever
/// language the reader is in.</param>
/// <param name="Category">
/// Which level it runs at, or null for the practice one, which sits outside the levels entirely.</param>
/// <param name="Entry">
/// The student's entry into it, or null while they have not taken one. Never more than one: where a group allows
/// re-entry, taking it again resets the entry rather than adding a second.</param>
/// <param name="ProblemsPublished">
/// Whether the problems are out from under the round's embargo for this reader: it has passed, or the site
/// lets them past its gates.</param>
/// <param name="ProblemsReady">
/// Whether the competition holds as many problems as its group announced, and so has a paper to serve at
/// all.</param>
public record HostedCompetitionDto(
    IReadOnlyDictionary<Language, string> Slug,
    HostedCompetitionCategory? Category,
    HostedEntryDto? Entry,
    bool ProblemsPublished,
    bool ProblemsReady);

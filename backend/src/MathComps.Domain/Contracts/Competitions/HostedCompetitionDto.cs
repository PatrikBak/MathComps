namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One competition: one category, one problem set, one clock.
/// </summary>
/// <param name="Id">The competition's identifier, which is the round it runs as.</param>
/// <param name="Category">
/// Which level it runs at, or null for the practice one, which sits outside the levels entirely.</param>
/// <param name="Entry">
/// The student's entry into it, or null while they have not taken one. Never more than one: where a group allows
/// re-entry, taking it again resets the entry rather than adding a second.</param>
/// <param name="ResultsPublished">
/// Whether its results are out. A fact about the competition rather than the reader: once out, they are out for
/// everybody. Nothing grades a competition, so it is false everywhere.</param>
/// <param name="ProblemsPublished">
/// Whether the problems are public, which they become when the round's embargo passes.</param>
public record HostedCompetitionDto(
    Guid Id,
    HostedCompetitionCategory? Category,
    HostedEntryDto? Entry,
    bool ResultsPublished,
    bool ProblemsPublished);

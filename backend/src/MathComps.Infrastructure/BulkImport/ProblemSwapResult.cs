using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Where one of the two problems stood before the exchange, together with how much of a student's work hangs off
/// it.
/// </summary>
/// <param name="Slug">The slug the problem answers to, which its position before the exchange calls for.</param>
/// <param name="CompetitionPath"><inheritdoc cref="Competition.Path" path="/summary"/></param>
/// <param name="SeasonYear">Calendar year the season starts in (e.g. 2024 for the 2024/2025 season).</param>
/// <param name="Number"><inheritdoc cref="Problem.Number" path="/summary"/></param>
/// <param name="Defenses">How many defense sessions were argued about this problem.</param>
/// <param name="Comments">How many comments were written on it.</param>
/// <param name="SelfAssessments">How many students recorded how they did on it.</param>
public record ProblemSwapSide(
    string Slug,
    string CompetitionPath,
    int SeasonYear,
    int Number,
    int Defenses,
    int Comments,
    int SelfAssessments);

/// <summary>
/// What an exchange did, or what a dry run says it would do: where both problems stood, and the slug each one
/// takes on at the position it lands on.
/// </summary>
/// <param name="First">Where the first-named problem stood.</param>
/// <param name="Second">Where the second-named problem stood.</param>
/// <param name="FirstNewSlug">The slug the first-named problem takes on in the second's position.</param>
/// <param name="SecondNewSlug">The slug the second-named problem takes on in the first's position.</param>
public record ProblemSwapResult(
    ProblemSwapSide First,
    ProblemSwapSide Second,
    string FirstNewSlug,
    string SecondNewSlug);

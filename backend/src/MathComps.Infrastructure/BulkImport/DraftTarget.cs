using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// The contest and season a draft resolves against — the path addressing the contest plus the season year, which
/// is what it takes to look up (or preview creating) the competition, round and season, and to derive problem
/// slugs. Per-text language and originality live on each problem's <see cref="DraftTextContent"/>.
/// </summary>
/// <param name="ContestPath"><inheritdoc cref="Competition.Path" path="/summary"/></param>
/// <param name="SeasonYear">Calendar year the season starts in (e.g. 2024 for the 2024/2025 season).</param>
public record DraftTarget(
    string ContestPath,
    int SeasonYear);

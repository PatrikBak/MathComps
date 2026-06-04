namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// The taxonomy and season a draft resolves against — the slug references plus the season year needed to look up
/// (or preview creating) the competition, round and season, and to derive problem slugs — along with the
/// draft-level language and original-vs-translation flag the per-text conflict check needs. A small
/// Infrastructure contract, independent of the preflight manifest shape.
/// </summary>
/// <param name="CompetitionSlug">Competition slug (e.g. <c>csmo</c>).</param>
/// <param name="CategorySlug">Category slug (e.g. <c>a</c>), or null when the competition has no categories.</param>
/// <param name="RoundSlug">Round slug (e.g. <c>iii</c>).</param>
/// <param name="SeasonYear">Calendar year the season starts in (e.g. 2024 for the 2024/2025 season).</param>
/// <param name="Language">The language all of the draft's texts are in.</param>
/// <param name="Original">
/// Whether the draft carries originals (<c>true</c>) or translations onto existing originals (<c>false</c>) —
/// maps to <c>ProblemText.IsOriginal</c>.
/// </param>
public record DraftTarget(
    string CompetitionSlug,
    string? CategorySlug,
    string RoundSlug,
    int SeasonYear,
    Language Language,
    bool Original);

namespace MathComps.Shared.Localization;

/// <summary>
/// The canonical slug formulas for the competition taxonomy — how a round and a problem are keyed across the
/// whole system (registry name maps, persisted entities, derived references). One definition so every layer
/// composes the same key; pure string logic, so it's testable on its own.
/// </summary>
public static class TaxonomySlugs
{
    /// <summary>
    /// Composes a round's composite slug — <c>{competition}[-{category}][-{round}]</c>, slugified. A null
    /// category or round drops its segment.
    /// </summary>
    /// <param name="competition">Competition slug or name (e.g. <c>csmo</c>).</param>
    /// <param name="category">Category slug or name (e.g. <c>a</c>), or null when there's no category.</param>
    /// <param name="round">Round slug or name (e.g. <c>iii</c>), or null for a competition's default round.</param>
    /// <returns>The composite round slug (e.g. <c>csmo-a-iii</c>, <c>memo-i</c>).</returns>
    public static string ComposeRoundSlug(string competition, string? category, string? round) =>
        // Join the present segments with hyphens, then slugify to the canonical lowercase form.
        string.Concat(
            competition,
            category is null ? "" : $"-{category}",
            round is null ? "" : $"-{round}").ToSlug();

    /// <summary>
    /// Derives a problem's slug — <c>{editionNumber}-{compositeRoundSlug}-{order}</c>.
    /// </summary>
    /// <param name="editionNumber">The season's edition number (ročník), e.g. 75.</param>
    /// <param name="compositeRoundSlug">The round's composite slug from <see cref="ComposeRoundSlug"/>.</param>
    /// <param name="order">The problem's 1-based position within the round.</param>
    /// <returns>The problem slug (e.g. <c>75-csmo-a-iii-1</c>).</returns>
    public static string ProblemSlug(int editionNumber, string compositeRoundSlug, int order) =>
        // The composite slug is already canonical, so just bracket it with the edition number and order.
        $"{editionNumber}-{compositeRoundSlug}-{order}";
}

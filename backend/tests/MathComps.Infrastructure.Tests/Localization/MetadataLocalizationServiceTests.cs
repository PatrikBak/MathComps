using MathComps.Infrastructure.Services.Localization;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;

namespace MathComps.Infrastructure.Tests.Localization;

/// <summary>
/// Tests <see cref="MetadataLocalizationService"/> against the real on-disk resource files
/// (metadata.shared.json + metadata.{sk,cs,en}.json), which the test project copies to its output.
/// Covers the shared-metadata loader and composite-key round-name resolution.
/// </summary>
public class MetadataLocalizationServiceTests
{
    /// <summary>
    /// The service under test, constructed once per test — its constructor loads every resource file.
    /// </summary>
    private readonly MetadataLocalizationService _service = new();

    #region Shared metadata (structural backbone)

    /// <summary>
    /// Competitions must come back in display order — array position is what encodes that order.
    /// </summary>
    [Fact]
    public void Shared_competitions_are_in_display_order()
    {
        // Pull just the slugs in their declared order.
        var slugs = _service.Shared.Competitions.Select(competition => competition.Slug);

        // CSMO first … CPSJ last.
        Assert.Equal(["csmo", "tst", "memo", "imo", "caps", "egmo", "tstc", "cpsj"], slugs);
    }

    /// <summary>
    /// Categories must come back in sort order — array position is the sort order.
    /// </summary>
    [Fact]
    public void Shared_categories_are_in_sort_order() =>
        // A, B, C first, then Z de-chronologically (Z9 before Z4).
        Assert.Equal(["a", "b", "c", "z9", "z8", "z7", "z6", "z5", "z4"], [.. _service.Shared.Categories]);

    /// <summary>
    /// CSMO is the only competition that carries categories; its categories and rounds must both be present
    /// and ordered.
    /// </summary>
    [Fact]
    public void Shared_csmo_carries_categories_and_rounds()
    {
        // Grab the one CSMO entry.
        var csmo = GetCompetition("csmo");

        // Categories present and in sort order …
        Assert.NotNull(csmo.Categories);
        Assert.Equal(["a", "b", "c", "z9", "z8", "z7", "z6", "z5", "z4"], [.. csmo.Categories.Value]);

        // … and the union of rounds in round-sort order.
        Assert.Equal(["i", "s", "ii", "iii"], [.. csmo.Rounds]);
    }

    /// <summary>
    /// Category-less competitions still carry rounds but no categories.
    /// </summary>
    /// <param name="slug">The competition slug under test.</param>
    /// <param name="rounds">The rounds expected for that competition, in sort order.</param>
    [Theory]
    [InlineData("memo", new[] { "i", "t" })]
    [InlineData("cpsj", new[] { "i", "t" })]
    [InlineData("tst", new[] { "d1", "d2", "d3", "d4", "d5" })]
    public void Shared_category_less_competitions_have_rounds_but_no_categories(string slug, string[] rounds)
    {
        // Look up the competition by slug.
        var competition = GetCompetition(slug);

        // No categories, but the expected rounds in order.
        Assert.Null(competition.Categories);
        Assert.Equal(rounds, competition.Rounds);
    }

    /// <summary>
    /// Default-round competitions (a single implicit round) carry neither categories nor rounds — the empty
    /// rounds array is what makes <c>IsDefault</c> derivable.
    /// </summary>
    /// <param name="slug">The default-round competition slug under test.</param>
    [Theory]
    [InlineData("imo")]
    [InlineData("caps")]
    [InlineData("egmo")]
    [InlineData("tstc")]
    public void Shared_default_round_competitions_have_no_categories_and_no_rounds(string slug)
    {
        // Look up the competition by slug.
        var competition = GetCompetition(slug);

        // Both collections are empty/absent for a default-round competition.
        Assert.Null(competition.Categories);
        Assert.Empty(competition.Rounds);
    }

    #endregion

    #region Round-name resolution — exact strings (regression guard)

    /// <summary>
    /// Round names must resolve to the exact strings the locale files carry, across every taxonomy shape and
    /// all three languages.
    /// </summary>
    /// <param name="language">The locale to resolve in.</param>
    /// <param name="competitionSlug">The competition slug.</param>
    /// <param name="categorySlug">The category slug, or null for a category-less competition.</param>
    /// <param name="roundSlug">The round slug.</param>
    /// <param name="expectedShort">The expected short round name.</param>
    /// <param name="expectedFull">The expected full round name.</param>
    [Theory]
    // CSMO category A — the full four-round shape.
    [InlineData(Language.EN, "csmo", "a", "i", "Home Round", "Home Round")]
    [InlineData(Language.EN, "csmo", "a", "s", "School Round", "School Round")]
    [InlineData(Language.EN, "csmo", "a", "ii", "Regional Round", "Regional Round")]
    [InlineData(Language.EN, "csmo", "a", "iii", "National Round", "National Round")]
    // Category-dependent names: Z-categories rename round II to "District" and III to "Regional".
    [InlineData(Language.EN, "csmo", "z5", "ii", "District Round", "District Round")]
    [InlineData(Language.EN, "csmo", "z5", "iii", "Regional Round", "Regional Round")]
    // Z4 is the odd one out: round II is "School Round" and it has no round III.
    [InlineData(Language.EN, "csmo", "z4", "ii", "School Round", "School Round")]
    // Category-less competitions (round slug, null category).
    [InlineData(Language.EN, "memo", null, "i", "Individual", "Individual Round")]
    [InlineData(Language.EN, "memo", null, "t", "Team", "Team Round")]
    [InlineData(Language.EN, "tst", null, "d1", "Day 1", "Day 1")]
    // Slovak — category-dependent difference (Krajské vs Okresné kolo).
    [InlineData(Language.SK, "csmo", "a", "ii", "Krajské kolo", "Krajské kolo")]
    [InlineData(Language.SK, "csmo", "z5", "ii", "Okresné kolo", "Okresné kolo")]
    [InlineData(Language.SK, "csmo", "z4", "ii", "Školské kolo", "Školské kolo")]
    [InlineData(Language.SK, "csmo", "a", "iii", "Celoštátne kolo", "Celoštátne kolo")]
    [InlineData(Language.SK, "memo", null, "i", "Individual", "Individuálna časť")]
    [InlineData(Language.SK, "tst", null, "d1", "1. deň", "1. deň")]
    // Czech — same composite keys, Czech strings.
    [InlineData(Language.CS, "csmo", "z5", "ii", "Okresní kolo", "Okresní kolo")]
    [InlineData(Language.CS, "csmo", "z4", "ii", "Školní kolo", "Školní kolo")]
    [InlineData(Language.CS, "csmo", "a", "iii", "Celostátní kolo", "Celostátní kolo")]
    [InlineData(Language.CS, "memo", null, "i", "Individual", "Individuální část")]
    [InlineData(Language.CS, "tst", null, "d1", "1. den", "1. den")]
    public void Round_names_resolve_for_every_shape(
        Language language,
        string competitionSlug,
        string? categorySlug,
        string roundSlug,
        string expectedShort,
        string expectedFull)
    {
        // Short and full names both come from the composed composite key.
        Assert.Equal(expectedShort, _service.GetRoundShortName(language, competitionSlug, categorySlug, roundSlug));
        Assert.Equal(expectedFull, _service.GetRoundFullName(language, competitionSlug, categorySlug, roundSlug));
    }

    /// <summary>
    /// A default round (null round slug) carries no name of its own and must fall back to the competition's
    /// own short/full name.
    /// </summary>
    /// <param name="language">The locale to resolve in.</param>
    /// <param name="competitionSlug">The default-round competition slug.</param>
    /// <param name="expectedShort">The competition's expected short name.</param>
    /// <param name="expectedFull">The competition's expected full name.</param>
    [Theory]
    [InlineData(Language.EN, "imo", "IMO", "International Mathematical Olympiad")]
    [InlineData(Language.EN, "egmo", "EGMO", "European Girl's Mathematical Olympiad")]
    [InlineData(Language.SK, "caps", "CAPS", "Czech-Austrian-Polish-Slovak Match")]
    public void Default_round_falls_back_to_competition_name(
        Language language,
        string competitionSlug,
        string expectedShort,
        string expectedFull)
    {
        // The default round's short name equals the competition's short name …
        Assert.Equal(expectedShort, _service.GetRoundShortName(language, competitionSlug, null, null));
        Assert.Equal(expectedShort, _service.GetCompetitionShortName(language, competitionSlug));

        // … and likewise for the full name.
        Assert.Equal(expectedFull, _service.GetRoundFullName(language, competitionSlug, null, null));
    }

    /// <summary>
    /// A combination that doesn't exist in the locale files must throw rather than return a blank.
    /// </summary>
    [Fact]
    public void Missing_round_combination_throws()
    {
        // Z4 has no national round (no csmo-z4-iii key), so resolution must fail.
        Assert.Throws<InvalidOperationException>(
            () => _service.GetRoundShortName(Language.EN, "csmo", "z4", "iii"));
    }

    #endregion

    #region Exhaustive parity sweep

    /// <summary>
    /// Every real taxonomy combination must resolve to a non-empty short and full label in every language.
    /// </summary>
    /// <param name="language">The locale to sweep.</param>
    [Theory]
    [InlineData(Language.SK)]
    [InlineData(Language.CS)]
    [InlineData(Language.EN)]
    public void Every_real_taxonomy_combination_resolves_to_a_non_empty_label(Language language)
    {
        // Walk every real (competition, category, round) triple …
        foreach (var (competitionSlug, categorySlug, roundSlug) in RealTaxonomyCombinations())
        {
            // … and assert both names resolve to something non-blank.
            Assert.False(string.IsNullOrWhiteSpace(
                _service.GetRoundShortName(language, competitionSlug, categorySlug, roundSlug)));
            Assert.False(string.IsNullOrWhiteSpace(
                _service.GetRoundFullName(language, competitionSlug, categorySlug, roundSlug)));
        }
    }

    /// <summary>
    /// Every (competition, category, round) triple that exists in the taxonomy — including the per-category
    /// round differences (e.g. Z4 has only rounds I and II). A null category means a category-less
    /// competition; a null round means the competition's default round.
    /// </summary>
    /// <returns>Every valid taxonomy triple.</returns>
    private static IEnumerable<(string Competition, string? Category, string? Round)> RealTaxonomyCombinations()
    {
        // CSMO high-school categories get all four rounds.
        foreach (var category in new[] { "a", "b", "c" })
            foreach (var round in new[] { "i", "s", "ii", "iii" })
                yield return ("csmo", category, round);

        // Z4 only has the home and school rounds.
        foreach (var round in new[] { "i", "ii" })
            yield return ("csmo", "z4", round);

        // Z5–Z9 have home, district and regional rounds.
        foreach (var category in new[] { "z5", "z6", "z7", "z8", "z9" })
            foreach (var round in new[] { "i", "ii", "iii" })
                yield return ("csmo", category, round);

        // Individual / team competitions.
        foreach (var competition in new[] { "memo", "cpsj" })
            foreach (var round in new[] { "i", "t" })
                yield return (competition, null, round);

        // TST runs over numbered days.
        foreach (var round in new[] { "d1", "d2", "d3", "d4", "d5" })
            yield return ("tst", null, round);

        // Default-round competitions resolve via the null-round fallback.
        foreach (var competition in new[] { "imo", "caps", "egmo", "tstc" })
            yield return (competition, null, null);
    }

    #endregion

    #region Registry-link validation

    /// <summary>
    /// A fully-registered taxonomy — present in the shared backbone and named in every locale — produces no
    /// registry-link issues.
    /// </summary>
    /// <param name="competition">The competition slug.</param>
    /// <param name="category">The category slug, or null for a category-less competition.</param>
    /// <param name="round">The round slug, or null for a competition's default round.</param>
    [Theory]
    [InlineData("csmo", "a", "iii")]
    [InlineData("csmo", "z5", "ii")]
    [InlineData("memo", null, "i")]
    [InlineData("tst", null, "d1")]
    [InlineData("imo", null, null)]
    public void Registered_taxonomy_has_no_issues(string competition, string? category, string? round) =>
        Assert.Empty(_service.ValidateTaxonomyRegistration(competition, category, round));

    /// <summary>
    /// An unknown competition is reported as absent from the shared structure and from every locale.
    /// </summary>
    [Fact]
    public void Unknown_competition_is_reported_structurally_and_in_all_locales()
    {
        // Validate a competition slug that doesn't exist anywhere.
        var issues = _service.ValidateTaxonomyRegistration("nope", null, "i");

        // The competition issue flags both the structural gap and all three missing locales.
        var competitionIssue = issues.Single(issue => issue.EntityKind == TaxonomyEntityKind.Competition);
        Assert.True(competitionIssue.MissingFromSharedStructure);
        Assert.Equal([Language.SK, Language.CS, Language.EN], competitionIssue.MissingLocales.AsEnumerable());
    }

    /// <summary>
    /// A round slug a real competition doesn't carry is reported as a round-level structural gap.
    /// </summary>
    [Fact]
    public void Unknown_round_under_a_real_competition_is_reported()
    {
        // CSMO category A has no round "zzz".
        var issues = _service.ValidateTaxonomyRegistration("csmo", "a", "zzz");

        // The competition itself is fine; only the round is flagged.
        Assert.DoesNotContain(issues, issue => issue.EntityKind == TaxonomyEntityKind.Competition);
        Assert.Contains(issues, issue => issue is { EntityKind: TaxonomyEntityKind.Round, MissingFromSharedStructure: true });
    }

    /// <summary>
    /// Omitting the round (a null slug — the default round) for a competition that carries explicit rounds is a
    /// round-level structural gap, caught rather than silently resolved to the competition itself.
    /// </summary>
    [Fact]
    public void Default_round_on_a_competition_that_has_rounds_is_reported()
    {
        // CSMO carries explicit rounds, so a null round (the default-round claim) doesn't belong to it.
        var issues = _service.ValidateTaxonomyRegistration("csmo", "a", roundSlug: null);

        // The round is flagged structurally; the competition itself is fine.
        Assert.DoesNotContain(issues, issue => issue.EntityKind == TaxonomyEntityKind.Competition);
        Assert.Contains(issues, issue => issue is { EntityKind: TaxonomyEntityKind.Round, MissingFromSharedStructure: true });
    }

    /// <summary>
    /// A category slug a real competition doesn't carry is reported as a category-level gap.
    /// </summary>
    [Fact]
    public void Unknown_category_is_reported()
    {
        // CSMO has no category "zzz".
        var issues = _service.ValidateTaxonomyRegistration("csmo", "zzz", "iii");

        // The category is flagged structurally.
        Assert.Contains(issues, issue => issue is { EntityKind: TaxonomyEntityKind.Category, MissingFromSharedStructure: true });
    }

    #endregion

    #region Helpers

    /// <summary>
    /// Finds the single shared-metadata competition entry with the given slug.
    /// </summary>
    /// <param name="slug">The competition slug to look up.</param>
    /// <returns>The matching competition entry.</returns>
    private SharedCompetition GetCompetition(string slug) =>
        _service.Shared.Competitions.Single(competition => competition.Slug == slug);

    #endregion
}

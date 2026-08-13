using MathComps.Infrastructure.Services.Localization;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;

namespace MathComps.Infrastructure.Tests.Localization;

/// <summary>
/// Tests <see cref="MetadataLocalizationService"/> against the real on-disk resource files
/// (metadata.shared.json + metadata.{sk,cs,en}.json), which the test project copies to its output.
/// Covers the shared-metadata loader and path-keyed node-name resolution.
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

        // CSMO first … DuoGeo last.
        Assert.Equal(["csmo", "tst", "memo", "imo", "caps", "emo", "egmo", "tstc", "cpsj", "duogeo"], slugs);
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
    [InlineData("duogeo", new[] { "zs", "ss" })]
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
    [InlineData("emo")]
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

    #region Node-name resolution — exact strings (regression guard)

    /// <summary>
    /// Node names must resolve to the exact strings the locale files carry, at every depth of the tree and in
    /// all three languages.
    /// </summary>
    /// <param name="language">The locale to resolve in.</param>
    /// <param name="path">The node's path.</param>
    /// <param name="expectedShort">The expected short name.</param>
    /// <param name="expectedFull">The expected full name.</param>
    [Theory]
    // A whole competition, which is also what a default-round competition's problems resolve to.
    [InlineData(Language.EN, "imo", "IMO", "International Mathematical Olympiad")]
    [InlineData(Language.EN, "egmo", "EGMO", "European Girl's Mathematical Olympiad")]
    [InlineData(Language.EN, "emo", "EMO", "European Mathematical Olympiad")]
    [InlineData(Language.SK, "caps", "CAPS", "Czech-Austrian-Polish-Slovak Match")]
    // A category, which is named per competition rather than globally.
    [InlineData(Language.SK, "csmo-a", "A", "Kategória A")]
    [InlineData(Language.CS, "csmo-z9", "Z9", "Kategorie Z9")]
    [InlineData(Language.EN, "csmo-z4", "Z4", "Category Z4")]
    // CSMO category A — the full four-round shape.
    [InlineData(Language.EN, "csmo-a-i", "Home Round", "Home Round")]
    [InlineData(Language.EN, "csmo-a-s", "School Round", "School Round")]
    [InlineData(Language.EN, "csmo-a-ii", "Regional Round", "Regional Round")]
    [InlineData(Language.EN, "csmo-a-iii", "National Round", "National Round")]
    // Category-dependent names: Z-categories rename round II to "District" and III to "Regional".
    [InlineData(Language.EN, "csmo-z5-ii", "District Round", "District Round")]
    [InlineData(Language.EN, "csmo-z5-iii", "Regional Round", "Regional Round")]
    // Z4 is the odd one out: round II is "School Round" and it has no round III.
    [InlineData(Language.EN, "csmo-z4-ii", "School Round", "School Round")]
    // Rounds hanging straight off a category-less competition.
    [InlineData(Language.EN, "memo-i", "Individual", "Individual Round")]
    [InlineData(Language.EN, "memo-t", "Team", "Team Round")]
    [InlineData(Language.EN, "tst-d1", "Day 1", "Day 1")]
    // DuoGeo's two school-level rounds.
    [InlineData(Language.EN, "duogeo-zs", "Elementary", "Elementary School")]
    [InlineData(Language.SK, "duogeo-ss", "SŠ", "Kategória SŠ")]
    // Slovak — category-dependent difference (Krajské vs Okresné kolo).
    [InlineData(Language.SK, "csmo-a-ii", "Krajské kolo", "Krajské kolo")]
    [InlineData(Language.SK, "csmo-z5-ii", "Okresné kolo", "Okresné kolo")]
    [InlineData(Language.SK, "csmo-z4-ii", "Školské kolo", "Školské kolo")]
    [InlineData(Language.SK, "csmo-a-iii", "Celoštátne kolo", "Celoštátne kolo")]
    [InlineData(Language.SK, "memo-i", "Individual", "Individuálna časť")]
    [InlineData(Language.SK, "tst-d1", "1. deň", "1. deň")]
    // Czech — same paths, Czech strings.
    [InlineData(Language.CS, "csmo-z5-ii", "Okresní kolo", "Okresní kolo")]
    [InlineData(Language.CS, "csmo-z4-ii", "Školní kolo", "Školní kolo")]
    [InlineData(Language.CS, "csmo-a-iii", "Celostátní kolo", "Celostátní kolo")]
    [InlineData(Language.CS, "memo-i", "Individual", "Individuální část")]
    [InlineData(Language.CS, "tst-d1", "1. den", "1. den")]
    public void Node_names_resolve_at_every_depth(
        Language language,
        string path,
        string expectedShort,
        string expectedFull)
    {
        // Short and full names are both keyed by the node's own path.
        Assert.Equal(expectedShort, _service.GetNodeShortName(language, path));
        Assert.Equal(expectedFull, _service.GetNodeFullName(language, path));
    }

    /// <summary>
    /// A path that doesn't exist in the locale files must throw rather than return a blank.
    /// </summary>
    [Fact]
    public void Missing_node_throws()
    {
        // Z4 has no national round (no csmo-z4-iii key), so resolution must fail.
        Assert.Throws<InvalidOperationException>(
            () => _service.GetNodeShortName(Language.EN, "csmo-z4-iii"));
    }

    #endregion

    #region Exhaustive parity sweep

    /// <summary>
    /// Every real contest node must resolve to a non-empty short and full label in every language.
    /// </summary>
    /// <param name="language">The locale to sweep.</param>
    [Theory]
    [InlineData(Language.SK)]
    [InlineData(Language.CS)]
    [InlineData(Language.EN)]
    public void Every_real_contest_node_resolves_to_a_non_empty_label(Language language)
    {
        // Walk every real node path …
        foreach (var path in RealContestPaths())
        {
            // … and assert both names resolve to something non-blank.
            Assert.False(string.IsNullOrWhiteSpace(_service.GetNodeShortName(language, path)));
            Assert.False(string.IsNullOrWhiteSpace(_service.GetNodeFullName(language, path)));
        }
    }

    /// <summary>
    /// Every node path that exists in the taxonomy — each competition, each category within one, and each
    /// round, including the per-category round differences (e.g. Z4 has only rounds I and II).
    /// </summary>
    /// <returns>Every valid node path.</returns>
    private static IEnumerable<string> RealContestPaths()
    {
        // Every competition is a node in its own right, default-round ones included.
        foreach (var competition in new[]
                 { "csmo", "tst", "memo", "imo", "caps", "emo", "egmo", "tstc", "cpsj", "duogeo" })
            yield return competition;

        // CSMO high-school categories get all four rounds.
        foreach (var category in new[] { "a", "b", "c" })
            foreach (var round in new[] { "i", "s", "ii", "iii" })
                yield return $"csmo-{category}-{round}";

        // Z4 only has the home and school rounds.
        foreach (var round in new[] { "i", "ii" })
            yield return $"csmo-z4-{round}";

        // Z5–Z9 have home, district and regional rounds.
        foreach (var category in new[] { "z5", "z6", "z7", "z8", "z9" })
            foreach (var round in new[] { "i", "ii", "iii" })
                yield return $"csmo-{category}-{round}";

        // Each of those categories is itself a named node between the competition and its rounds.
        foreach (var category in new[] { "a", "b", "c", "z4", "z5", "z6", "z7", "z8", "z9" })
            yield return $"csmo-{category}";

        // Individual / team competitions.
        foreach (var competition in new[] { "memo", "cpsj" })
            foreach (var round in new[] { "i", "t" })
                yield return $"{competition}-{round}";

        // TST runs over numbered days.
        foreach (var round in new[] { "d1", "d2", "d3", "d4", "d5" })
            yield return $"tst-{round}";

        // DuoGeo runs two school-level rounds.
        foreach (var round in new[] { "zs", "ss" })
            yield return $"duogeo-{round}";
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

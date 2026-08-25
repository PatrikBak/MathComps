using System.Collections.Immutable;
using MathComps.Infrastructure.Constants;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Shared.Serialization;

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
    /// The roots must come back in display order — array position is what encodes that order.
    /// </summary>
    [Fact]
    public void Shared_roots_are_in_display_order() =>
        // CSMO first … the site's own competitions last, placed after the archive's on purpose.
        Assert.Equal(
            ["csmo", "tst", "memo", "imo", "caps", "emo", "egmo", "tstc", "cpsj", "duogeo", "mc"],
            [.. _service.Shared.ChildSlugs(parentPath: null)]);

    /// <summary>
    /// CSMO's children are its categories, and each category's children are its own rounds.
    /// </summary>
    [Fact]
    public void Shared_csmo_carries_its_categories_which_carry_their_rounds()
    {
        // Categories in sort order — A, B, C first, then Z de-chronologically (Z9 before Z4).
        Assert.Equal(
            ["a", "b", "c", "z9", "z8", "z7", "z6", "z5", "z4"], [.. _service.Shared.ChildSlugs("csmo")]);

        // And a category's own rounds hang one level below it.
        Assert.Equal(["i", "s", "ii", "iii"], [.. _service.Shared.ChildSlugs("csmo-a")]);
    }

    /// <summary>
    /// Which rounds a CSMO category runs differs per category, which is exactly what the flat registry could
    /// not say: it gave one round list to the whole competition and left the truth implicit in which locale
    /// keys happened to exist.
    /// </summary>
    /// <param name="categoryPath">The category node's path.</param>
    /// <param name="rounds">The rounds that category actually runs, in sort order.</param>
    [Theory]
    [InlineData("csmo-a", new[] { "i", "s", "ii", "iii" })]
    [InlineData("csmo-z9", new[] { "i", "ii", "iii" })]
    [InlineData("csmo-z4", new[] { "i", "ii" })]
    public void Shared_expresses_the_per_category_round_differences(string categoryPath, string[] rounds) =>
        Assert.Equal(rounds, _service.Shared.ChildSlugs(categoryPath));

    /// <summary>
    /// A competition with no categories carries its rounds as its own children.
    /// </summary>
    /// <param name="slug">The competition slug under test.</param>
    /// <param name="rounds">The rounds expected for that competition, in sort order.</param>
    [Theory]
    [InlineData("memo", new[] { "i", "t" })]
    [InlineData("cpsj", new[] { "i", "t" })]
    [InlineData("tst", new[] { "d1", "d2", "d3", "d4", "d5" })]
    [InlineData("duogeo", new[] { "zs", "ss" })]
    public void Shared_category_less_competitions_carry_their_rounds_directly(string slug, string[] rounds) =>
        Assert.Equal(rounds, _service.Shared.ChildSlugs(slug));

    /// <summary>
    /// A competition that runs as one flat sitting is a leaf — no children at all, which is what its problems
    /// hanging off the competition itself looks like.
    /// </summary>
    /// <param name="slug">The flat competition slug under test.</param>
    [Theory]
    [InlineData("imo")]
    [InlineData("caps")]
    [InlineData("egmo")]
    [InlineData("emo")]
    [InlineData("tstc")]
    public void Shared_flat_competitions_are_leaves(string slug) =>
        Assert.Empty(_service.Shared.ChildSlugs(slug));

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
    // A root competition — how one that runs as a single flat sitting is addressed.
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
    /// Every real competition node must resolve to a non-empty short and full label in every language.
    /// </summary>
    /// <param name="language">The locale to sweep.</param>
    [Theory]
    [InlineData(Language.SK)]
    [InlineData(Language.CS)]
    [InlineData(Language.EN)]
    public void Every_real_competition_node_resolves_to_a_non_empty_label(Language language)
    {
        // Walk every real node path …
        foreach (var path in RealCompetitionPaths())
        {
            // … and assert both names resolve to something non-blank.
            Assert.False(string.IsNullOrWhiteSpace(_service.GetNodeShortName(language, path)));
            Assert.False(string.IsNullOrWhiteSpace(_service.GetNodeFullName(language, path)));
        }
    }

    /// <summary>
    /// No locale may name a node the registry doesn't carry. Together with the sweep above this pins the two
    /// halves of the registry to each other: the structure lists exactly the nodes the name maps name, so a
    /// node can never be added to one and forgotten in the other.
    /// </summary>
    /// <param name="language">The locale to check.</param>
    [Theory]
    [InlineData(Language.SK)]
    [InlineData(Language.CS)]
    [InlineData(Language.EN)]
    public void Every_locale_name_belongs_to_a_registered_node(Language language)
    {
        // The paths the structure carries.
        var registered = RealCompetitionPaths().ToHashSet();

        // The ones this locale names.
        var named = LoadLocale(language).Nodes.Keys;

        // A name with no structure behind it is dead weight that no reader can ever reach.
        Assert.Empty(named.Where(path => !registered.Contains(path)));
    }

    /// <summary>
    /// Every node path the registry carries, root-first, at every depth.
    /// </summary>
    /// <returns>Every valid node path.</returns>
    private IEnumerable<string> RealCompetitionPaths()
    {
        // Each node contributes its own path, then everything below it.
        static IEnumerable<string> Walk(ImmutableArray<SharedNode> nodes, string? parentPath) =>
            nodes.SelectMany(node =>
            {
                // Where this node sits, which is how a locale keys its names.
                var path = TaxonomySlugs.ComposePath(parentPath, node.Slug);

                // Its own path, ahead of everything descending from it.
                return Walk(node.Children ?? [], path).Prepend(path);
            });

        // Start at the roots, which extend nothing.
        return Walk(_service.Shared.Nodes, parentPath: null);
    }

    /// <summary>
    /// Deserializes one locale's name map from the same resource file the service loads, so the parity sweep
    /// can compare the two halves of the registry directly.
    /// </summary>
    /// <param name="language">The locale to load.</param>
    /// <returns>That locale's metadata.</returns>
    private static PerLocaleMetadata LoadLocale(Language language) =>
        File.ReadAllText(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                LocalizationConstants.MetadataDirectory,
                $"metadata.{language.ToString().ToLowerInvariant()}.json"))
            .FromJson<PerLocaleMetadata>();

    #endregion

    #region Registry-link validation

    /// <summary>
    /// A fully-registered competition — every competition on its path present in the shared backbone and named in
    /// every locale, and the one it names a sitting — produces no registry-link issues, at any depth.
    /// </summary>
    /// <param name="competitionPath">The path the draft names its competition by.</param>
    [Theory]
    [InlineData("csmo-a-iii")]
    [InlineData("csmo-z5-ii")]
    [InlineData("memo-i")]
    [InlineData("tst-d1")]
    [InlineData("imo")]
    public void Registered_competition_has_no_issues(string competitionPath) =>
        Assert.Empty(_service.ValidateTaxonomyRegistration(competitionPath));

    /// <summary>
    /// An unknown competition is reported as absent from the shared structure and from every locale.
    /// </summary>
    [Fact]
    public void Unknown_competition_is_reported_structurally_and_in_all_locales()
    {
        // Validate a path whose root doesn't exist anywhere.
        var issues = _service.ValidateTaxonomyRegistration("nope-i");

        // The root's issue flags both the structural gap and all three missing locales.
        var rootIssue = issues.Single(issue => issue.Path == "nope");
        Assert.True(rootIssue.MissingFromSharedStructure);
        Assert.Equal([Language.SK, Language.CS, Language.EN], rootIssue.MissingLocales.AsEnumerable());
    }

    /// <summary>
    /// Every competition on the path is checked, so a path unregistered from its root down reports one issue per
    /// segment rather than stopping at the first.
    /// </summary>
    [Fact]
    public void Every_competition_on_an_unregistered_path_is_reported()
    {
        // Nothing on this path is registered, at any of its four levels.
        var issues = _service.ValidateTaxonomyRegistration("nope-mid-low-round");

        // One issue per segment, keyed by that segment's own path.
        Assert.Equal(
            ["nope", "nope-mid", "nope-mid-low", "nope-mid-low-round"],
            issues.Select(issue => issue.Path));
    }

    /// <summary>
    /// A path segment a real competition doesn't carry is reported at that segment, leaving the ones above it
    /// alone.
    /// </summary>
    [Fact]
    public void Unknown_segment_under_a_real_competition_is_reported()
    {
        // CSMO category A has no round "zzz".
        var issues = _service.ValidateTaxonomyRegistration("csmo-a-zzz");

        // Only the unregistered segment is flagged; what sits above it is fine.
        var issue = Assert.Single(issues);
        Assert.Equal("csmo-a-zzz", issue.Path);
        Assert.True(issue.MissingFromSharedStructure);
    }

    /// <summary>
    /// Naming a competition that carries a generation below it is caught: those are the competitions the draft was
    /// supposed to pick from, so the problems have no sitting to hang off.
    /// </summary>
    [Fact]
    public void Competition_that_carries_nested_competitions_is_reported()
    {
        // CSMO category A carries its rounds, so it is a container rather than a sitting.
        var issues = _service.ValidateTaxonomyRegistration("csmo-a");

        // It is registered and localized, so the nesting is the only gap.
        var issue = Assert.Single(issues);
        Assert.Equal("csmo-a", issue.Path);
        Assert.True(issue.CarriesNestedCompetitions);
        Assert.False(issue.MissingFromSharedStructure);
        Assert.Empty(issue.MissingLocales);
    }

    #endregion

}

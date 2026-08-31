using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the clause a registry gap renders as. Everything that refuses an unregistered competition — the draft
/// preflight and the group declaration alike — quotes it verbatim, so it is the sentence an author acts on. The
/// gap detection itself lives in (and is tested against the real resources by) the metadata service.
/// </summary>
public class TaxonomyRegistryIssueTests
{
    /// <summary>
    /// A competition absent from the structural backbone says so, naming the file to add it to.
    /// </summary>
    [Fact]
    public void A_structural_gap_names_the_shared_file()
    {
        // A competition absent from the backbone, present in every locale.
        var issue = new TaxonomyRegistryIssue(
            "csmo", MissingFromSharedStructure: true, MissingLocales: [], CarriesNestedCompetitions: false);

        Assert.Equal("no structural entry in metadata.shared.json", issue.Gaps);
    }

    /// <summary>
    /// A localization gap lists exactly the missing locales, lowercased.
    /// </summary>
    [Fact]
    public void A_locale_gap_lists_the_missing_locales()
    {
        // Structurally present, missing Czech and English names.
        var issue = new TaxonomyRegistryIssue(
            "csmo-a-iii", MissingFromSharedStructure: false, MissingLocales: [Language.CS, Language.EN],
            CarriesNestedCompetitions: false);

        Assert.Equal("no localized name in cs, en", issue.Gaps);
    }

    /// <summary>
    /// A registered competition that turns out to carry a generation below it says so, since whoever named it has
    /// to name one of the competitions below instead.
    /// </summary>
    [Fact]
    public void A_container_says_to_name_one_of_the_competitions_below_it()
    {
        // A category, fully registered, named as though it were a sitting.
        var issue = new TaxonomyRegistryIssue(
            "csmo-a", MissingFromSharedStructure: false, MissingLocales: [],
            CarriesNestedCompetitions: true);

        Assert.Equal("competitions nested below it, so one of those is named instead", issue.Gaps);
    }

    /// <summary>
    /// A competition can be short in several ways at once, and then every gap appears rather than the first one
    /// found.
    /// </summary>
    [Fact]
    public void Several_gaps_at_once_are_all_reported()
    {
        // No shared entry and no Slovak name.
        var issue = new TaxonomyRegistryIssue(
            "x", MissingFromSharedStructure: true, MissingLocales: [Language.SK],
            CarriesNestedCompetitions: false);

        // Both phrasings present, structural first.
        Assert.Equal("no structural entry in metadata.shared.json; no localized name in sk", issue.Gaps);
    }
}

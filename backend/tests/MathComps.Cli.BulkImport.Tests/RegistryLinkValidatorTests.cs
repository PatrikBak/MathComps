using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Domain.Taxonomy;
using MathComps.Domain.Localization;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests how registry-link gaps render as issues. The gap detection itself lives in (and is tested against the
/// real resources by) the metadata service; here we only pin the message shape the agent and humans read.
/// </summary>
public class RegistryLinkValidatorTests
{
    /// <summary>
    /// A purely structural gap reads as a missing shared entry, against <c>_meta.yaml</c> at error severity.
    /// </summary>
    [Fact]
    public void Structural_gap_renders_as_a_registry_error()
    {
        // A competition absent from the shared backbone, present in every locale.
        var issue = new TaxonomyRegistryIssue(
            "csmo", MissingFromSharedStructure: true, MissingLocales: [], CarriesNestedContests: false);

        // Map it.
        var error = RegistryLinkValidator.ToVerdictError(issue);

        // Folder-level, blocking, rule "registry", with the structural phrasing.
        Assert.Equal("_meta.yaml", error.File);
        Assert.Null(error.Half);
        Assert.Equal("registry", error.Rule);
        Assert.Equal(VerdictSeverity.Error, error.Severity);
        Assert.Equal("contest 'csmo' has no structural entry in metadata.shared.json", error.Message);
    }

    /// <summary>
    /// A localization gap lists exactly the missing locales, lowercased.
    /// </summary>
    [Fact]
    public void Locale_gap_lists_the_missing_locales()
    {
        // A contest structurally present but missing Czech and English names.
        var issue = new TaxonomyRegistryIssue(
            "csmo-a-iii", MissingFromSharedStructure: false, MissingLocales: [Language.CS, Language.EN],
            CarriesNestedContests: false);

        // The message names just the missing locales.
        Assert.Equal(
            "contest 'csmo-a-iii' has no localized name in cs, en",
            RegistryLinkValidator.ToVerdictError(issue).Message);
    }

    /// <summary>
    /// A registered contest that turns out to carry a generation below it says so, since the draft has to name
    /// one of those instead.
    /// </summary>
    [Fact]
    public void Nested_contests_gap_says_to_name_one_of_them()
    {
        // A category, fully registered, named as though it were a sitting.
        var issue = new TaxonomyRegistryIssue(
            "csmo-a", MissingFromSharedStructure: false, MissingLocales: [], CarriesNestedContests: true);

        // The message points at the generation below rather than at a missing entry.
        Assert.Equal(
            "contest 'csmo-a' has contests nested below it, so a draft names one of those instead",
            RegistryLinkValidator.ToVerdictError(issue).Message);
    }

    /// <summary>
    /// When a competition is missing both structurally and in some locales, both gaps appear, joined.
    /// </summary>
    [Fact]
    public void Combined_gap_reports_both_halves()
    {
        // A competition with no shared entry and no Slovak name.
        var issue = new TaxonomyRegistryIssue(
            "x", MissingFromSharedStructure: true, MissingLocales: [Language.SK],
            CarriesNestedContests: false);

        // Map it.
        var message = RegistryLinkValidator.ToVerdictError(issue).Message;

        // Both phrasings present, structural first.
        Assert.Equal(
            "contest 'x' has no structural entry in metadata.shared.json; no localized name in sk",
            message);
    }
}

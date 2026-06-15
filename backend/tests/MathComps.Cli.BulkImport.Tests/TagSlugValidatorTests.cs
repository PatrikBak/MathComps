using System.Collections.Immutable;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Validation;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests the authoritative tag-slug gate against the real approved vocabulary. The <c>tags:</c> list is hand-editable
/// before apply, so a typo must surface as a blocking error here rather than become a junk row.
/// </summary>
public class TagSlugValidatorTests
{
    /// <summary>
    /// A problem whose tags are all approved produces no issues.
    /// </summary>
    [Fact]
    public void Known_slugs_pass_clean() =>
        Assert.Empty(TagSlugValidator.Check([ProblemWithTags(["algebra", "am-gm-inequality"])]));

    /// <summary>
    /// An unknown slug is a blocking error against the problem's sidecar.
    /// </summary>
    [Fact]
    public void Unknown_slug_is_a_blocking_error()
    {
        // Validate a problem with one good slug and one bogus one.
        var issues = TagSlugValidator.Check([ProblemWithTags(["algebra", "not-a-real-slug"])]);

        // Exactly the bad slug is flagged, as an error against p1.yaml under the tags rule.
        var issue = Assert.Single(issues);
        Assert.Equal(VerdictSeverity.Error, issue.Severity);
        Assert.Equal("tags", issue.Rule);
        Assert.Equal("p1.yaml", issue.File);
        Assert.Contains("not-a-real-slug", issue.Message);
    }

    /// <summary>
    /// A slug listed twice is a warning, not a blocking error.
    /// </summary>
    [Fact]
    public void Duplicate_slug_is_a_warning()
    {
        // Validate a problem listing the same slug twice.
        var issues = TagSlugValidator.Check([ProblemWithTags(["algebra", "algebra"])]);

        // The repeat is flagged, but only as advisory.
        var issue = Assert.Single(issues);
        Assert.Equal(VerdictSeverity.Warning, issue.Severity);
        Assert.Contains("algebra", issue.Message);
    }

    /// <summary>
    /// A null tags list (no <c>tags:</c> key) is skipped entirely — there is nothing to validate.
    /// </summary>
    [Fact]
    public void Absent_tags_produce_no_issues() =>
        Assert.Empty(TagSlugValidator.Check([ProblemWithTags(null)]));

    /// <summary>
    /// An explicit empty list (a clear) is valid and produces no issues.
    /// </summary>
    [Fact]
    public void Empty_tags_produce_no_issues() =>
        Assert.Empty(TagSlugValidator.Check([ProblemWithTags([])]));

    /// <summary>
    /// A known slug typed with stray casing or surrounding whitespace is accepted — the gate canonicalizes before
    /// matching, so a hand-edit like "  Algebra  " isn't falsely flagged as unknown.
    /// </summary>
    [Fact]
    public void Mixed_case_or_padded_slug_is_accepted() =>
        Assert.Empty(TagSlugValidator.Check([ProblemWithTags(["  Algebra  "])]));

    /// <summary>
    /// Builds a minimal order-1 problem carrying just the given tags.
    /// </summary>
    /// <param name="tags">The tag slugs, or null for no <c>tags:</c> key.</param>
    /// <returns>The problem to validate.</returns>
    private static ManifestProblem ProblemWithTags(ImmutableArray<string>? tags) =>
        new(1, HasSidecar: true, [], null, tags, [], []);
}

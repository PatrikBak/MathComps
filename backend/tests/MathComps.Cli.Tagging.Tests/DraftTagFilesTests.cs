using MathComps.Cli.Tagging.Services;

namespace MathComps.Cli.Tagging.Tests;

/// <summary>
/// Tests the pure draft-file helpers <c>tag-draft</c> relies on: the body split feeds the model, the skip rule drives
/// the resumable re-run, and the block/append formatting is what lands in a sidecar — each can silently corrupt a
/// draft if it drifts.
/// </summary>
public class DraftTagFilesTests
{
    /// <summary>
    /// A body with the sentinel splits into statement and solution around it.
    /// </summary>
    [Fact]
    public void Split_separates_statement_and_solution_on_the_sentinel()
    {
        // A body with a statement, the sentinel, and a solution.
        var body = "Prove that x = y.\n\n<!-- solution -->\n\nBecause of reasons.";

        // Split the body on the sentinel.
        var (statement, solution) = DraftTagFiles.SplitStatementAndSolution(body);

        // Both halves come back trimmed.
        Assert.Equal("Prove that x = y.", statement);
        Assert.Equal("Because of reasons.", solution);
    }

    /// <summary>
    /// Without the sentinel the whole body is the statement and there is no solution.
    /// </summary>
    [Fact]
    public void Split_treats_a_sentinel_less_body_as_statement_only()
    {
        // No sentinel — the body is all statement.
        var (statement, solution) = DraftTagFiles.SplitStatementAndSolution("Just a statement.");
        Assert.Equal("Just a statement.", statement);
        Assert.Null(solution);
    }

    /// <summary>
    /// A sentinel with nothing meaningful under it counts as no solution, so the Technique pass is skipped.
    /// </summary>
    [Fact]
    public void Split_returns_null_solution_when_the_solution_half_is_blank()
    {
        // The sentinel is present but the solution half is whitespace only.
        var (_, solution) = DraftTagFiles.SplitStatementAndSolution("Statement.\n<!-- solution -->\n   \n");
        Assert.Null(solution);
    }

    /// <summary>
    /// The skip rule fires whenever a <c>tags</c> key is present — a populated list or an explicit empty one.
    /// </summary>
    /// <param name="yaml">The sidecar contents.</param>
    /// <param name="expected">Whether a tags key should be detected.</param>
    [Theory]
    [InlineData("authors:\n  - A\ntags:\n  - algebra", true)]
    [InlineData("tags: []", true)]
    [InlineData("authors:\n  - A", false)]
    [InlineData("", false)]
    public void HasTagsKey_detects_a_present_tags_key(string yaml, bool expected) =>
        Assert.Equal(expected, DraftTagFiles.HasTagsKey(yaml));

    /// <summary>
    /// An empty tag set is recorded as an explicit empty list so the skip rule sees the problem as decided.
    /// </summary>
    [Fact]
    public void BuildTagsBlock_renders_an_empty_set_as_an_explicit_list() =>
        Assert.Equal("tags: []", DraftTagFiles.BuildTagsBlock([]));

    /// <summary>
    /// Each slug becomes a list item whose comment leads with the fitness; a justification rides along after it, and a
    /// blank justification leaves the fitness standing alone.
    /// </summary>
    [Fact]
    public void BuildTagsBlock_leads_each_comment_with_the_fitness_then_the_optional_justification()
    {
        // One tag carries a justification, the other only its fitness.
        var block = DraftTagFiles.BuildTagsBlock([
            new DraftTag("algebra", 0.95f, null),
            new DraftTag("pigeonhole", 0.7f, "counts boxes vs items"),
        ]);
        Assert.Equal("tags:\n  - algebra # fit 0.95\n  - pigeonhole # fit 0.7 — counts boxes vs items", block);
    }

    /// <summary>
    /// A multi-line justification is folded onto a single comment line, after the fitness, so the yaml stays valid.
    /// </summary>
    [Fact]
    public void BuildTagsBlock_collapses_a_multiline_justification()
    {
        // The justification spans lines and has ragged whitespace.
        var block = DraftTagFiles.BuildTagsBlock([new DraftTag("algebra", 0.8f, "first line\n   second line")]);
        Assert.Equal("tags:\n  - algebra # fit 0.8 — first line second line", block);
    }

    /// <summary>
    /// Appending to existing keys preserves them and separates the block with exactly one newline, regardless of
    /// whether the original ended in one.
    /// </summary>
    /// <param name="existing">The sidecar's current contents.</param>
    [Theory]
    [InlineData("authors:\n  - A")]
    [InlineData("authors:\n  - A\n")]
    public void AppendTagsBlock_preserves_existing_keys_with_a_single_separator(string existing)
    {
        // Append a tags block to the authors-only sidecar.
        var result = DraftTagFiles.AppendTagsBlock(existing, "tags:\n  - algebra");
        Assert.Equal("authors:\n  - A\ntags:\n  - algebra\n", result);
    }

    /// <summary>
    /// With no prior content the block stands alone, newline-terminated.
    /// </summary>
    [Fact]
    public void AppendTagsBlock_writes_a_standalone_block_when_there_is_no_sidecar() =>
        Assert.Equal("tags: []\n", DraftTagFiles.AppendTagsBlock("", "tags: []"));
}

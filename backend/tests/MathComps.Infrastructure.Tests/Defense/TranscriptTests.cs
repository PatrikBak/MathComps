using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Defense;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Tests the transcript model: parsing the <c>## Candidate</c> / <c>## Examiner</c> markdown into ordered turns,
/// round-tripping back to markdown, appending a turn, and the guard that the examiner only replies to a candidate.
/// </summary>
public class TranscriptTests
{
    /// <summary>
    /// Parsing splits on the role headings, keeps the turns in order, and takes each block's trimmed body as its text.
    /// </summary>
    [Fact]
    public void Parse_reads_role_blocks_in_order()
    {
        // A two-turn conversation in markdown.
        var markdown = "## Candidate\n\nMy solution splits the triangle.\n\n## Examiner\n\nWhy strictly less than 1/2?";

        // Parse it.
        var transcript = Transcript.Parse(markdown);

        // The turns come back in order, each keyed to its role with the body trimmed.
        TranscriptTurn[] expected =
        [
            new(TranscriptRole.Candidate, "My solution splits the triangle."),
            new(TranscriptRole.Examiner, "Why strictly less than 1/2?"),
        ];
        Assert.Equal(expected, transcript.Turns.ToArray());
    }

    /// <summary>
    /// A level-2 heading inside a turn's prose is not a role boundary — it stays in that turn's body.
    /// </summary>
    [Fact]
    public void Parse_treats_a_non_role_heading_as_body()
    {
        // A candidate turn whose body happens to contain its own level-2 heading.
        var markdown = "## Candidate\n\n## Lemma\n\nThe diameter equals the side.";

        // Parse it.
        var transcript = Transcript.Parse(markdown);

        // One turn only, with the stray heading kept inside its body.
        var turn = Assert.Single(transcript.Turns);
        Assert.Equal(TranscriptRole.Candidate, turn.Role);
        Assert.Contains("## Lemma", turn.Text);
    }

    /// <summary>
    /// Text before the first role heading isn't a turn — it's dropped, never folded into a headless leading block.
    /// </summary>
    [Fact]
    public void Parse_drops_text_before_the_first_heading()
    {
        // A stray title and note sit above the first role heading.
        var markdown = "# Defense log\n\nsome preamble\n\n## Candidate\n\nmy defense";

        // Parse it.
        var transcript = Transcript.Parse(markdown);

        // Only the candidate turn survives; the preamble is gone, not kept as a bodiless first turn.
        var turn = Assert.Single(transcript.Turns);
        Assert.Equal(TranscriptRole.Candidate, turn.Role);
        Assert.Equal("my defense", turn.Text);
    }

    /// <summary>
    /// Rendering a parsed transcript back to markdown and re-parsing it yields the same turns.
    /// </summary>
    [Fact]
    public void ToMarkdown_round_trips_the_turns()
    {
        // Parse a conversation.
        var original = Transcript.Parse("## Candidate\n\nfirst\n\n## Examiner\n\nsecond");

        // Render it back out and parse that again.
        var reparsed = Transcript.Parse(original.ToMarkdown());

        // The round trip preserves the turns exactly.
        Assert.Equal(original.Turns.ToArray(), reparsed.Turns.ToArray());
    }

    /// <summary>
    /// Appending adds the new turn at the end and leaves the original transcript unchanged.
    /// </summary>
    [Fact]
    public void Append_adds_a_turn_without_mutating_the_original()
    {
        // A one-turn transcript.
        var original = Transcript.Parse("## Candidate\n\nmy defense");

        // Append an examiner reply.
        var extended = original.Append(TranscriptRole.Examiner, "  a probing question  ");

        // The original is untouched; the new transcript carries the appended, trimmed turn last.
        Assert.Single(original.Turns);
        Assert.Equal(
            new TranscriptTurn(TranscriptRole.Examiner, "a probing question"),
            extended.Turns[^1]);
    }

    /// <summary>
    /// Truncating keeps the conversation through the requested candidate turn and drops everything after it, so the
    /// result awaits the examiner at that point.
    /// </summary>
    [Fact]
    public void TruncateAfterCandidate_keeps_through_the_requested_turn()
    {
        // A three-exchange conversation.
        var transcript = Transcript.Parse(
            "## Candidate\n\nc1\n\n## Examiner\n\ne1\n\n## Candidate\n\nc2\n\n## Examiner\n\ne2\n\n## Candidate\n\nc3");

        // Rewind to the second candidate turn.
        var truncated = transcript.TruncateAfterCandidate(2);

        // The first exchange survives intact, the second candidate turn closes the transcript, and the rest is gone.
        TranscriptTurn[] expected =
        [
            new(TranscriptRole.Candidate, "c1"),
            new(TranscriptRole.Examiner, "e1"),
            new(TranscriptRole.Candidate, "c2"),
        ];
        Assert.Equal(expected, truncated.Turns.ToArray());
    }

    /// <summary>
    /// The default rewind target — one candidate turn — strips a driven conversation back to its opening seed.
    /// </summary>
    [Fact]
    public void TruncateAfterCandidate_to_one_strips_back_to_the_opening_seed()
    {
        // A conversation with two exchanges past the seed.
        var transcript = Transcript.Parse(
            "## Candidate\n\nopener\n\n## Examiner\n\ne1\n\n## Candidate\n\nc2\n\n## Examiner\n\ne2");

        // Rewind to the opener.
        var truncated = transcript.TruncateAfterCandidate(1);

        // Only the opening candidate turn remains.
        var turn = Assert.Single(truncated.Turns);
        Assert.Equal(new TranscriptTurn(TranscriptRole.Candidate, "opener"), turn);
    }

    /// <summary>
    /// Asking to keep more candidate turns than the conversation holds is refused, naming the actual count.
    /// </summary>
    [Fact]
    public void TruncateAfterCandidate_throws_when_the_transcript_is_too_short()
    {
        // A conversation with two candidate turns.
        var transcript = Transcript.Parse("## Candidate\n\nc1\n\n## Examiner\n\ne1\n\n## Candidate\n\nc2");

        // Keeping three is impossible.
        var exception = Assert.Throws<InvalidOperationException>(() => transcript.TruncateAfterCandidate(3));

        // The error names what's actually there.
        Assert.Contains("only 2 candidate turn(s)", exception.Message);
    }

    /// <summary>
    /// A non-positive keep count is rejected outright — at least the opening candidate turn must remain.
    /// </summary>
    [Fact]
    public void TruncateAfterCandidate_throws_on_a_non_positive_count()
    {
        // Any conversation at all.
        var transcript = Transcript.Parse("## Candidate\n\nc1");

        // Zero keeps nothing to reply to.
        Assert.Throws<ArgumentOutOfRangeException>(() => transcript.TruncateAfterCandidate(0));
    }

    /// <summary>
    /// The awaiting-examiner guard passes when the last turn is the candidate's — the examiner has something to answer.
    /// </summary>
    [Fact]
    public void EnsureAwaitingExaminer_passes_when_the_candidate_spoke_last()
    {
        // A transcript ending on a candidate turn.
        var transcript = Transcript.Parse("## Examiner\n\na question\n\n## Candidate\n\nan answer");

        // The guard is satisfied — no throw.
        transcript.EnsureAwaitingExaminer();
    }

    /// <summary>
    /// The guard rejects a transcript whose last turn is the examiner's — the candidate hasn't answered yet.
    /// </summary>
    [Fact]
    public void EnsureAwaitingExaminer_throws_when_the_examiner_spoke_last()
    {
        // A transcript ending on an examiner turn.
        var transcript = Transcript.Parse("## Candidate\n\nmy defense\n\n## Examiner\n\na question");

        // The guard refuses it.
        Assert.Throws<InvalidOperationException>(transcript.EnsureAwaitingExaminer);
    }

    /// <summary>
    /// The guard rejects an empty transcript — there's nothing for the examiner to reply to.
    /// </summary>
    [Fact]
    public void EnsureAwaitingExaminer_throws_when_empty()
    {
        // A transcript with no turns.
        var transcript = Transcript.Parse("");

        // The guard refuses it.
        Assert.Throws<InvalidOperationException>(transcript.EnsureAwaitingExaminer);
    }
}

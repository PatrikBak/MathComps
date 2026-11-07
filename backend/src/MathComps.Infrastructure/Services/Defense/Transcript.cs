using System.Collections.Immutable;
using System.Net.Mime;
using System.Text;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Shared.Extensions;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// One turn of a defense conversation.
/// </summary>
/// <param name="Role">Who authored the turn.</param>
/// <param name="Text">The turn's text.</param>
/// <param name="Crops">The drawings cut from the photos the turn was sent with, in order; empty for a turn sent as
/// text alone.</param>
public record TranscriptTurn(TranscriptRole Role, string Text, ImmutableArray<PhotoCrop> Crops);

/// <summary>
/// A defense conversation in its markdown form: alternating <c>## Candidate</c> / <c>## Examiner</c> blocks. Parses
/// that markdown into turns, renders back to it or to the user message a model reads, and knows that the examiner
/// only ever replies to a candidate's turn.
/// </summary>
/// <param name="Turns">The turns in order.</param>
public record Transcript(ImmutableArray<TranscriptTurn> Turns)
{
    /// <summary>
    /// Parses a transcript from its markdown, splitting on the <c>## Candidate</c> / <c>## Examiner</c> headings and
    /// taking each block's body as that turn's text. Text before the first heading is dropped; any other heading is
    /// folded into the current turn's body like ordinary text.
    /// </summary>
    /// <param name="markdown">The transcript markdown.</param>
    /// <returns>The parsed transcript.</returns>
    public static Transcript Parse(string markdown)
    {
        // Collect the turns as we walk the lines.
        var turns = ImmutableArray.CreateBuilder<TranscriptTurn>();

        // The role and accumulated body of the block currently being read.
        TranscriptRole? currentRole = null;
        var currentBody = new StringBuilder();

        // Emit the current block as a turn, then reset the accumulator.
        void Flush()
        {
            // Only once we've seen a heading is there a block to emit.
            if (currentRole is { } role)
                turns.Add(new TranscriptTurn(role, currentBody.ToString().Trim(), Crops: []));

            // Reset for the next block.
            currentBody.Clear();
        }

        // Walk each line, normalizing line endings first so \r\n and \n parse the same.
        foreach (var line in markdown.ReplaceLineEndings("\n").Split('\n'))
        {
            // Match the line against the role headings.
            var heading = MatchRoleHeading(line);

            // A role heading opens a new block.
            if (heading is { } role)
            {
                // Flush the previous block.
                Flush();

                // Open the new block for this role.
                currentRole = role;
            }
            // Any other line is body, but only once a block is open.
            else if (currentRole is not null)
            {
                // Accumulate the body of the block we're inside.
                currentBody.AppendLine(line);
            }
        }

        // Close the final block.
        Flush();

        // Hand back the parsed conversation.
        return new Transcript(turns.ToImmutable());
    }

    /// <summary>
    /// Renders the conversation back to its markdown form — one <c>## Role</c> heading per turn, bodies separated by
    /// blank lines. The turns' drawings are left out.
    /// </summary>
    /// <returns>The transcript markdown, without a trailing newline.</returns>
    public string ToMarkdown() =>
        Turns.Select(turn => $"## {turn.Role}\n\n{turn.Text}").ToJoinedString("\n\n");

    /// <summary>
    /// Renders the conversation as the user message a model reads: the markdown form, with each drawing right after
    /// the text of the turn it came with, under a caption naming its marker. A conversation without drawings is one
    /// text, equal to <see cref="ToMarkdown"/>.
    /// </summary>
    /// <returns>The conversation as text and images, in order.</returns>
    public ChatUserMessage ToPrompt()
    {
        // The message, built up turn by turn.
        var message = new ChatUserMessage([]);

        // Walk the turns in order.
        foreach (var (index, turn) in Turns.Index())
        {
            // Every turn after the first is set off by a blank line, as in the markdown form.
            var separator = index == 0 ? "" : "\n\n";

            // The turn's heading and text.
            message = message.Append($"{separator}## {turn.Role}\n\n{turn.Text}");

            // Each drawing follows the turn's text, under a caption naming the marker the text points at it by. A crop
            // is always a JPEG.
            foreach (var crop in turn.Crops)
                message = message
                    .Append($"\n\nTheir drawing [{crop.Label}]:")
                    .Append(new ChatImage(crop.Image, MediaTypeNames.Image.Jpeg));
        }

        // Hand back the message.
        return message;
    }

    /// <summary>
    /// Returns a new transcript with one turn appended.
    /// </summary>
    /// <param name="role">Who authored the appended turn.</param>
    /// <param name="text">The turn's text.</param>
    /// <returns>The extended transcript.</returns>
    public Transcript Append(TranscriptRole role, string text) =>
        new(Turns.Add(new TranscriptTurn(role, text.Trim(), Crops: [])));

    /// <summary>
    /// Returns a new transcript truncated to end with its <paramref name="candidateCount"/>-th candidate turn,
    /// dropping every turn after it. The result always ends awaiting the examiner.
    /// </summary>
    /// <param name="candidateCount">How many candidate turns to keep; the last of them closes the transcript.</param>
    /// <returns>The truncated transcript.</returns>
    public Transcript TruncateAfterCandidate(int candidateCount)
    {
        // Keeping no candidate turn would leave nothing to reply to — reject the count outright.
        if (candidateCount < 1)
            throw new ArgumentOutOfRangeException(
                nameof(candidateCount), candidateCount, "At least one candidate turn must be kept.");

        // The positions of the candidate turns, in conversation order.
        var candidateIndexes = Turns.Index()
            .Where(pair => pair.Item.Role == TranscriptRole.Candidate)
            .Select(pair => pair.Index)
            .ToList();

        // Asking for more candidate turns than the conversation holds is a caller error — name the actual count.
        if (candidateIndexes.Count < candidateCount)
            throw new InvalidOperationException(
                $"The transcript has only {candidateIndexes.Count} candidate turn(s) — cannot keep {candidateCount}.");

        // Keep everything through the requested candidate turn, dropping the rest.
        return new Transcript([.. Turns.Take(candidateIndexes[candidateCount - 1] + 1)]);
    }

    /// <summary>
    /// Throws when the transcript isn't ready for an examiner turn — the examiner replies to a candidate, so the last
    /// turn must be the candidate's.
    /// </summary>
    public void EnsureAwaitingExaminer()
    {
        // No turns at all — there's nothing for the examiner to reply to.
        if (Turns.Length == 0)
            throw new InvalidOperationException(
                "Transcript is empty — add a '## Candidate' turn before running the examiner.");

        // A trailing examiner turn means the candidate hasn't answered yet.
        if (Turns[^1].Role != TranscriptRole.Candidate)
            throw new InvalidOperationException(
                "The last transcript turn must be '## Candidate' — the examiner replies to the candidate.");
    }

    /// <summary>
    /// Matches a line as a <c>## Candidate</c> or <c>## Examiner</c> role heading, tolerating surrounding whitespace
    /// and either casing. Any other level-2 heading (e.g. one inside a turn's prose) is not a role boundary.
    /// </summary>
    /// <param name="line">The line to test.</param>
    /// <returns>The role the heading opens, or null when the line isn't a role heading.</returns>
    private static TranscriptRole? MatchRoleHeading(string line)
    {
        // Trim surrounding whitespace.
        var trimmed = line.Trim();

        // A line not starting with "## " is body, not a heading.
        if (!trimmed.StartsWith("## ", StringComparison.Ordinal))
            return null;

        // The word after the marker names the role.
        var role = trimmed[3..].Trim();

        // A "## Candidate" heading opens a candidate turn.
        if (role.Equals("Candidate", StringComparison.OrdinalIgnoreCase))
            return TranscriptRole.Candidate;

        // A "## Examiner" heading opens an examiner turn.
        if (role.Equals("Examiner", StringComparison.OrdinalIgnoreCase))
            return TranscriptRole.Examiner;

        // Some other heading — not a turn boundary.
        return null;
    }
}

using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Dtos;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// A no-cost fake <see cref="IExaminer"/> that makes no model call: it returns a scripted Socratic probe keyed
/// by how many candidate turns the conversation holds, with clean guard verdicts and no revisions. It drives the whole
/// persistence and API path without spending tokens — selected at runtime by the <c>Examiner:UseFake</c> flag. Its
/// reported usage is configurable so a caller can drive a non-zero spend.
/// </summary>
/// <param name="usage">The spend and tokens each turn reports (zero by default, since nothing is spent).</param>
public class FakeExaminer(ModelUsage usage = default)
    : IExaminer
{
    /// <summary>
    /// The scripted probes, one per candidate turn in order, generic enough to read as a challenge on any problem.
    /// </summary>
    private static readonly string[] _scriptedReplies =
    [
        "Right so far. But you lean on that step as if it were obvious. Spell it out: *why* does it follow from what "
            + "you established just before?",
        "Careful. You've shown the claim holds in the case you picked, but the problem asks for *all* of them. What "
            + "rules out the case you skipped?",
        "That closes the gap I was worried about. Now, you invoked a bound without justifying it. Where does that "
            + "bound come from, and is it tight enough for the conclusion?",
        "Good. So the argument stands for the main case. Convince me the boundary case doesn't break it.",
        "Fair, that holds. I have nothing left to push on here. Want to write up the final step cleanly, or take on a "
            + "different problem?",
    ];

    /// <summary>
    /// The reply used once the scripted sequence is exhausted, keeping the conversation coherent no matter how long
    /// it runs.
    /// </summary>
    private const string FallbackReply =
        "That reasoning is sound. Restate the whole argument in order, and check that each step depends only on the "
        + "ones before it.";

    /// <inheritdoc/>
    public Task<ExaminerTurnOutcome> NextReplyAsync(
        string problem, string reference, Transcript transcript, ModelUsageAccumulator turnUsage,
        CancellationToken cancellationToken = default)
    {
        // The examiner replies to the candidate — hold to the same precondition as the real engine.
        transcript.EnsureAwaitingExaminer();

        // Pick the probe by how many candidate turns have been spoken, falling back once the script runs out.
        var candidateTurns = transcript.Turns.Count(turn => turn.Role == TranscriptRole.Candidate);
        var reply = candidateTurns >= 1 && candidateTurns <= _scriptedReplies.Length
            ? _scriptedReplies[candidateTurns - 1]
            : FallbackReply;

        // Fold the configured usage in like a real call would, so the accumulator matches the reported outcome.
        turnUsage.Add(usage);

        // A fake reply always holds and never leaks; report the configured usage.
        return Task.FromResult(new ExaminerTurnOutcome(
            reply, new MathCheckResult(true, ""), new LeakCheckResult(false, "", false, ""), 0, false, usage));
    }
}

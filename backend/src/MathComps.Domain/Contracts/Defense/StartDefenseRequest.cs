namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request to open a defense conversation: the problem being defended plus the student's first message.
/// Carries the statement and reference so the examiner can reason and later turns re-run without resending them.
/// </summary>
/// <param name="ProblemKey">Stable, source-namespaced key of the problem being defended (e.g. <c>handout:...</c>).</param>
/// <param name="Statement">The problem statement, seen by both sides.</param>
/// <param name="Reference">The reference solution the examiner reasons from.</param>
/// <param name="Opener">The examiner's opening greeting, shown as the conversation's first turn.</param>
/// <param name="Content">The student's first message.</param>
public record StartDefenseRequest(
    string ProblemKey, string Statement, string Reference, string Opener, string Content);

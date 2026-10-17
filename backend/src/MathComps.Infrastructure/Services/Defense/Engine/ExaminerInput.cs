namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// What the examiner works from: the problem, its reference solution, and the conversation so far.
/// </summary>
/// <param name="Problem">The problem statement, seen by both sides.</param>
/// <param name="Reference">The reference solution, the examiner's ground truth for the problem's facts.</param>
/// <param name="Transcript">The conversation so far.</param>
public record ExaminerInput(string Problem, string Reference, Transcript Transcript);

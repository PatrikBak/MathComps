using MathComps.Infrastructure.Services.Defense.Dtos;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// One generated reply, the verdicts every guard passed on it, and the calls that produced them. A turn is a
/// sequence of these: the last one ships and the rest were rejected, so the sequence is the record of what the
/// examiner tried and what each guard said about it.
/// </summary>
/// <param name="Reply">The generated reply.</param>
/// <param name="RevisionNote">The flaw the generator was told to fix, or empty on the turn's first attempt.</param>
/// <param name="MathCheck">The math-check verdict on the reply.</param>
/// <param name="LeakCheck">The leak-check verdict on the reply.</param>
/// <param name="LanguageCheck">The language-check verdict on the reply.</param>
/// <param name="Calls">The model calls this attempt made, in the order they were started.</param>
/// <param name="DurationMs">
/// How long the attempt took end to end, in milliseconds. The guards judge concurrently, so this is shorter than its
/// calls add up to and can't be recovered from them.
/// </param>
public record ExaminerAttempt(
    string Reply,
    string RevisionNote,
    MathCheckResult MathCheck,
    LeakCheckResult LeakCheck,
    LanguageCheckResult LanguageCheck,
    IReadOnlyList<ExaminerStepCall> Calls,
    int DurationMs);

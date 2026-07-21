namespace MathComps.Infrastructure.Services.Defense.Dtos;

/// <summary>
/// The leak-check step's verdict on whether the reply mis-pays earned progress — hands out a step the candidate
/// hasn't earned, or withholds the close they have.
/// </summary>
/// <param name="Leaks">Whether the reply hands the candidate progress they should have reached themselves.</param>
/// <param name="WhatLeaked">The specific step or idea given away, when it leaks; empty when nothing leaks.</param>
/// <param name="WithholdsClose">Whether the reply keeps demanding more although the candidate's solution is already
/// complete at the problem's level.</param>
/// <param name="Established">The complete argument the candidate has assembled, when the close is withheld; empty
/// otherwise.</param>
public record LeakCheckResult(bool Leaks, string WhatLeaked, bool WithholdsClose, string Established);

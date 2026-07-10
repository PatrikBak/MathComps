namespace MathComps.Cli.Examiner.Dtos;

/// <summary>
/// The leak-check step's verdict on whether the reply over-explains.
/// </summary>
/// <param name="Leaks">Whether the reply hands the candidate progress they should have reached themselves.</param>
/// <param name="WhatLeaked">The specific step or idea given away, when it leaks; empty when nothing leaks.</param>
public record LeakCheckResult(bool Leaks, string WhatLeaked);

namespace MathComps.Cli.Examiner.Dtos;

/// <summary>
/// The math-check step's verdict on the claims the examiner's reply makes.
/// </summary>
/// <param name="Holds">Whether every claim is correct against the reference — true too when the reply makes none.</param>
/// <param name="Correction">Which claim is wrong and the correct statement, when one fails; empty when all hold.</param>
public record MathCheckResult(bool Holds, string Correction);

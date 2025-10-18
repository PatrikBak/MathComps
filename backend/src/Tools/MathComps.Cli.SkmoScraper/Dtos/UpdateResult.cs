namespace MathComps.Cli.SkmoScraper.Dtos;

/// <summary>
/// Result of updating problems with solution links.
/// </summary>
/// <param name="ProblemsUpdated">Number of problems that were actually updated.</param>
/// <param name="TotalProblemsFound">Total number of problems that matched the criteria.</param>
public record UpdateResult(int ProblemsUpdated, int TotalProblemsFound);

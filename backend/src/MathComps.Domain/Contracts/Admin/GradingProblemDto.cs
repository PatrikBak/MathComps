namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One problem of a competition being graded.
/// </summary>
/// <param name="Id">The problem's identifier.</param>
/// <param name="Slug"><inheritdoc cref="EfCoreEntities.Problem.Slug" path="/summary"/></param>
/// <param name="Number"><inheritdoc cref="EfCoreEntities.Problem.Number" path="/summary"/></param>
public record GradingProblemDto(Guid Id, string Slug, int Number);

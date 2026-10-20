using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One category the selection's organization picks problems for.
/// </summary>
/// <param name="Name"><inheritdoc cref="OrganizationCategory.Name" path="/summary"/></param>
/// <param name="HostedCategory"><inheritdoc cref="OrganizationCategory.HostedCategory" path="/summary"/></param>
public record SelectionCategoryDto(string Name, HostedCompetitionCategory? HostedCategory);

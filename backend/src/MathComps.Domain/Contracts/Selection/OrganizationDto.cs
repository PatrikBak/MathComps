using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// An organization whose selection a reader may open.
/// </summary>
/// <param name="Slug"><inheritdoc cref="Organization.Slug" path="/summary"/></param>
/// <param name="Name"><inheritdoc cref="Organization.Name" path="/summary"/></param>
public record OrganizationDto(string Slug, string Name);

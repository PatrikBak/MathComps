using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Reads everything an organization's problem selection holds, every proposal and board in it the organization's
/// own. A board finalized into a group leaves the selection once the group opens, and its problems with it.
/// </summary>
public interface IProblemSelectionService
{
    /// <summary>
    /// Reads an organization's whole selection at once.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection it is.
    /// </param>
    /// <param name="reviewerId">
    /// The reviewer reading it: their own ratings come back marked as theirs, and the categories they lead come
    /// back named.
    /// </param>
    /// <param name="language">The language the cycles are named in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The selection.</returns>
    Task<SelectionDto> GetSelectionAsync(
        string organizationSlug, Guid reviewerId, Language language, CancellationToken cancellationToken = default);
}

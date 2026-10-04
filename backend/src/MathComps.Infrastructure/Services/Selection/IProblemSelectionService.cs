using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Reads everything the problem selection holds. A board finalized into a group leaves the selection once the group
/// opens, and its problems with it.
/// </summary>
public interface IProblemSelectionService
{
    /// <summary>
    /// Reads the whole selection at once.
    /// </summary>
    /// <param name="language">The language the cycles are named in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The selection.</returns>
    Task<SelectionDto> GetSelectionAsync(Language language, CancellationToken cancellationToken = default);
}

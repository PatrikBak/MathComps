using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Users;

/// <summary>
/// Reads what one account has been allowed past the site's ordinary rules.
/// </summary>
public interface IUserGrantService
{
    /// <summary>
    /// Whether an account holds a capability. A grant stands until it is revoked, so every rule reads it
    /// afresh.
    /// </summary>
    /// <param name="userId">The account the capability is read for.</param>
    /// <param name="capability">The capability being read for.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether they hold it.</returns>
    Task<bool> HasAsync(Guid userId, UserCapability capability, CancellationToken cancellationToken = default);
}

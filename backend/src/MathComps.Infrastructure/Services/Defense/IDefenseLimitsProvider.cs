using MathComps.Domain.Contracts.Defense;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Provides the caps a defense is held to that a caller has to know.
/// </summary>
public interface IDefenseLimitsProvider
{
    /// <inheritdoc cref="DefenseLimitsDto" path="/summary"/>
    DefenseLimitsDto Limits { get; }
}

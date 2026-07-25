using MathComps.Domain.Contracts.Defense;

namespace MathComps.Infrastructure.Services.Defense;

/// <inheritdoc cref="StartDefenseRequest" path="/summary"/>
/// <param name="Target"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Target']"/></param>
/// <param name="Statement"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Statement']"/></param>
/// <param name="Reference"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Reference']"/></param>
/// <param name="Opener"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Opener']"/></param>
/// <param name="Content"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Content']"/></param>
/// <param name="Hints"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Hints']"/></param>
public record DefenseSessionStart(
    HandoutEnvironmentTarget Target, string Statement, string Reference, string Opener, string Content,
    IReadOnlyList<string>? Hints = null);

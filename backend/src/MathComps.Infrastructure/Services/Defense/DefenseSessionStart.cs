using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense;

/// <inheritdoc cref="StartDefenseRequest" path="/summary"/>
/// <param name="Target"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Target']"/></param>
/// <param name="Content"><inheritdoc cref="StartDefenseRequest" path="/param[@name='Content']"/></param>
/// <param name="Language">The language the student is working in, which decides which variant of the handout the
/// examiner is given and which words she opens with.</param>
public record DefenseSessionStart(HandoutEnvironmentTarget Target, string Content, Language Language);

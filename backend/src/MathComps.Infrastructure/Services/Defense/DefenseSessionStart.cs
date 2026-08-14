using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Everything one opening turn needs: the request itself, plus the language it is being read in.
/// The language is all a <see cref="StartDefenseRequest"/> is missing, so nothing else is restated here.
/// </summary>
/// <param name="Request"><inheritdoc cref="StartDefenseRequest" path="/summary"/></param>
/// <param name="Language">The language the student is working in, which decides which variant of the handout the
/// examiner is given and which words she opens with.</param>
public record DefenseSessionStart(StartDefenseRequest Request, Language Language);

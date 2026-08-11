using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// The examiner's own words, in the student's language — the lines she says that no model wrote. They are served
/// from here rather than accepted from the caller, so nothing a client sends can enter a transcript wearing the
/// examiner's voice.
/// </summary>
public interface IDefenseCopy
{
    /// <summary>
    /// The greeting that opens every conversation.
    /// </summary>
    /// <param name="language">The language the student is working in.</param>
    /// <returns>The greeting.</returns>
    string GetOpener(Language language);
}

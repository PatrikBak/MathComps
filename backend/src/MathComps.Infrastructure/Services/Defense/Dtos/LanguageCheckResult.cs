namespace MathComps.Infrastructure.Services.Defense.Dtos;

/// <summary>
/// The language-check step's verdict on whether the reply is written in the language the candidate is writing in.
/// </summary>
/// <param name="SwitchesLanguage">Whether the reply is unmistakably in a different language from the candidate's
/// latest turn. Close pairs and doubtful calls come back false, since a needless regeneration costs more than the
/// occasional missed drift.</param>
/// <param name="CandidateLanguage">The language the candidate's latest turn is written in, named in English. Filled
/// in whether or not anything is flagged.</param>
public record LanguageCheckResult(bool SwitchesLanguage, string CandidateLanguage);

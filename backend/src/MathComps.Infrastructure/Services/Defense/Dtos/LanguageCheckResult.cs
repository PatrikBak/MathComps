namespace MathComps.Infrastructure.Services.Defense.Dtos;

/// <summary>
/// The language-check step's verdict on the reply beside the candidate's latest turn: whether it is written in the
/// candidate's language, and whether it assumes their gender.
/// </summary>
/// <param name="SwitchesLanguage">Whether the reply is unmistakably in a different language from the candidate's
/// latest turn. Close pairs and doubtful calls come back false, since a needless regeneration costs more than the
/// occasional missed drift.</param>
/// <param name="CandidateLanguage">The language the candidate's latest turn is written in, named in English. Filled
/// in whether or not anything is flagged.</param>
/// <param name="GendersTheReader">Whether a word in the reply takes the candidate for a man or a woman, which the
/// examiner has no way of knowing. False when the candidate's own latest turn uses that form about themselves, since
/// the reply is then following them rather than guessing.</param>
public record LanguageCheckResult(bool SwitchesLanguage, string CandidateLanguage, bool GendersTheReader);

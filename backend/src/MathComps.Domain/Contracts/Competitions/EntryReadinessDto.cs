namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// What a student's account already holds of what an entry asks for. The profile fields gate entry; the rules
/// are accepted as part of spending one.
/// </summary>
/// <param name="HasUsername">
/// Whether the student has chosen the permanent name the site calls them by.</param>
/// <param name="HasAnsweredGraduation">
/// Whether the student has said where they are in school. Having left answers it as much as a year does.</param>
/// <param name="HasEmail">Whether the student has an email address on file.</param>
/// <param name="HasAcceptedRules">Whether the student has ever accepted the competition rules.</param>
public record EntryReadinessDto(
    bool HasUsername,
    bool HasAnsweredGraduation,
    bool HasEmail,
    bool HasAcceptedRules);

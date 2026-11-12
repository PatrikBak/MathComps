using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Hands a student's phone photos over to a defense composer open on another device. The student asks for a code,
/// which works for a while and points at the problem they last asked for it on. The phone sends photos by the code
/// alone, each read at once as the student's and kept for that problem, and the composer takes the pages waiting for
/// its problem. The code is the only thing letting a phone in, so it is never shown to anyone but the student.
/// </summary>
public interface IDefensePhotoHandoffService
{
    /// <summary>
    /// Points the student's code at a target, making them one if they have none that still works. A target the student
    /// may not argue is refused, as it is when they start a conversation on it.
    /// </summary>
    /// <param name="userId">The student asking for the code.</param>
    /// <param name="target">The problem their composer is on.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The student's live code.</returns>
    Task<DefensePhotoHandoffCodeDto> PointAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default);

    /// <summary>
    /// Finds the student a code sends photos for.
    /// </summary>
    /// <param name="code">The code, as the phone holds it.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The student's <see cref="User.ExternalId"/>, or null when the code is unknown or has run out.</returns>
    Task<string?> FindStudentAsync(string code, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads where a code sends photos now.
    /// </summary>
    /// <param name="code">The code, as the phone holds it.</param>
    /// <param name="language">The language to name the problem in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The problem the code points at, and until when it works.</returns>
    /// <exception cref="DefensePhotoHandoffNotFoundException">Thrown when the code is unknown or has run
    /// out.</exception>
    Task<DefensePhotoHandoffTargetDto> CheckAsync(
        string code, Language language, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads a photo sent by a code as the code's student, for the problem the code points at as the send starts, and
    /// keeps it waiting for that problem's composer. The reading is held to everything one from the composer is, and
    /// refused as one would be.
    /// </summary>
    /// <param name="code">The code, as the phone holds it.</param>
    /// <param name="capturedAt"><inheritdoc cref="DefensePhotoHandoffPage.CapturedAt" path="/summary"/></param>
    /// <param name="photo">The photo file, read only once the code is found to work.</param>
    /// <param name="language">The language to name the problem in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The reading, and the problem the page went to.</returns>
    /// <exception cref="DefensePhotoHandoffNotFoundException">Thrown when the code is unknown or has run
    /// out.</exception>
    Task<DefensePhotoHandoffReadingDto> SendAsync(
        string code,
        DateTimeOffset capturedAt,
        Stream photo,
        Language language,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes the pages the student's phone sent to a target that no composer has taken yet, so another composer on
    /// the same problem never gets them too.
    /// </summary>
    /// <param name="userId">The student whose pages to take.</param>
    /// <param name="target">The problem their composer is on.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The pages, and whether the student's code still works.</returns>
    Task<DefensePhotoHandoffPagesDto> TakeAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a handoff code is unknown or has run out (indistinguishable to the caller).
/// </summary>
public sealed class DefensePhotoHandoffNotFoundException()
    : MathCompsException(
        "Photo handoff code not found",
        RefusalKind.NotFound,
        LogLevel.Information);

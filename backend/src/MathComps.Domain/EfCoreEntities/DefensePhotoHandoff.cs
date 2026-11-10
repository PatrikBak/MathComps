using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A student's handoff of photos from their phone into a defense composer open on another device: the code the phone
/// sends photos by, until when it works, and the problem photos sent through it go to now. A student has at most one,
/// pointed at a problem each time they ask for it and given a new code then if the old one has run out.
/// </summary>
/// <remarks>
/// The problem is held as arms, of which exactly one is set: a handout environment or an archive problem, the
/// same rows a session's target rows point at.
/// </remarks>
public class DefensePhotoHandoff
{
    /// <summary>
    /// How many characters a code has.
    /// </summary>
    public const int CodeLength = 32;

    /// <summary>
    /// The student whose photos the code sends; also this row's primary key, since a student has one handoff.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the student.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// The secret the phone sends its photos by, random and unique.
    /// </summary>
    /// <remarks>
    /// Kept as made, since the student is shown it again for as long as it works.
    /// </remarks>
    [MaxLength(CodeLength)]
    public required string Code { get; set; }

    /// <summary>
    /// When the code stops working.
    /// </summary>
    public required DateTimeOffset ExpiresAt { get; set; }

    /// <summary>
    /// The handout environment photos go to now. Null when they go to an archive problem.
    /// </summary>
    public Guid? HandoutEnvironmentId { get; set; }

    /// <summary>
    /// Navigation to the handout environment.
    /// </summary>
    public HandoutEnvironment? HandoutEnvironment { get; set; }

    /// <summary>
    /// The archive problem photos go to now. Null when they go to a handout environment.
    /// </summary>
    public Guid? ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem? Problem { get; set; }
}

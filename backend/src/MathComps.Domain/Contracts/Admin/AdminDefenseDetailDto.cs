using System.Text.Json;
using MathComps.Domain.Contracts.Defense;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One defense conversation in full, for reading back: everything the student saw, everything the examiner was
/// given, the settings it ran on, and what has already been written about it.
/// </summary>
/// <param name="Id">The conversation's identifier.</param>
/// <param name="Target"><inheritdoc cref="NamedDefenseTarget" path="/summary"/></param>
/// <param name="User"><inheritdoc cref="AdminDefenseUserDto" path="/summary"/></param>
/// <param name="Statement">The problem statement as it stood when the conversation was started.</param>
/// <param name="Reference">
/// The reference solution the examiner held, the author's hints already folded into it.
/// </param>
/// <param name="ExaminerConfig">
/// The examiner settings the conversation ran on, as recorded. Passed through as it was stored rather than read
/// into a shape, so the settings can change without this becoming wrong.
/// </param>
/// <param name="Turns">The conversation in order.</param>
/// <param name="Attempts">
/// Every reply the examiner drafted on its way to each of its turns, in order. Turns held before the drafts were
/// kept carry none.
/// </param>
/// <param name="Reports">What the student holds against individual replies.</param>
/// <param name="Feedback">What the student said about the whole conversation, or null when they said nothing.</param>
/// <param name="Notes">What has been written about it while reviewing, newest first.</param>
/// <param name="ReadAt">
/// When this reviewer last read it, or null while they never have. Marking it read is a separate write, so this is
/// still where the last pass stopped.
/// </param>
/// <param name="CreatedAt">When the conversation was started.</param>
public record AdminDefenseDetailDto(
    Guid Id,
    NamedDefenseTarget Target,
    AdminDefenseUserDto User,
    string Statement,
    string Reference,
    JsonElement ExaminerConfig,
    IReadOnlyList<DefenseTurnDto> Turns,
    IReadOnlyList<AdminDefenseAttemptDto> Attempts,
    IReadOnlyList<DefenseTurnReportDto> Reports,
    DefenseFeedbackDto? Feedback,
    IReadOnlyList<AdminNoteDto> Notes,
    DateTimeOffset? ReadAt,
    DateTimeOffset CreatedAt);

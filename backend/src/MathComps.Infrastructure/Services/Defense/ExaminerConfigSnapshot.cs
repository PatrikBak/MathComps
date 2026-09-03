namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// One step's recorded config in a session's snapshot: its model and reasoning settings, plus its prompt template's
/// raw text at the time it was recorded — the path alone can't tell a session run before an edit to that file apart
/// from one run after.
/// </summary>
/// <param name="PromptPath">Path to the step's prompt template.</param>
/// <param name="PromptText">The prompt template's raw text, uninterpolated, as read when this was recorded.</param>
/// <param name="Model">The model the step was configured to run on.</param>
/// <param name="FallbackModels">The backup models the step was configured to fall back through, in order; empty when
/// it rode on its primary alone.</param>
/// <param name="ReasoningEffort">The reasoning-effort level the step ran at, or null when none was sent.</param>
/// <param name="MaxOutputTokens">The cap on the step's output tokens, or null for the model's default.</param>
public sealed record ChatStepConfigSnapshot(
    string PromptPath, string PromptText, string Model, IReadOnlyList<string> FallbackModels,
    string? ReasoningEffort, int? MaxOutputTokens);

/// <summary>
/// One note's recorded text in a session's snapshot, alongside where it was read from. The path alone can't tell a
/// session run before an edit to that file apart from one run after.
/// </summary>
/// <param name="Path">Path to the note.</param>
/// <param name="Text">The note's raw text, uninterpolated, as read when this was recorded.</param>
public sealed record ExaminerNoteConfigSnapshot(string Path, string Text);

/// <summary>
/// The examiner engine's full config as recorded on a session at creation — the same shape as
/// <see cref="Options.ExaminerSettings"/>, with every prompt template's and note's text captured alongside its
/// path.
/// </summary>
/// <param name="Generate">The recorded generate step.</param>
/// <param name="MathCheck">The recorded math-check step.</param>
/// <param name="LeakCheck">The recorded leak-check step.</param>
/// <param name="LanguageCheck">The recorded language-check step.</param>
/// <param name="Notes">The recorded notes, keyed by name in camelCase
/// — the same names <see cref="Options.ExaminerNotesSettings"/> gives them.</param>
/// <param name="MaxRevisions">The revision cap in force.</param>
public sealed record ExaminerConfigSnapshot(
    ChatStepConfigSnapshot Generate, ChatStepConfigSnapshot MathCheck, ChatStepConfigSnapshot LeakCheck,
    ChatStepConfigSnapshot LanguageCheck, IReadOnlyDictionary<string, ExaminerNoteConfigSnapshot> Notes,
    int MaxRevisions);

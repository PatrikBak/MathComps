namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// One step's recorded config in a session's snapshot: its model and reasoning settings, plus its prompt template's
/// raw text at the time it was recorded — the path alone can't tell a session run before an edit to that file apart
/// from one run after.
/// </summary>
/// <param name="PromptPath">Path to the step's prompt template.</param>
/// <param name="PromptText">The prompt template's raw text, uninterpolated, as read when this was recorded.</param>
/// <param name="Model">The model the step ran on.</param>
/// <param name="ReasoningEffort">The reasoning-effort level the step ran at, or null when none was sent.</param>
/// <param name="MaxOutputTokens">The cap on the step's output tokens, or null for the model's default.</param>
public sealed record ChatStepConfigSnapshot(
    string PromptPath, string PromptText, string Model, string? ReasoningEffort, int? MaxOutputTokens);

/// <summary>
/// The examiner engine's full config as recorded on a session at creation — the same shape as
/// <see cref="Options.ExaminerSettings"/>, with each step's prompt template text captured alongside its path.
/// </summary>
/// <param name="Generate">The recorded generate step.</param>
/// <param name="MathCheck">The recorded math-check step.</param>
/// <param name="LeakCheck">The recorded leak-check step.</param>
/// <param name="MaxRevisions">The revision cap in force.</param>
public sealed record ExaminerConfigSnapshot(
    ChatStepConfigSnapshot Generate, ChatStepConfigSnapshot MathCheck, ChatStepConfigSnapshot LeakCheck,
    int MaxRevisions);

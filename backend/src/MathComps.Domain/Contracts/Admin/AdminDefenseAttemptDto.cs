using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One model call an attempt made, and what it billed. Admin-only, like everything else here.
/// </summary>
/// <param name="Step"><inheritdoc cref="DefenseAttemptCall.Step" path="/summary"/></param>
/// <param name="Model"><inheritdoc cref="DefenseAttemptCall.Model" path="/summary"/></param>
/// <param name="ReasoningEffort"><inheritdoc cref="DefenseAttemptCall.ReasoningEffort" path="/summary"/></param>
/// <param name="Cost"><inheritdoc cref="DefenseAttemptCall.Cost" path="/summary"/></param>
/// <param name="PromptTokens"><inheritdoc cref="DefenseAttemptCall.PromptTokens" path="/summary"/></param>
/// <param name="CompletionTokens"><inheritdoc cref="DefenseAttemptCall.CompletionTokens" path="/summary"/></param>
/// <param name="ReasoningTokens"><inheritdoc cref="DefenseAttemptCall.ReasoningTokens" path="/summary"/></param>
public record AdminDefenseAttemptCallDto(
    ExaminerStep Step,
    string Model,
    string? ReasoningEffort,
    decimal Cost,
    int PromptTokens,
    int CompletionTokens,
    int ReasoningTokens);

/// <summary>
/// One reply the examiner drafted on its way to a turn, every guard's verdict on it, and what drafting and judging
/// it cost.
/// <para>
/// This is admin-only and must stay off <see cref="Defense.DefenseTurnDto"/>, which the student's own endpoint
/// returns: a rejected draft is the leak or the wrong claim a guard caught, so handing it to the student would give
/// away precisely what the loop exists to withhold.
/// </para>
/// </summary>
/// <param name="TurnId"><inheritdoc cref="DefenseTurnAttempt.TurnId" path="/summary"/></param>
/// <param name="AttemptIndex"><inheritdoc cref="DefenseTurnAttempt.AttemptIndex" path="/summary"/></param>
/// <param name="Reply"><inheritdoc cref="DefenseTurnAttempt.Reply" path="/summary"/></param>
/// <param name="RevisionNote"><inheritdoc cref="DefenseTurnAttempt.RevisionNote" path="/summary"/></param>
/// <param name="MathHolds"><inheritdoc cref="DefenseTurnAttempt.MathHolds" path="/summary"/></param>
/// <param name="MathCorrection"><inheritdoc cref="DefenseTurnAttempt.MathCorrection" path="/summary"/></param>
/// <param name="Leaks"><inheritdoc cref="DefenseTurnAttempt.Leaks" path="/summary"/></param>
/// <param name="WhatLeaked"><inheritdoc cref="DefenseTurnAttempt.WhatLeaked" path="/summary"/></param>
/// <param name="WithholdsClose"><inheritdoc cref="DefenseTurnAttempt.WithholdsClose" path="/summary"/></param>
/// <param name="Established"><inheritdoc cref="DefenseTurnAttempt.Established" path="/summary"/></param>
/// <param name="SwitchesLanguage"><inheritdoc cref="DefenseTurnAttempt.SwitchesLanguage" path="/summary"/></param>
/// <param name="CandidateLanguage"><inheritdoc cref="DefenseTurnAttempt.CandidateLanguage" path="/summary"/></param>
/// <param name="IsSafeFallback"><inheritdoc cref="DefenseTurnAttempt.IsSafeFallback" path="/summary"/></param>
/// <param name="Calls"><inheritdoc cref="DefenseTurnAttempt.Calls" path="/summary"/></param>
public record AdminDefenseAttemptDto(
    Guid TurnId,
    int AttemptIndex,
    string Reply,
    string RevisionNote,
    bool MathHolds,
    string MathCorrection,
    bool Leaks,
    string WhatLeaked,
    bool WithholdsClose,
    string Established,
    bool SwitchesLanguage,
    string CandidateLanguage,
    bool IsSafeFallback,
    IReadOnlyList<AdminDefenseAttemptCallDto> Calls);

using MathComps.Infrastructure.Options;

namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// One chat call's request: the step it serves, the two messages that make it up, the routing it takes, and the limits
/// it runs under.
/// </summary>
/// <param name="StepName">The name of the step the call serves.</param>
/// <param name="SystemPrompt">The system message: instructions and any grounding.</param>
/// <param name="UserPrompt">The user message: the input the model acts on.</param>
/// <param name="Model">The model to route this call to, in <c>vendor/model</c> form.</param>
/// <param name="FallbackModels">Backup models to try in order, each in <c>vendor/model</c> form, when
/// <paramref name="Model"/> fails on the provider's side; empty to send no fallback field.</param>
/// <param name="ReasoningEffort">The reasoning-effort level for this call, or null to send no reasoning field.</param>
/// <param name="MaxOutputTokens">A cap on the reply's output tokens, reasoning included, or null for the model's
/// default.</param>
public record ChatCallRequest(
    string StepName,
    string SystemPrompt,
    string UserPrompt,
    string Model,
    IReadOnlyList<string> FallbackModels,
    string? ReasoningEffort,
    int? MaxOutputTokens)
{
    /// <summary>
    /// Builds the request for a configured step: the step supplies the routing and the limits, the caller the step's
    /// name and the two messages.
    /// </summary>
    /// <param name="stepName">The name of the step the call serves.</param>
    /// <param name="step">The routing and limits the step runs under.</param>
    /// <param name="systemPrompt">The system message: instructions and any grounding.</param>
    /// <param name="userPrompt">The user message: the input the model acts on.</param>
    /// <returns>The request, ready to send.</returns>
    public static ChatCallRequest For(
        string stepName, ChatStepSettings step, string systemPrompt, string userPrompt) =>
        new(
            stepName,
            systemPrompt,
            userPrompt,
            step.Model,
            step.FallbackModels,
            step.ReasoningEffort,
            step.MaxOutputTokens);
}

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Defines the contract for a service that interacts with the Gemini API.
/// </summary>
public interface IGeminiService
{
    /// <summary>
    /// Generates content using the specified model and prompts.
    /// </summary>
    /// <param name="model">The AI model to use.</param>
    /// <param name="systemPrompt">The system prompt to guide the AI's behavior.</param>
    /// <param name="userPrompt">The user's prompt containing the specific request.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The generated text content.</returns>
    Task<string> GenerateContentAsync(string model, string systemPrompt, string userPrompt, int thinkingBudget, CancellationToken cancellationToken = default);
}

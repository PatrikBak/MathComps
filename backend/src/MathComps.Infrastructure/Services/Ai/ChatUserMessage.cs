namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// A chat call's user message: the input the model acts on, as text and images in the order the model reads them.
/// </summary>
/// <param name="Parts">The message's text and images, in order.</param>
public record ChatUserMessage(IReadOnlyList<ChatPart> Parts)
{
    /// <summary>
    /// Builds a text-only message, which holds the text as its one part.
    /// </summary>
    /// <param name="text">The message's text.</param>
    public ChatUserMessage(string text)
        : this([new ChatText(text)])
    {
    }
}

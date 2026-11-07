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

    /// <summary>
    /// Returns a new message with text added at its end, joined onto the last part when that part is text, so a
    /// text-only message stays one text part.
    /// </summary>
    /// <param name="text">The text to add.</param>
    /// <returns>The longer message.</returns>
    public ChatUserMessage Append(string text) => Parts is [.., ChatText last]
        // A trailing text takes the new text onto its end.
        ? new ChatUserMessage([.. Parts.SkipLast(1), new ChatText(last.Text + text)])
        // After an image, or in an empty message, the text becomes a part of its own.
        : new ChatUserMessage([.. Parts, new ChatText(text)]);

    /// <summary>
    /// Returns a new message with an image added at its end.
    /// </summary>
    /// <param name="image">The image to add.</param>
    /// <returns>The longer message.</returns>
    public ChatUserMessage Append(ChatImage image) => new([.. Parts, image]);
}

namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// A run of text in a chat call's user message.
/// </summary>
/// <param name="Text">The text, as the model reads it.</param>
public sealed record ChatText(string Text) : ChatPart;

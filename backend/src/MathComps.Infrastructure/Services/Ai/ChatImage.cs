namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// An image in a chat call's user message.
/// </summary>
/// <param name="Data">The image file's bytes.</param>
/// <param name="MediaType">The image's media type, such as <c>image/jpeg</c>.</param>
public sealed record ChatImage(ReadOnlyMemory<byte> Data, string MediaType) : ChatPart;

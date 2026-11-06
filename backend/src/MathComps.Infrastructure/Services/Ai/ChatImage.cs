namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// An image a chat call shows the model alongside the user message's text.
/// </summary>
/// <param name="Data">The image file's bytes.</param>
/// <param name="MediaType">The image's media type, such as <c>image/jpeg</c>.</param>
public record ChatImage(ReadOnlyMemory<byte> Data, string MediaType);

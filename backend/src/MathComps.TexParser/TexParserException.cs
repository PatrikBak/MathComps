namespace MathComps.TexParser;

/// <summary>
/// Represents an error that occurs during the parsing of TeX content.
/// </summary>
/// <inheritdoc/>
/// <param name="message">A message that describes the error.</param>
public class TexParserException(string message) : Exception(message);

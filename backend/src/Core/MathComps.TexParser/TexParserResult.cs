using System.Collections.Immutable;

namespace MathComps.TexParser;

/// <summary>
/// A container for the result of a parsing operation, packaging the parsed data
/// along with a list of any unrecognized TeX commands that were found.
/// </summary>
/// <typeparam name="T">The type of the successfully parsed data.</typeparam>
/// <param name="Data">The successfully parsed data object.</param>
/// <param name="UnknownCommands">A set of command names found during parsing that were not recognized.</param>
public record TexParserResult<T>(T Data, ImmutableHashSet<string> UnknownCommands);

using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.EditorUploads;

/// <summary>
/// Request for links to files the caller uploaded into the text editor.
/// </summary>
/// <param name="Keys">The files' upload keys, null when the request sent null.</param>
public record GetFileLinksRequest(ImmutableList<string>? Keys);

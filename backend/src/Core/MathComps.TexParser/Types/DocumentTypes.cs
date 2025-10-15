using System.Collections.Immutable;

namespace MathComps.TexParser.Types;

/// <summary>
/// Represents the top-level structure of a parsed TeX document,
/// including its title, subtitle, and an ordered list of sections.
/// </summary>
/// <param name="Title">The main title of the document, if present.</param>
/// <param name="Subtitle">The subtitle of the document, if present.</param>
/// <param name="Sections">An ordered list of the sections that make up the document's body.</param>
public record Document(string? Title, string? Subtitle, ImmutableList<Section> Sections);

/// <summary>
/// Represents a single section within a TeX document, defined by a title,
/// a hierarchical level, and its structured content.
/// </summary>
/// <param name="Title">The title of the section.</param>
/// <param name="Level">The section's hierarchical level.</param>
/// <param name="Text">The structured content that forms the body of the section.</param>
public record Section(string Title, int Level, Text Text);

/// <summary>
/// Represents a sequence of structured content blocks, such as paragraphs,
/// lists, or theorems, that form the body of a section or a parsed fragment.
/// </summary>
/// <param name="Content">An ordered list of the content blocks that make up the text.</param>
public record Text(ImmutableList<ContentBlock> Content);

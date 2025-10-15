using System.Collections.Immutable;
using System.Text.Json.Serialization;

namespace MathComps.TexParser.Types;

/// <summary>
/// Serves as the base class for all content blocks within a <see cref="Text"/>.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(Theorem), typeDiscriminator: "theorem")]
[JsonDerivedType(typeof(Exercise), typeDiscriminator: "exercise")]
[JsonDerivedType(typeof(Problem), typeDiscriminator: "problem")]
[JsonDerivedType(typeof(Example), typeDiscriminator: "example")]
[JsonDerivedType(typeof(Paragraph), typeDiscriminator: "paragraph")]
[JsonDerivedType(typeof(Footnote), typeDiscriminator: "footnote")]
[JsonDerivedType(typeof(ItemList), typeDiscriminator: "list")]
[JsonDerivedType(typeof(MathTex), typeDiscriminator: "math")]
[JsonDerivedType(typeof(Image), typeDiscriminator: "image")]
[JsonDerivedType(typeof(PlainText), typeDiscriminator: "text")]
[JsonDerivedType(typeof(BoldText), typeDiscriminator: "bold")]
[JsonDerivedType(typeof(ItalicText), typeDiscriminator: "italic")]
[JsonDerivedType(typeof(QuoteText), typeDiscriminator: "quote")]
public abstract record ContentBlock;

/// <summary>
/// Represents a theorem block, containing a title, a body, and a proof.
/// Corresponds to the \Theorem{title}{body}{proof} command.
/// </summary>
/// <param name="Title">The optional title or name of the theorem.</param>
/// <param name="Body">The content that constitutes the statement of the theorem.</param>
/// <param name="Proof">The content that constitutes the proof of the theorem.</param>
public record Theorem(
    RawContentBlock? Title,
    ImmutableList<RawContentBlock> Body,
    ImmutableList<RawContentBlock> Proof
) : ContentBlock;

/// <summary>
/// Represents an exercise block, containing a title, the exercise body, and a solution.
/// Corresponds to the \Exercise{title}{body}{solution} command.
/// </summary>
/// <param name="Title">The optional title or number of the exercise.</param>
/// <param name="Body">The content that forms the question or problem statement.</param>
/// <param name="Solution">The content that provides the solution to the exercise.</param>
public record Exercise(
    RawContentBlock? Title,
    ImmutableList<RawContentBlock> Body,
    ImmutableList<RawContentBlock> Solution
) : ContentBlock;

/// <summary>
/// Represents a problem block with extended metadata, including difficulty, hints, and a solution.
/// Corresponds to the \Problem{difficulty}{title}{body}{hint1}{hint2}{solution} command.
/// </summary>
/// <param name="Difficulty">A numerical value indicating the problem's difficulty.</param>
/// <param name="Title">The optional title of the problem.</param>
/// <param name="Body">The main content of the problem statement.</param>
/// <param name="Hint1">The content for the first hint.</param>
/// <param name="Hint2">The content for the second hint.</param>
/// <param name="Solution">The content providing the solution to the problem.</param>
public record Problem(
    int Difficulty,
    RawContentBlock? Title,
    ImmutableList<RawContentBlock> Body,
    ImmutableList<RawContentBlock> Hint1,
    ImmutableList<RawContentBlock> Hint2,
    ImmutableList<RawContentBlock> Solution
) : ContentBlock;

/// <summary>
/// Represents an example block, with a title, body, and a solution or explanation.
/// Corresponds to the \Example{title}{body}{solution} command.
/// </summary>
/// <param name="Title">The optional title of the example.</param>
/// <param name="Body">The main content demonstrating the example.</param>
/// <param name="Solution">The content providing a solution or further explanation.</param>
public record Example(
    RawContentBlock? Title,
    ImmutableList<RawContentBlock> Body,
    ImmutableList<RawContentBlock> Solution
) : ContentBlock;

/// <summary>
/// A type of content block that cannot contain <see cref="Problem"/>, <see cref="Exercise"/>, 
/// <see cref="Theorem"/>, or <see cref="Example"/> blocks.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(Paragraph), typeDiscriminator: "paragraph")]
[JsonDerivedType(typeof(Footnote), typeDiscriminator: "footnote")]
[JsonDerivedType(typeof(ItemList), typeDiscriminator: "list")]
[JsonDerivedType(typeof(MathTex), typeDiscriminator: "math")]
[JsonDerivedType(typeof(Image), typeDiscriminator: "image")]
[JsonDerivedType(typeof(PlainText), typeDiscriminator: "text")]
[JsonDerivedType(typeof(BoldText), typeDiscriminator: "bold")]
[JsonDerivedType(typeof(ItalicText), typeDiscriminator: "italic")]
[JsonDerivedType(typeof(QuoteText), typeDiscriminator: "quote")]
public record RawContentBlock : ContentBlock;

/// <summary>
/// Represents a paragraph of text, which can contain various inline content blocks.
/// </summary>
/// <param name="Content">A list of the inline content blocks that make up the paragraph.</param>
public record Paragraph(ImmutableList<RawContentBlock> Content) : RawContentBlock;

/// <summary>
/// Represents a list of items, parsed from a \begitems...\enditems environment.
/// </summary>
/// <param name="Items">A list of items, where each item is itself a list of content blocks.</param>
/// <param name="StyleType">The style of the list markers (e.g., bullet, numbered).</param>
public record ItemList(
    ImmutableList<ImmutableList<RawContentBlock>> Items,
    ListItemStyle StyleType
) : RawContentBlock;

/// <summary>
/// Represents a span of text formatted as bold. Corresponds to the \textbf{...} command.
/// </summary>
/// <param name="Content">The inline content that should be rendered in bold.</param>
public record BoldText(ImmutableList<RawContentBlock> Content) : RawContentBlock;

/// <summary>
/// Represents a span of text formatted in italics. Corresponds to the \textit{...} command.
/// </summary>
/// <param name="Content">The inline content that should be rendered in italics.</param>
public record ItalicText(ImmutableList<RawContentBlock> Content) : RawContentBlock;

/// <summary>
/// Represents a span of quoted text. Corresponds to the \uv{...} command.
/// </summary>
/// <param name="Content">The inline content that is quoted.</param>
public record QuoteText(ImmutableList<RawContentBlock> Content) : RawContentBlock;

/// <summary>
/// Represents an image to be embedded in the document. Corresponds to the \Image{...} command.
/// </summary>
/// <param name="Id">The identifier used to locate the image file.</param>
/// <param name="Scale">The scaling factor to apply to the image's size.</param>
/// <param name="IsInline">Indicates whether the image should appear inline with text or as a block.</param>
public record Image(string Id, decimal Scale, bool IsInline) : RawContentBlock;

/// <summary>
/// Represents a footnote. Corresponds to the \fnote{...} command.
/// </summary>
/// <param name="Content">The content of the footnote.</param>
public record Footnote(ImmutableList<RawContentBlock> Content) : RawContentBlock;

/// <summary>
/// Represents a block of mathematical content, either inline ($...$) or display ($$...$$).
/// </summary>
/// <param name="Text">The raw TeX string containing the mathematical expression.</param>
/// <param name="IsDisplay">True for display math ($$...$$); false for inline math ($...$).</param>
public record MathTex(string Text, bool IsDisplay) : RawContentBlock;

/// <summary>
/// Represents a plain text span without any formatting.
/// </summary>
/// <param name="Text">The raw text to be printed as it is.</param>
public record PlainText(string Text) : RawContentBlock;

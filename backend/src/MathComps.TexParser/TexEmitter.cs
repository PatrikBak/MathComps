using System.Collections.Immutable;
using System.Text;
using MathComps.TexParser.Types;

namespace MathComps.TexParser;

/// <summary>
/// Emits TeX source code from a <see cref="ContentBlock"/> tree structure.
/// This is effectively the inverse operation of <see cref="TexStringParser"/>.
/// </summary>
public static class TexEmitter
{
    /// <summary>
    /// The standard indentation string used for nested content inside statement blocks.
    /// </summary>
    private const string Indent = "    ";

    /// <summary>
    /// Emits TeX source for a complete document.
    /// </summary>
    /// <param name="document">The document to emit.</param>
    /// <returns>The TeX source string.</returns>
    public static string Emit(Document document)
    {
        // Create a builder to accumulate the output TeX source.
        var builder = new StringBuilder();

        // Emit the document title if present.
        if (!string.IsNullOrEmpty(document.Title))
            builder.AppendLine($@"\Title{{{document.Title}}}");

        // Emit each section of the document in order.
        foreach (var section in document.Sections)
            EmitSection(builder, section);

        // Return the accumulated TeX source.
        return builder.ToString();
    }

    /// <summary>
    /// Emits TeX source for a single section, including its header command and content.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="section">The section to emit.</param>
    private static void EmitSection(StringBuilder builder, Section section)
    {
        // Determine the appropriate section command based on nesting level.
        var command = section.Level switch
        {
            // Level 1 uses \sec
            1 => "sec",

            // Level 2 uses \secc
            2 => "secc",

            // Default to \sec for any unexpected levels
            _ => "sec"
        };

        // Add a blank line before the section header for readability.
        builder.AppendLine();

        // Emit the section command followed by the title.
        builder.AppendLine($@"\{command} {section.Title}");

        // Add a blank line after the header before the content.
        builder.AppendLine();

        // Emit all content blocks within this section.
        EmitContentBlocks(builder, section.Text.Content, indent: "");
    }

    /// <summary>
    /// Emits TeX source for a list of content blocks.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="blocks">The content blocks to emit.</param>
    /// <param name="indent">The indentation prefix for each block.</param>
    public static void EmitContentBlocks(StringBuilder builder, IEnumerable<ContentBlock> blocks, string indent)
    {
        // Emit each block sequentially.
        foreach (var block in blocks)
            EmitContentBlock(builder, block, indent);
    }

    /// <summary>
    /// Emits TeX source for a single content block with no indentation.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="block">The content block to emit.</param>
    public static void EmitBlock(StringBuilder builder, ContentBlock block)
        // Delegate to the main emission method with empty indent.
        => EmitContentBlock(builder, block, "");

    /// <summary>
    /// Emits TeX source for a single content block, dispatching to the appropriate
    /// handler based on the block's runtime type.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="block">The content block to emit.</param>
    /// <param name="indent">The indentation prefix for this block.</param>
    private static void EmitContentBlock(StringBuilder builder, ContentBlock block, string indent)
    {
        switch (block)
        {
            // Emit a Theorem block with its title, body, and proof.
            case Theorem theorem:
                EmitTheorem(builder, theorem);
                break;

            // Emit an Exercise block with its title, body, and solution.
            case Exercise exercise:
                EmitExercise(builder, exercise);
                break;

            // Emit a Problem block with its difficulty, title, body, hints, and solution.
            case Problem problem:
                EmitProblem(builder, problem);
                break;

            // Emit an Example block with its title, body, and solution.
            case Example example:
                EmitExample(builder, example);
                break;

            // Emit a definition block with its title and body.
            case Definition definition:
                EmitDefinition(builder, definition);
                break;

            // Emit a paragraph, possibly highlighted.
            case Paragraph paragraph:
                EmitParagraph(builder, paragraph, indent);
                break;

            // Emit an item list with its style and items.
            case ItemList list:
                EmitItemList(builder, list, indent);
                break;

            // Emit a math block (inline or display).
            case MathTex math:
                EmitMath(builder, math, indent);
                break;

            // Emit plain text, converting Unicode back to TeX conventions.
            case PlainText text:
                builder.Append(ToTexText(text.Text));
                break;

            // Emit bold text wrapped in \textbf{}.
            case BoldText bold:
                builder.Append(@"\textbf{");
                EmitRawBlocks(builder, bold.Content);
                builder.Append('}');
                break;

            // Emit italic text wrapped in \textit{}.
            case ItalicText italic:
                builder.Append(@"\textit{");
                EmitRawBlocks(builder, italic.Content);
                builder.Append('}');
                break;

            // Emit quoted text wrapped in \uv{}.
            case QuoteText quote:
                builder.Append(@"\uv{");
                EmitRawBlocks(builder, quote.Content);
                builder.Append('}');
                break;

            // Emit a footnote wrapped in \fnote{}.
            case Footnote footnote:
                builder.Append(@"\fnote{");
                EmitRawBlocks(builder, footnote.Content);
                builder.Append('}');
                break;

            // Emit a hyperlink with \Link[url]{text}.
            case Link link:
                builder.Append($@"\Link[{link.Url}]{{");
                EmitRawBlocks(builder, link.Content);
                builder.Append('}');
                break;

            // Emit an image command, using \Image* for inline images.
            case Image image:
                if (image.IsInline)
                    builder.Append($@"\Image*{{{image.Id}}}");
                else
                    builder.Append($@"\Image{{{image.Id}}}");
                break;

            // Unhandled cases
            default:
                throw new NotSupportedException($"Unsupported content block type: {block.GetType().Name}");
        }
    }

    /// <summary>
    /// Emits TeX source for a sequence of raw content blocks (used inside containers
    /// like bold, italic, footnotes, etc.).
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="blocks">The raw content blocks to emit.</param>
    private static void EmitRawBlocks(StringBuilder builder, ImmutableList<RawContentBlock> blocks)
    {
        // Emit each raw block with no indentation.
        foreach (var block in blocks)
            EmitContentBlock(builder, block, indent: "");
    }

    /// <summary>
    /// Emits a paragraph block, optionally wrapping content in a \highlight{} command.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="paragraph">The paragraph to emit.</param>
    /// <param name="indent">The indentation prefix.</param>
    private static void EmitParagraph(StringBuilder builder, Paragraph paragraph, string indent)
    {
        // Apply indentation before the paragraph content.
        builder.Append(indent);

        // If this is highlighted, wrap in \highlight{.
        if (paragraph.Highligted)
            builder.Append(@"\highlight{");

        // Emit the paragraph's inner content blocks.
        EmitRawBlocks(builder, paragraph.Content);

        // Close the highlight wrapper if needed.
        if (paragraph.Highligted)
            builder.Append('}');

        // Remove any trailing whitespace before the newline.
        TrimTrailingWhitespace(builder);

        // End the paragraph with a newline.
        builder.AppendLine();
    }

    /// <summary>
    /// Emits a math block, using <c>$$...$$</c> for display math and <c>$...$</c> for inline math.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="math">The math block to emit.</param>
    /// <param name="indent">The indentation prefix (used for display math).</param>
    private static void EmitMath(StringBuilder builder, MathTex math, string indent)
    {
        // Convert the parsed math content back to plain TeX format.
        var mathText = ToPlainTexMath(math.Text);

        // If this is display math, emit on its own line with $$ delimiters.
        if (math.IsDisplay)
        {
            // Apply indentation before the opening delimiter.
            builder.Append(indent);

            // Emit the opening $$, the math content, and close with $$.
            builder.Append("$$");
            builder.Append(mathText);
            builder.AppendLine("$$");
        }
        // Otherwise emit inline math with single $ delimiters.
        else
        {
            builder.Append('$');
            builder.Append(mathText);
            builder.Append('$');
        }
    }

    /// <summary>
    /// Emits an item list block (<c>\begitems ... \enditems</c>) with the appropriate
    /// <see cref="ListItemStyle"/> and blank lines for readability.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="list">The item list to emit.</param>
    /// <param name="indent">The indentation prefix.</param>
    private static void EmitItemList(StringBuilder builder, ItemList list, string indent)
    {
        // Map the parsed list style enum back to the OpMac style code.
        var style = list.StyleType switch
        {
            ListItemStyle.Bullet => "*",
            ListItemStyle.LowerRomanParens => "i",
            ListItemStyle.LowerAlphaParens => "a",
            ListItemStyle.UpperAlphaParens => "A",
            ListItemStyle.NumberDot => "n",
            ListItemStyle.NumberParens => "N",
            ListItemStyle.UpperRoman => "I",
            _ => "*"
        };

        // Add a blank line before the list for visual separation.
        builder.AppendLine();

        // Emit the \begitems command.
        builder.Append(indent);
        builder.AppendLine(@"\begitems");

        // Emit the \style command with the resolved style code.
        builder.Append(indent);
        builder.AppendLine($@"\style {style}");

        // Emit each list item with the \i marker.
        foreach (var item in list.Items)
        {
            // Indent and prefix with the item marker.
            builder.Append(indent);
            builder.Append(@"\i ");

            // Emit the item's content blocks.
            EmitRawBlocks(builder, item);

            // Clean up trailing whitespace before ending the line.
            TrimTrailingWhitespace(builder);
            builder.AppendLine();
        }

        // Emit the closing \enditems command.
        builder.Append(indent);
        builder.AppendLine(@"\enditems");
    }

    #region Statement Blocks

    /// <summary>
    /// Emits a theorem block: <c>\Theorem{title}{body}{proof}</c>.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="theorem">The theorem to emit.</param>
    private static void EmitTheorem(StringBuilder builder, Theorem theorem)
    {
        // Open the \Theorem command and emit the title argument.
        builder.Append(@"\Theorem{");
        EmitOptionalTitle(builder, theorem.Title);
        builder.AppendLine("}{");

        // Emit the theorem body as indented content.
        EmitContentBlocks(builder, theorem.Body, Indent);
        TrimTrailingWhitespace(builder);
        builder.AppendLine();

        // Open the proof argument.
        builder.Append("}{");

        // Emit the proof content if present.
        if (theorem.Proof.Count > 0)
        {
            builder.AppendLine();
            EmitContentBlocks(builder, theorem.Proof, Indent);
            TrimTrailingWhitespace(builder);
            builder.AppendLine();
        }

        // Close the theorem block with a trailing blank line.
        builder.AppendLine("}");
        builder.AppendLine();
    }

    /// <summary>
    /// Emits an exercise block: <c>\Exercise{title}{body}{solution}</c>.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="exercise">The exercise to emit.</param>
    private static void EmitExercise(StringBuilder builder, Exercise exercise)
    {
        // Open the \Exercise command and emit the title argument.
        builder.Append(@"\Exercise{");
        EmitOptionalTitle(builder, exercise.Title);
        builder.AppendLine("}{");

        // Emit the exercise body as indented content.
        EmitContentBlocks(builder, exercise.Body, Indent);
        TrimTrailingWhitespace(builder);
        builder.AppendLine();

        // Open the solution argument.
        builder.Append("}{");

        // Emit the solution content if present.
        if (exercise.Solution.Count > 0)
        {
            builder.AppendLine();
            EmitContentBlocks(builder, exercise.Solution, Indent);
            TrimTrailingWhitespace(builder);
            builder.AppendLine();
        }

        // Close the exercise block with a trailing blank line.
        builder.AppendLine("}");
        builder.AppendLine();
    }

    /// <summary>
    /// Emits a problem block: <c>\Problem{difficulty}{title}{body}{hints...}{solution}</c>.
    /// The number of hint brace groups is variable (zero or more).
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="problem">The problem to emit.</param>
    private static void EmitProblem(StringBuilder builder, Problem problem)
    {
        // Open the \Problem command with the difficulty and title arguments.
        builder.Append($@"\Problem{{{problem.Difficulty}}}{{");
        EmitOptionalTitle(builder, problem.Title);
        builder.AppendLine("}{");

        // Emit the problem body as indented content.
        EmitContentBlocks(builder, problem.Body, Indent);
        TrimTrailingWhitespace(builder);
        builder.AppendLine();

        // Close the body argument.
        builder.Append('}');

        // Emit each hint as a separate brace group.
        foreach (var hint in problem.Hints)
        {
            builder.AppendLine("{");
            EmitContentBlocks(builder, hint, Indent);
            TrimTrailingWhitespace(builder);
            builder.AppendLine();
            builder.Append('}');
        }

        // Open the final brace group for the solution.
        builder.Append('{');

        // Emit the solution content if present.
        if (problem.Solution.Count > 0)
        {
            builder.AppendLine();
            EmitContentBlocks(builder, problem.Solution, Indent);
            TrimTrailingWhitespace(builder);
            builder.AppendLine();
        }

        // Close the solution and the problem block with a trailing blank line.
        builder.AppendLine("}");
        builder.AppendLine();
    }

    /// <summary>
    /// Emits an example block: <c>\Example{title}{body}{solution}</c>.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="example">The example to emit.</param>
    private static void EmitExample(StringBuilder builder, Example example)
    {
        // Open the \Example command and emit the title argument.
        builder.Append(@"\Example{");
        EmitOptionalTitle(builder, example.Title);
        builder.AppendLine("}{");

        // Emit the example body as indented content.
        EmitContentBlocks(builder, example.Body, Indent);
        TrimTrailingWhitespace(builder);
        builder.AppendLine();

        // Open the solution argument.
        builder.Append("}{");

        // Emit the solution content if present.
        if (example.Solution.Count > 0)
        {
            builder.AppendLine();
            EmitContentBlocks(builder, example.Solution, Indent);
            TrimTrailingWhitespace(builder);
            builder.AppendLine();
        }

        // Close the example block with a trailing blank line.
        builder.AppendLine("}");
        builder.AppendLine();
    }


    /// <summary>
    /// Emits a definition block: <c>\Definition{title}{body}</c>.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="definition">The definition to emit.</param>
    private static void EmitDefinition(StringBuilder builder, Definition definition)
    {
        // Open the \Definition command and emit the title argument.
        builder.Append(@"\Definition{");
        EmitOptionalTitle(builder, definition.Title);
        builder.AppendLine("}{");

        // Emit the definition body as indented content.
        EmitContentBlocks(builder, definition.Body, Indent);
        TrimTrailingWhitespace(builder);
        builder.AppendLine();

        // Close the definition block with a trailing blank line.
        builder.AppendLine("}");
        builder.AppendLine();
    }

    /// <summary>
    /// Emits the optional title content for statement blocks (Theorem, Exercise, etc.).
    /// If the title is null, nothing is emitted.
    /// </summary>
    /// <param name="builder">The string builder to append to.</param>
    /// <param name="title">The optional title block, or null if no title is present.</param>
    private static void EmitOptionalTitle(StringBuilder builder, RawContentBlock? title)
    {
        // Only emit the title if one was provided.
        if (title is not null)
            EmitContentBlock(builder, title, indent: "");
    }

    #endregion

    #region Helpers

    /// <summary>
    /// Trims trailing whitespace (spaces and newlines) from the <see cref="StringBuilder"/>.
    /// Used to prevent excessive blank lines when nested content adds its own newlines.
    /// </summary>
    /// <param name="builder">The string builder to trim.</param>
    private static void TrimTrailingWhitespace(StringBuilder builder)
    {
        // Remove characters from the end while they are whitespace.
        while (builder.Length > 0 && char.IsWhiteSpace(builder[^1]))
            builder.Length--;
    }

    /// <summary>
    /// Converts parsed text back to TeX format, reversing the Unicode transformations
    /// applied by <see cref="TexStringParser"/>'s CleanRawText method.
    /// </summary>
    /// <param name="text">The parsed text containing Unicode characters.</param>
    /// <returns>The text with Unicode characters replaced by their TeX equivalents.</returns>
    private static string ToTexText(string text)
    {
        // Reverse em dash (U+2014) back to ---
        text = text.Replace("\u2014", "---");

        // Reverse en dash (U+2013) back to --
        text = text.Replace("\u2013", "--");

        // Reverse non-breaking space (U+00A0) back to ~
        text = text.Replace("\u00A0", "~");

        // Reverse soft hyphen (U+00AD) back to \-
        text = text.Replace("\u00AD", @"\-");

        // Return the TeX-formatted text.
        return text;
    }

    /// <summary>
    /// Converts parsed math back to plain TeX format, reversing the LaTeX normalizations
    /// applied by <see cref="TexCleaner.TeXCleanerRules"/>.
    /// </summary>
    /// <param name="math">The parsed math content with LaTeX-style commands.</param>
    /// <returns>The math content with plain TeX commands restored.</returns>
    private static string ToPlainTexMath(string math)
    {
        // Reverse LaTeX align environment back to plain TeX \align / \endalign.
        math = math.Replace(@"\begin{align*}", @"\align");
        math = math.Replace(@"\end{align*}", @"\endalign");

        // Reverse LaTeX gather environment back to plain TeX \gather / \endgather.
        math = math.Replace(@"\begin{gather*}", @"\gather");
        math = math.Replace(@"\end{gather*}", @"\endgather");

        // Reverse \mathbb{X} back to shorthand \X for common number sets.
        math = math.Replace(@"\mathbb{N}", @"\N");
        math = math.Replace(@"\mathbb{Z}", @"\Z");
        math = math.Replace(@"\mathbb{Q}", @"\Q");
        math = math.Replace(@"\mathbb{R}", @"\R");
        math = math.Replace(@"\mathbb{C}", @"\C");

        // Return the plain TeX math.
        return math;
    }

    #endregion
}

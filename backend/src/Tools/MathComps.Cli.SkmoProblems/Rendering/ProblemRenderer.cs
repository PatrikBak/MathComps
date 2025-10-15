using HtmlAgilityPack;
using PuppeteerSharp;
using System.Collections.Immutable;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using MathComps.TexParser.TexCleaner;
using MathComps.TexParser;
using MathComps.TexParser.Types;
using MathComps.Shared;
using Spectre.Console;
using TexParagraph = MathComps.TexParser.Types.Paragraph;
using TexText = MathComps.TexParser.Types.Text;

namespace MathComps.Cli.SkmoProblems.Rendering;

/// <summary>
/// A static class responsible for parsing raw SKMO TeX problem statements and rendering them into
/// <see cref="Text"/> objects. It can also render these parsed problems into HTML pages for a quick preview.
/// </summary>
public static class ProblemRenderer
{
    #region Private delegates

    /// <summary>
    /// Defines a delegate for a function that loads the raw SVG content. In practice, it reads either
    /// Data/Images/{year}/id.svg or Data/Images/Manual/id.svg.
    /// </summary>
    /// <param name="id">The identifier of the image to load (without file extension).</param> 
    /// <returns>The raw SVG content as a string, or <see langword="null"/> if the image cannot be found.</returns>
    private delegate string? SvgImageLoader(string id);

    #endregion

    #region Public API

    /// <summary>
    /// Asynchronously parses and renders a list of raw TeX problems into HTML files according to the specified configuration.
    /// </summary>
    /// <param name="cleanerRules">The set of rules for cleaning the raw TeX input.</param>
    /// <param name="rawProblems">An immutable list of raw problem data to process.</param>
    /// <param name="config">The configuration object that specifies how to render HTML preview (if at all).</param>
    /// <returns>
    /// A task that resolves to an immutable list of <see cref="ProblemRenderingResult"/>, each containing the
    /// parsed problem, any unknown TeX commands, and any KaTeX rendering errors.
    /// </returns>
    public static async Task<ImmutableList<ProblemRenderingResult>> RenderAsync(
        TeXCleanerRules cleanerRules,
        ImmutableList<SkmoParsedProblem> rawProblems,
        ProblemRenderedConfig config
    )
    {
        // We'll aggregate parsed problems here
        var renderingResults = new List<(SkmoParsedProblem problem, TexText renderedResult, ImmutableHashSet<string> unknownCommands)>();

        // Keep parsing each problem
        foreach (var problem in rawProblems)
        {
            // Parse current problem
            var (statement, unknownCommands) = TexStringParser.ParseText(problem.RawProblem.Statement, cleanerRules,
                // Preprocess the text by handling itemizes...
                currentText => ConvertPotentialItemizeIntoOpmacStyle(problem.RawProblem.Id, currentText)
            );

            // Remember the result
            renderingResults.Add((problem, statement, unknownCommands));
        }

        // We'll aggregate KaTeX errors here...
        var katexErrors = new Dictionary<SkmoParsedProblem, string>();

        // Handle rendering
        switch (config.ProblemRenderingMode)
        {
            // Nothing to do
            case ProblemRenderingMode.NoRendering:
                break;

            // Some rendering
            case ProblemRenderingMode.AllInOneFile:
            case ProblemRenderingMode.SplitByYears:

                // Map problems by id for easy access
                var problemsById = renderingResults.ToDictionary(result => result.problem.RawProblem.Id, result => result.problem);

                // Rendering by year
                if (config.ProblemRenderingMode == ProblemRenderingMode.SplitByYears)
                {
                    // Group problems by year
                    var problemsByYear = renderingResults.GroupBy(result => result.problem.RawProblem.OlympiadYear);

                    // Handle each year
                    foreach (var group in problemsByYear)
                    {
                        // Get the year
                        var year = group.Key;

                        // Render the problems into the year-specific file
                        var currentKatexErrors = await BuildPageAndReturnExceptionsAsync(
                            [.. group.Select(result => (result.problem, result.renderedResult))],
                            Path.Combine(config.HtmlOutputFolder, $"{year}.html")
                        );

                        // Merge the errors
                        currentKatexErrors.ForEach(pair => katexErrors.Add(problemsById[pair.Key], pair.Value));
                    }
                }
                // Rendering into one file
                else
                {
                    // Render the problems into the year-specific file
                    var currentKatexErrors = await BuildPageAndReturnExceptionsAsync(
                        [.. renderingResults.Select(result => (result.problem, result.renderedResult))],
                        Path.Combine(config.HtmlOutputFolder, $"_all.html")
                    );

                    // Merge the errors
                    currentKatexErrors.ForEach(pair => katexErrors.Add(problemsById[pair.Key], pair.Value));
                }

                break;

            // Throw
            default: throw new NotImplementedException($"Unhandled value of {nameof(ProblemRenderingMode)}: {config.ProblemRenderingMode}");
        }

        // Gather the results
        return [.. renderingResults.Select(result => new ProblemRenderingResult(
                // Intentionally ignoring solutions for now as they contain 10000000000 random commands...
                new SkmoParsedProblem(result.problem.RawProblem, result.renderedResult, ParsedSolution: null),
                result.unknownCommands,
                katexErrors.GetValueOrDefault(result.problem)
            )),];
    }

    #endregion

    #region Preprocessing

    /// <summary>
    /// This method will handle LaTeX itemize/enumerate environments + 'implicit' \item
    /// itemizes and convert them into OpMac-style \begitems ... \enditems environments.
    /// <para>For the sake of humanity, it would not be good if anyone else truly ever
    /// needed to understand this code. The SKMO archive files are just a lot of random
    /// stuff accumated over many years. At the time of writing this comment, this code is
    /// can handle what's in the archive. When adding new problems, I will just manually
    /// fix any issues rather than messing with this crazy code.</para>
    /// </summary>
    /// <param name="id">The id of the problem, just for logging.</param>
    /// <param name="statement">The statement to be processed.</param>
    /// <returns>A string where itemize should be in the OpMac format that can be handled by the parses.</returns>
    private static string ConvertPotentialItemizeIntoOpmacStyle(string id, string statement)
    {
        // A helper that will see \item <label> and figure out what type of itemize/enumerate it is
        string DetectStyleFromLabel(string label) => label.Trim() switch
        {
            // Empty string are fine, let the default style be used
            "" => "O",

            // Big bullet is the default
            "$\\bullet$" => "O",

            // Matches i-style patterns
            "i)" or "(i)" or "($i$)" => "i",

            // Lowercase with parenthesis
            "a)" or "(a)" => "a",

            // Upper with parenthesis
            "A)" or "(A)" => "A",

            // Normal numbers
            "1." => "n",

            // Numbers with parenthesis
            "1)" or "(1)" => "N",

            // Big roman numbers
            "I:" => "I",

            // Default case returns null
            _ => throw new Exception($"Problem {id} has some weird item labels: {label}"),
        };

        // A helper that will detect hard boundaries that will end an itemize/enumerate
        static bool IsHardItemizeBoundary(string line)
            => Regex.IsMatch(line, @"^\s*(\\endgraf|\\noindent|\\smallskip|\\medskip|\\bigskip|\\par\b|\\begin\{|\\end\{|\Z)");

        // Before we start, let us remember if we had any itemize/enumerate at all
        var anyItemizeAtTheBeginning = statement.Contains("\\begin{itemize}")
                       || statement.Contains("\\begin{enumerate}")
                       || statement.Contains("\\item");

        // Itemize will be handled manually and recognized from items (as it is how it happens in most cases)
        statement = Regex.Replace(statement, @"\\begin\{itemize\}", "");
        statement = Regex.Replace(statement, @"\\end\{itemize\}", "");

        // End of enumerate is also not needed. The beginning is however needed to detect 
        // that we even want to enumerate and not just itemize...
        statement = Regex.Replace(statement, @"\\end\{enumerate\}", "");

        // Split the statement into lines
        var lines = statement.Split(["\r", "\n", "\r\n"], StringSplitOptions.None);

        // We'll build the new statement here
        var stringBuilder = new StringBuilder();

        // Are we currently in a list?
        var inList = false;

        // Current style of the list
        string currentStyle;

        // Scan line by line
        foreach (var line in lines)
        {
            // Special line, handle the beginning of enumerate
            var enumerateMatch = Regex.Match(line, @"^\s*\\begin\{enumerate\}\s*(\\alphatrue|)$");
            if (enumerateMatch.Success)
            {
                // The first group will be the style...
                currentStyle = enumerateMatch.Groups[1].Value switch
                {
                    // Letters with parenthesis
                    "\\alphatrue" => "a",

                    // When empty, it's just numbers with dots
                    "" => "n",

                    // Guard against unknown values
                    _ => throw new Exception($"Cannot detect enumerable style from line {line}"),
                };

                // Carry on, this line is not needed...Not even setting that we're in a list
                // because a presence of an item will do that for us
                continue;
            }

            // Match an \item macro...
            var match = Regex.Match(line, @"^\s*\\item(?:\s*\{([^}]*)\})?\s*(.*)$");

            // If we have a match...
            if (match.Success)
            {
                // If we are not in a list yet, we'll start one
                if (!inList)
                {
                    // Decide the style from the first label
                    currentStyle = DetectStyleFromLabel(match.Groups[1].Value)!;

                    // Start the list
                    stringBuilder.Append($"\\begitems  \\style {currentStyle}\n");

                    // We are now in a list
                    inList = true;
                }

                // Make the item an \i line
                stringBuilder.Append("\\i ").Append(match.Groups[2].Value).Append('\n');
            }
            // If we don't have a match and we're in a list, we just append the current line
            // and it will be appended to the last item
            else if (inList)
            {
                // Append the line as is
                stringBuilder.Append(line).Append('\n');

                // If we hit a hard boundary...
                if (IsHardItemizeBoundary(line))
                {
                    // End the list
                    stringBuilder.Append("\\enditems\n");

                    // We are no longer in a list
                    inList = false;
                }
            }
            // If we don't have a match and we're not in a list, we just append the current line
            else stringBuilder.Append(line).Append('\n');
        }

        // If we ended while still in a list, close it
        if (inList)
            stringBuilder.Append("\\enditems\n");

        // Get the new statement
        statement = stringBuilder.ToString();

        // Get rid of the \\endgraf which was apparently use a lot to determine the end of an implicit itemize
        statement = Regex.Replace(statement, @"\\endgraf\b", "\n");

        // Final sanity check to see whether we succeeded in converting itemizes/enumerates
        if (anyItemizeAtTheBeginning && (!statement.Contains("\\begitems") || !statement.Contains("\\i")))
            AnsiConsole.MarkupLine($"[yellow]Warning:[/] Problem '[yellow]{Markup.Escape(id)}[/]' seems not to be parsed correctly, itemize/enumerate detected, but none on the output");

        // We're done
        return statement;
    }

    #endregion

    #region Html Rendering

    /// <summary>
    /// Builds a complete HTML page from a list of parsed problems, renders it using a headless browser
    /// to typeset math with KaTeX, and extracts any rendering errors.
    /// </summary>
    /// <param name="problems">A read-only list of tuples, each containing the raw problem data and the parsed problem text.</param>
    /// <param name="path">The file path where the final HTML page will be saved.</param>
    /// <returns>
    /// A task that resolves to an immutable dictionary mapping problem IDs to their corresponding KaTeX error messages.
    /// Only problems that produced an error will be included in the dictionary.
    /// </returns>
    private static async Task<ImmutableDictionary<string, string>> BuildPageAndReturnExceptionsAsync(
        IReadOnlyList<(SkmoParsedProblem rawProblem, TexText parsedProblem)> problems,
        string path
    )
    {
        // Logging
        AnsiConsole.MarkupLine($"[grey]Rendering {problems.Count} problems into {Markup.Escape(path)}[/]");

        #region Head

        // Build the head
        var headNode = HtmlNode.CreateNode("<head></head>");

        // Add the CSS link for KateX
        headNode.AppendChild(HtmlNode.CreateNode(@$"
            <link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.css'>"
        ));

        // Add the link to our stylesheet
        headNode.AppendChild(HtmlNode.CreateNode(@$"
            <link rel='stylesheet' href='styles.css'>"
        ));

        // Add KaTeX
        headNode.AppendChild(HtmlNode.CreateNode(@$"
            <script src='https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.js'></script>"
        ));
        headNode.AppendChild(HtmlNode.CreateNode(@$"
            <script src='https://cdn.jsdelivr.net/npm/katex@latest/dist/contrib/auto-render.min.js'></script>"
        ));

        // For copying the TeX source easily
        headNode.AppendChild(HtmlNode.CreateNode(@$"
            <script src='https://cdn.jsdelivr.net/npm/katex@latest/dist/contrib/copy-tex.min.js'></script>"
        ));

        #endregion

        #region Problems

        // Build the content
        var container = HtmlNode.CreateNode("<div class='container'></div>");

        // Add individual problems
        foreach (var (rawProblem, parsedProblem) in problems)
        {
            // Get the author string
            var author = rawProblem.RawProblem.Authors.IsEmpty ? "neznámy autor" : rawProblem.RawProblem.Authors.ToJoinedString();

            // Get KaTeX compatible HTML
            var problemHtml = RenderProblemHtml(parsedProblem,
                // The SVG-provided should find the right image in the Images folder
                svgProvider: name =>
                {
                    // Local the image with the right extension
                    var imagePath = SkmoImageHelper.FindImageSourcePath(name, rawProblem.RawProblem.OlympiadYear);

                    // If exists, we're happy
                    if (imagePath != null)
                        return File.ReadAllText(imagePath);

                    // If not, make aware
                    AnsiConsole.MarkupLine($"[yellow]Warning:[/] Problem [yellow]{rawProblem.RawProblem.Id}[/] has a missing image: {name}");

                    // We're sad
                    return null;
                });

            // Add the problems
            container.AppendChild(HtmlNode.CreateNode(@$"
                <div class='problem' data-problem='{rawProblem.RawProblem.Id}'>
                <div class='problem-id'>{rawProblem.RawProblem.Id} <span class='problem-author'>{author}</span></div>
                <div class='problem-text'>{problemHtml}</div>
                </div>")
            );
        }

        #endregion

        #region Body

        // Start composing the node
        var bodyNode = HtmlNode.CreateNode("<body></body>");

        // Add the problems
        bodyNode.AppendChild(container);

        // Add the KaTeX script which will setup the property __exceptionsMap__ variable
        // on the window object containing a map from problem ids onto KaTeX exceptions
        // so that we can report them back to the caller. This map will map problem id 
        // onto the exception message from KaTeX.
        bodyNode.AppendChild(HtmlNode.CreateNode(@"
            <script>
                window.onload = function() {
                    var problems = document.getElementsByClassName('problem');
                    var exceptionsMap = {};
                    for (var i = 0; i < problems.length; i++) {
                        var problem = problems[i];
                        renderMathInElement(problem, {
                            delimiters: [
                                {left: '$$', right: '$$', display: true},
                                {left: '$', right: '$', display: false}
                            ],
                            throwOnError: true,
                            errorCallback: function(message, error) {
                                exceptionsMap[problem.getAttribute('data-problem')] = error.toString();
                            }
                        });
                    }
                    window.__exceptionsMap__ = exceptionsMap;
                };
            </script>")
        );

        #endregion

        # region Final Document

        // Create the node
        var htmlNode = HtmlNode.CreateNode("<html></html>");

        // With the head
        htmlNode.AppendChild(headNode);

        // And the body
        htmlNode.AppendChild(bodyNode);

        // Build the final HTML
        var htmlContent = $"<!DOCTYPE html>\n{htmlNode.OuterHtml}";

        #endregion

        #region Rendering

        // Ensure we have the browser ready
        await new BrowserFetcher().DownloadAsync();
        var browser = await Puppeteer.LaunchAsync(new LaunchOptions { Headless = true });
        var page = await browser.NewPageAsync();

        // Setup the html
        await page.SetContentAsync(htmlContent);

        // Wait for the exceptions map to be set in the window object
        await page.WaitForFunctionAsync("() => window.__exceptionsMap__ !== undefined");

        // Get the exception as map mapping from problem ids onto the exception message
        var exceptionsMap = await page.EvaluateExpressionAsync<ImmutableDictionary<string, string>>("window.__exceptionsMap__");

        // Get the rendered HTML after KaTeX has done its job
        var content = await page.GetContentAsync();
        await

                // Write the contents
                File.WriteAllTextAsync(path, content);

        // No browser needed
        await browser.CloseAsync();

        #endregion

        // We're reporting errors back
        return exceptionsMap;
    }

    /// <summary>
    /// Renders the parsed content of a single problem statement into an HTML snippet.
    /// </summary>
    /// <param name="parsedStatement">The parsed problem statement, represented as a <see cref="Text"/> object.</param>
    /// <param name="svgProvider">A delegate used to load SVG content for images.</param>
    /// <returns>An HTML string representing the problem statement.</returns>
    private static string RenderProblemHtml(TexText parsedStatement, SvgImageLoader svgProvider)
    {
        // Prepare the builder
        var stringBuilder = new StringBuilder();

        // We'll buffer inline content here to wrap it in <p> tags
        var inlineBuffer = new List<ContentBlock>();

        // A helper to flush the inline buffer into a <p> tag if it has any content
        void flushInlineBuffer()
        {
            // If we have anything to flush...
            if (inlineBuffer.Count > 0)
            {
                // Create the paragraph
                stringBuilder.Append("<p>");
                stringBuilder.Append(RenderInlineSequence(inlineBuffer, inlineOnly: false, svgProvider));
                stringBuilder.Append("</p>");

                // Clear the buffer
                inlineBuffer.Clear();
            }
        }

        // Scan the content blocks
        foreach (var block in parsedStatement.Content)
        {
            // Check if the block is something that can go inside a <p>.
            var isInlineCapable = block switch
            {
                // Standard inline elements
                PlainText or BoldText or ItalicText or QuoteText or MathTex { IsDisplay: false } => true,

                // An Image can also be inline
                Image { IsInline: true } => true,

                // Everything else is a block-level element
                _ => false,
            };

            // If it's inline-capable...
            if (isInlineCapable)
            {
                // Buffer it for now
                inlineBuffer.Add(block);
            }
            // If it's a paragraph...
            else if (block is TexParagraph paragraph)
            {
                // Flush any pending content first to ensure separate paragraphs render as separate <p> tags
                flushInlineBuffer();

                // Add all of it to the inline buffer
                inlineBuffer.AddRange(paragraph.Content);
            }
            // It's a "hard" block-level element (list, display math, etc.).
            else
            {
                // First, flush any pending inline content into its own <p> tag.
                flushInlineBuffer();

                // Then, render the block-level element itself.
                switch (block)
                {
                    // Itemize/enumerate
                    case ItemList list:
                        stringBuilder.Append(RenderList(list, svgProvider));
                        break;

                    // Display math
                    case MathTex { IsDisplay: true } math:
                        stringBuilder.Append(RenderDisplayMathBlock(math.Text));
                        break;

                    // Images
                    case Image image:
                        stringBuilder.Append(RenderImage(image, svgProvider));
                        break;

                    default:
                        throw new NotSupportedException($"Unsupported top-level content block: {block.GetType().Name}.");
                }
            }
        }

        // After the loop, flush any remaining content in the buffer.
        flushInlineBuffer();

        // We have the built string
        return stringBuilder.ToString();
    }
    #endregion

    #region Inline rendering

    /// <summary>
    /// Renders a sequence of content blocks into an HTML string. Can be constrained to render only inline elements.
    /// </summary>
    /// <param name="items">The collection of <see cref="ContentBlock"/> items to render.</param>
    /// <param name="inlineOnly">If <c>true</c>, block-level elements like lists or display math will cause an exception.</param>
    /// <param name="svgProvider">A delegate used to load SVG content for images.</param>
    /// <returns>An HTML string representing the sequence of content blocks.</returns>
    private static string RenderInlineSequence(IEnumerable<ContentBlock> items, bool inlineOnly, SvgImageLoader svgProvider)
    {
        // Prepare the builder
        var stringBuilder = new StringBuilder();

        // Handle each item
        foreach (var item in items)
        {
            // Handle the item based on its type
            switch (item)
            {
                // Standard text
                case PlainText text:
                    stringBuilder.Append(Html(text.Text));
                    break;

                // Inline math, auto-render will handle it
                case MathTex { IsDisplay: false } math:
                    stringBuilder.Append('$');
                    stringBuilder.Append(Html(math.Text));
                    stringBuilder.Append('$');
                    break;

                // Display math, not allowed inline
                case MathTex { IsDisplay: true } math when !inlineOnly:
                    stringBuilder.Append(RenderDisplayMathBlock(math.Text));
                    break;

                // Inline quotes
                case QuoteText quote:
                    stringBuilder.Append("<q>");
                    stringBuilder.Append(RenderInlineSequence(quote.Content, inlineOnly: true, svgProvider));
                    stringBuilder.Append("</q>");
                    break;

                // Bold text
                case BoldText bold:
                    stringBuilder.Append("<strong>");
                    stringBuilder.Append(RenderInlineSequence(bold.Content, inlineOnly: true, svgProvider));
                    stringBuilder.Append("</strong>");
                    break;

                // Italic text
                case ItalicText italic:
                    stringBuilder.Append("<em>");
                    stringBuilder.Append(RenderInlineSequence(italic.Content, inlineOnly: true, svgProvider));
                    stringBuilder.Append("</em>");
                    break;

                // Always render images, the inlining will be handled by the image itself
                case Image image:
                    stringBuilder.Append(RenderImage(image, svgProvider));
                    break;

                // A list can appear where blocks are allowed (e.g., inside a paragraph container).
                case ItemList list when !inlineOnly:
                    stringBuilder.Append(RenderList(list, svgProvider));
                    break;

                // A paragraph can appear where blocks are allowed (e.g., inside another paragraph).
                case TexParagraph para when !inlineOnly:
                    stringBuilder.Append("<p>");
                    stringBuilder.Append(RenderInlineSequence(para.Content, inlineOnly: false, svgProvider));
                    stringBuilder.Append("</p>");
                    break;

                default:
                    throw new NotSupportedException($"Unsupported inline content: {item.GetType().Name}.");
            }
        }

        // We have the built string
        return stringBuilder.ToString();
    }

    #endregion

    #region List rending

    /// <summary>
    /// Renders an itemize/enumerate object into an HTML string.
    /// </summary>
    /// <param name="list">The list content to render.</param>
    /// <param name="svgProvider">A delegate to load raw images.</param>
    /// <returns>An HTML string representing the list.</returns>
    private static string RenderList(ItemList list, SvgImageLoader svgProvider)
    {
        // Determine the list type and whether we need custom markers.
        var style = list.StyleType;

        // Ordered if not bullet
        var isOrdered = style != ListItemStyle.Bullet;

        // The HTML tag to use: <ol> for ordered lists, <ul> for unordered lists.
        var tag = isOrdered ? "ol" : "ul";

        // Determine if we need to render custom markers.
        var useCustomMarker = style switch
        {
            // These styles require custom markers.
            ListItemStyle.LowerRomanParens => true,
            ListItemStyle.LowerAlphaParens => true,
            ListItemStyle.UpperAlphaParens => true,
            ListItemStyle.NumberParens => true,
            ListItemStyle.UpperRoman => true,

            // By default we use standard browser rendering.
            _ => false,
        };

        // Use a StringBuilder for efficient HTML construction.
        var htmlBuilder = new StringBuilder();

        // Build the opening list tag, either <ol> or <ul> based on whether it's ordered.
        htmlBuilder.Append('<').Append(tag);

        // The 'type' attribute for <ol> to give semantic meaning, even if we override the marker with CSS.
        var typeAttribute = style switch
        {
            // Ordered lists with direct type mappings.
            ListItemStyle.NumberDot => "1",
            ListItemStyle.NumberParens => "1",
            ListItemStyle.UpperAlphaParens => "A",
            ListItemStyle.LowerAlphaParens => "a",
            ListItemStyle.UpperRoman => "I",
            ListItemStyle.LowerRomanParens => "i",

            // Unordered lists or styles without a direct type mapping.
            _ => null,
        };

        // Add the type attribute if applicable.
        if (!string.IsNullOrEmpty(typeAttribute))
            htmlBuilder.Append(" type=\"").Append(typeAttribute).Append('"');

        // Only when we need custom markers, we add a custom CSS class for styling.
        if (useCustomMarker)
            htmlBuilder.Append(" class=\"list\"");

        // Close the opening tag.
        htmlBuilder.Append('>');

        // Iterate through each item in the list to generate its <li> element.
        for (var index = 1; index <= list.Items.Count; index++)
        {
            // Start the list item tag.
            htmlBuilder.Append("<li>");

            // If the style requires it...
            if (useCustomMarker)
            {
                // Generate the custom marker text.
                var markerText = style switch
                {
                    ListItemStyle.LowerRomanParens => $"({IndexFormatters.ToRoman(index).ToLowerInvariant()})",
                    ListItemStyle.LowerAlphaParens => $"({IndexFormatters.ToAlpha(index, useUppercase: false)})",
                    ListItemStyle.UpperAlphaParens => $"({IndexFormatters.ToAlpha(index, useUppercase: true)})",
                    ListItemStyle.NumberParens => $"({index})",
                    ListItemStyle.UpperRoman => $"{IndexFormatters.ToRoman(index)}:",

                    // Bullet and NumberDot use standard browser rendering, so no custom marker is needed.
                    _ => null,
                };

                // Render the marker inside a <span> for styling.
                htmlBuilder.Append("<span class=\"li-marker\">")
                           .Append(Html(markerText))
                           .Append("</span>");
            }

            // Get the collection of blocks for the current item.
            var currentItemBlocks = list.Items[index - 1];

            // This variable will hold the final list of blocks to be rendered.
            var contentToRender = currentItemBlocks.Count == 1 && currentItemBlocks[0] is TexParagraph paragraph
                ? paragraph.Content

                // For all other cases (multiple blocks or a single non-paragraph block),
                // we render the item's blocks as they are.
                : currentItemBlocks;

            // Special case: if a list item contains just a single paragraph, we "unwrap" it
            // by rendering its inner content directly inside the <li>. This avoids a redundant <p> tag.

            // Render the determined content sequence.
            htmlBuilder.Append(RenderInlineSequence(contentToRender, inlineOnly: false, svgProvider));

            // Close the list item tag.
            htmlBuilder.Append("</li>");
        }

        // Append the closing list tag and return the final HTML string.
        htmlBuilder.Append("</").Append(tag).Append('>');

        // Return the constructed HTML.
        return htmlBuilder.ToString();
    }

    #endregion

    #region Math rendering

    /// <summary>
    /// Render a math block for KaTeX auto-render using <c>$$ ... $$</c>.
    /// </summary>
    /// <param name="mathText">The math block to render.</param>
    private static string RenderDisplayMathBlock(string mathText)
    {
        // We'll emit $$...$$ so auto-render picks it up as display math.
        var stringBuilder = new StringBuilder();

        // Wrap in a div for KaTeX display math styling
        stringBuilder.Append("<div class=\"math-display\">$$")
                     .Append(Html(mathText))
                     .Append("$$</div>");

        // Return the built string
        return stringBuilder.ToString();
    }

    #endregion

    #region Image rendering

    /// <summary>
    /// Renders an <see cref="Image"/> object into an HTML string, using an embedded SVG data URL.
    /// </summary>
    /// <param name="img">The image object to render.</param>
    /// <param name="svgProvider">A delegate that provides the raw SVG content for the image ID.</param>
    /// <returns>An HTML string containing either an inline <c>&lt;span&gt;</c> or a block-level <c>&lt;div&gt;</c> with the image.</returns>
    private static string RenderImage(Image img, SvgImageLoader svgProvider)
    {
        // Get SVG content (if any)
        var rawSvg = svgProvider(img.Id);

        // Get the final SVG content
        var svgContent = rawSvg is not null ? StripXmlProlog(rawSvg!) : BuildPlaceholderSvg(img.Id);

        // Convert SVG to data URL
        var base64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(svgContent));
        var dataUrl = $"data:image/svg+xml;base64,{base64}";

        // Prepare the scale style
        var scaleStyle = $"zoom: {img.Scale.ToString(CultureInfo.InvariantCulture)}";

        // Return the HTML code based on whether it's inline or block
        return img.IsInline
            ? $@"<span class=""problem-figure--inline""><object data=""{dataUrl}"" type=""image/svg+xml"" style=""{scaleStyle}""/></span>"
            : $@"<div class=""problem-figure""><object data=""{dataUrl}"" type=""image/svg+xml"" style=""{scaleStyle}""/></div>";
    }

    /// <summary>
    /// Removes the leading XML declaration (e.g., <c>&lt;?xml ... ?&gt;</c>) from a string.
    /// </summary>
    /// <param name="svg">The string content, typically an SVG file, to process.</param>
    /// <returns>The content with the XML prolog removed.</returns>
    private static string StripXmlProlog(string svg) => Regex.Replace(svg, @"^\s*<\?xml[^>]*\?>\s*", string.Empty, RegexOptions.IgnoreCase);

    /// <summary>
    /// Creates a placeholder SVG image as a string, indicating that an image is missing.
    /// </summary>
    /// <param name="label">The identifier or name of the missing image to display in the placeholder.</param>
    /// <returns>A string containing the raw SVG for the placeholder image.</returns>
    private static string BuildPlaceholderSvg(string label)
        // Simple dashed box with centered label; inline-safe (no XML prolog)
        => $@"<svg xmlns=""http://www.w3.org/2000/svg"" width=""320"" height=""180"" viewBox=""0 0 320 180"" role=""img"">
            <rect x=""4"" y=""4"" width=""312"" height=""172"" fill=""none"" stroke=""#c33"" stroke-width=""2"" stroke-dasharray=""6 6""/>
            <text x=""50%"" y=""50%"" text-anchor=""middle"" dominant-baseline=""middle"" font-family=""system-ui, Segoe UI, Arial"" font-size=""14"" fill=""#c33"">Missing {Html(label)}</text>
        </svg>";

    #endregion

    #region Helpers

    /// <summary>
    /// Escaped given text to be safely embedded in HTML.
    /// </summary>
    /// <param name="text">The text to be HTML-encoded.</param>
    /// <returns>The HTML-encoded text.</returns>
    private static string Html(string? text) => WebUtility.HtmlEncode(text ?? string.Empty);

    #endregion
}

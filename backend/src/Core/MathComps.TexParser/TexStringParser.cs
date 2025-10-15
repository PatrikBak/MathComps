using System.Collections.Immutable;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MathComps.Shared;
using MathComps.TexParser.TexCleaner;
using MathComps.TexParser.Types;

namespace MathComps.TexParser;

/// <summary>
/// A class used for parsing PlainTeX...It can handle to handle two things:
/// <list type="number">
/// <item>Parsing handouts represent <see cref="Document"/> via the method 
/// <see cref="ParseDocument(string, TeXCleanerRules, Func{string, string}?)"/></item>
/// <item>Parsing math problems represent as <see cref="Text"/> via the method 
/// <see cref="ParseText(string, TeXCleanerRules, Func{string, string}?)"/></item>
/// </list>
/// Both these method work with <see cref="TeXCleanerRules"/> and are able to find
/// 'unknown' commands. 
/// During parsing, lots of stuff is going on, special commands/behavours is as follows:
/// <list type="bullet">
/// <item><c>\\sec Title</c> and <c>\\secc Title</c> define sections; the title is the rest of the line.</item>
/// <item><c>\\Title{...}</c> and <c>\\Subtitle{...}</c> for the document's header.</item>
/// <item><c>\\Theorem{title}{body}{proof}</c></item>
/// <item><c>\\Exercise{title}{body}{solution}</c></item>
/// <item><c>\\Problem{difficulty}{title}{body}{hint1}{hint2}{solution}</c></item>
/// <item><c>\\Example{title}{body}{solution}</c></item>
/// <item><c>\\begitems ... \\enditems</c> for lists, with <c>\\i</c> for items. Optional style via <c>\\style code</c>.
/// See <see cref="ListItemStyle"/> for the information about style codes.</item>
/// <item><c>$$...$$</c> for display math and <c>$...$</c> for inline math.</item>
/// <item><c>\\textbf{...}</c>, <c>\\textit{...}</c>, <c>\\fnote{...}</c>, <c>\\uv{...}</c> for inline styles.</item>
/// <item><c>\\Image{id}{scale}</c> for images, with a star (<c>\\Image*</c>) for inline images.</item>
/// <item>Ligatures <c>--</c> (en dash), <c>---</c> (em dash) and non-breaking spaces <c>~</c> are supported.</item>
/// <item>Comments start with an unescaped <c>%</c> and go to the end of the line.</item>
/// </list>
/// </summary>
public static class TexStringParser
{
    #region Private Static Fields

    /// <summary>
    /// Maps OpMac list style codes to our <see cref="ListItemStyle"> enum.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, ListItemStyle> _texListStyleMap = new Dictionary<string, ListItemStyle>
    {
        { "O", ListItemStyle.Bullet },
        { "i", ListItemStyle.LowerRomanParens },
        { "a", ListItemStyle.LowerAlphaParens },
        { "A", ListItemStyle.UpperAlphaParens },
        { "n", ListItemStyle.NumberDot },
        { "N", ListItemStyle.NumberParens },
        { "I", ListItemStyle.UpperRoman },
    };

    #endregion

    #region Public API

    /// <summary>
    /// Parses a string representing a full TeX document. It extracts the title, subtitle, and sections, 
    /// parsing the content of each into structured blocks. Finally, It identifies any TeX 
    /// commands not present in the provided list of known macros taken from <paramref name="rules"/>.
    /// </summary>
    /// <param name="content">The raw TeX string content of the document.</param>
    /// <param name="rules">A set of rules used for preprocessing the TeX, including known macros.</param>
    /// <param name="postprocess">An optional function for additional processing after cleaning but before parsing.</param>
    /// <returns>A <see cref="TexParserResult{T}"/> containing the parsed <see cref="Document"/> and a set of unknown commands.</returns>
    public static TexParserResult<Document> ParseDocument(string content, TeXCleanerRules rules, Func<string, string>? postprocess = null)
    {
        // Apply rules
        content = rules.ApplyToRawTex(content);

        // No comments
        content = CleanTex(content);

        // Optional postprocessing step
        if (postprocess != null)
            content = postprocess(content);

        // Use regex to find the document title. Might be null if not found.
        var titleMatch = Regex.Match(content, @"\\Title\{(.*?)\}", RegexOptions.Singleline);
        var title = titleMatch.Success ? titleMatch.Groups[1].Value.Trim() : null;

        // Use regex to find the document subtitle; Might be null if not found.
        var subtitleMatch = Regex.Match(content, @"\\Subtitle\{(.*?)\}", RegexOptions.Singleline);
        var subtitle = subtitleMatch.Success ? subtitleMatch.Groups[1].Value.Trim() : null;

        // Split the document into parts based on the occurrence of section commands (\sec or \secc).
        var sectionParts = Regex.Split(content, @"(?=\\se[c]{1,2}\s)");

        // Process each section part, parse it, and create a Section object.
        var sections = sectionParts
            // Skip the part before the first section command, which is not a valid section.
            .Skip(1)
            // Project each valid section part into a Section object.
            .Select(part =>
            {
                // Match \sec Title or \secc Title; title is up to newline OR end-of-string.
                var sectionTitleMatch = Regex.Match(
                    part,
                    @"\\sec(c)?\s+([^\r\n]+)(?:\r?\n|$)"
                );

                // If no title is found, this part is invalid.
                if (!sectionTitleMatch.Success)
                    throw new TexParserException($"Malformed section header in part: {part}");

                // Level = 1 for \sec, 2 for \secc.
                var level = sectionTitleMatch.Groups[1].Success ? 2 : 1;

                // Extract the title
                var sectionTitle = sectionTitleMatch.Groups[2].Value.Trim();

                // Everything after the matched header is section body.
                var contentStartIndex = sectionTitleMatch.Index + sectionTitleMatch.Length;
                var sectionContentRaw = contentStartIndex < part.Length ? part[contentStartIndex..] : string.Empty;

                // Parse body into content blocks
                var text = ParseContentBlocks(sectionContentRaw);

                // Return the section
                return new Section(sectionTitle, level, new([.. text]));
            })
            // Enumerate
            .ToImmutableList();

        // Return the final Document object, containing the title, subtitle, and all parsed sections.
        var document = new Document(title, subtitle, sections);

        // Scan the commands after parsing the full document.
        var commands = FindCommands(document.Sections.SelectMany(section => section.Text.Content));

        // Find unknown commands
        var unknownCommands = commands.Except(rules.KnownMacros);

        // We're done
        return new(document, unknownCommands);
    }

    /// <summary>
    /// Parses a fragment of TeX content into a structured <see cref="Text"/> object. It also identifies any TeX 
    /// commands not present in the provided list of known macros taken from <paramref name="rules"/>.
    /// </summary>
    /// <param name="content">The raw TeX string fragment to be parsed.</param>
    /// <param name="rules">A set of rules for preprocessing the TeX, which includes known macros.</param>
    /// <param name="postprocess">An optional function for extra custom processing before parsing.</param>
    /// <returns>A <see cref="TexParserResult{T}"/> with the parsed <see cref="Text"/> object and any unknown commands.</returns>
    public static TexParserResult<Text> ParseText(string content, TeXCleanerRules rules, Func<string, string>? postprocess = null)
    {
        // Apply rules
        content = rules.ApplyToRawTex(content);

        // No comments
        content = CleanTex(content);

        // Optional postprocessing step
        if (postprocess != null)
            content = postprocess(content);

        // Parse the content
        var blocks = ParseContentBlocks(content);

        // Find unknown commands
        var unknownCommands = FindCommands(blocks).Except(rules.KnownMacros);

        // We're done
        return new(new Text([.. blocks]), unknownCommands);
    }

    #endregion

    #region Parsing Methods

    /// <summary>
    /// Removes comments + trims whitespace from each line of TeX content.
    /// </summary>
    /// <param name="text"></param>
    /// <returns></returns>
    private static string CleanTex(string text)
        // Split the content into individual lines.
        => text.Split(["\r\n", "\r", "\n"], StringSplitOptions.None)
            // For each line, find the comment character '%' and take only the text before it.
            .Select(line =>
            {
                // Match the first unescaped percent: an even-length run of backslashes (including zero) right before '%'.
                var match = Regex.Match(line, @"(?<!\\)(?:\\\\)*%");

                // Compute the index of the percent itself if found; otherwise use -1 to indicate absence.
                var commentIndex = match.Success ? (match.Index + match.Length - 1) : -1;

                // If such a percent exists, take the substring before it; otherwise keep the full line.
                return commentIndex >= 0 ? line[..commentIndex] : line;
            })
            // Trim whitespace from the resulting line.
            .Select(line => line.Trim())
            // Join the files back again
            .ToJoinedString("\n");

    /// <summary>
    /// Parses a string of raw content into a <see cref="Text"/> object containing structured blocks.
    /// </summary>
    /// <param name="rawContent">The raw string content of a section or other container.</param>
    /// <returns>A parsed <see cref="Text"/>.</returns>
    private static List<ContentBlock> ParseContentBlocks(string rawContent)
    {
        // A text is just a bunch of blocks
        var blocks = new List<ContentBlock>();

        // Define a regex to find the start of any major block-level command.
        var commandRegex = new Regex(@"(\\Theorem|\\Exercise|\\Problem|\\Example)");

        // Initialize the cursor for scanning the content string.
        var currentIndex = 0;

        // Loop through the content as long as there are characters to process.
        while (currentIndex < rawContent.Length)
        {
            // Find the next command in the string from the current position.
            var match = commandRegex.Match(rawContent, currentIndex);

            // Check if a command was found.
            if (match.Success)
            {
                // Get the index where the command was found.
                var textEndIndex = match.Index;

                // Handle the case when we are in between two commands (i.e., plain paragraphs).
                if (textEndIndex > currentIndex)
                {
                    // Extract the plain text segment.
                    var textSegment = rawContent[currentIndex..textEndIndex];

                    // Process this text segment into paragraphs
                    blocks.AddRange(ParseRawContent(textSegment));
                }

                // Parse the command and its braced arguments.
                var (commandBlock, newIndex) = ParseHighLevelCommandBlock(rawContent, match.Index);

                // Remember it
                blocks.Add(commandBlock);

                // Advance the cursor past the command and its arguments.
                currentIndex = newIndex;
            }
            // If no more commands are found, process the rest of the content as plain text.
            else
            {
                // Extract the remaining text.
                var remainingText = rawContent[currentIndex..];

                // Add any resulting blocks to our list.
                blocks.AddRange(ParseRawContent(remainingText));

                // Break the loop as there is no more content to process.
                break;
            }
        }

        // Return the complete list of parsed blocks.
        return blocks;
    }

    /// <summary>
    /// Parses a high-level command block (like Theorem, Exercise) and its arguments.
    /// </summary>
    /// <param name="sourceText">The TeX content to parse from.</param>
    /// <param name="startIndex">The starting index of the command.</param>
    /// <returns>A tuple containing the parsed block and the index after the block.</returns>
    private static (ContentBlock block, int endIndex) ParseHighLevelCommandBlock(string sourceText, int startIndex)
    {
        // Match the command at the start index.
        var commandMatch = Regex.Match(sourceText[startIndex..], @"^\\(Theorem|Exercise|Problem|Example)");

        // Make sure we found a valid command.
        if (!commandMatch.Success)
            throw new TexParserException($"Malformed high-level command block at: {sourceText.PreviewAt(startIndex)}");

        // Get the command name (e.g., "Theorem").
        var commandName = commandMatch.Groups[1].Value;

        // Determine the number of arguments required by this command.
        var argumentCount = commandName switch
        {
            // Problems have 6 arguments.
            "Problem" => 6,

            // All others have 3 arguments.
            _ => 3,
        };

        // Calculate the starting position for parsing arguments.
        var argumentsStartIndex = startIndex + commandMatch.Length;

        // Parse the required number of braced arguments.
        var (arguments, newIndex) = ParseBracedArguments(sourceText, argumentsStartIndex, argumentCount);

        // Check if the correct number of arguments were found and if not, throw an error
        if (arguments.Count != argumentCount)
            throw new TexParserException($"Expected {argumentCount} arguments for \\{commandName}, but found {arguments.Count} at: {sourceText.PreviewAt(argumentsStartIndex)}");

        // Create the specific content block based on the command type.
        ContentBlock newBlock = commandName switch
        {
            "Theorem" => new Theorem(
                Title: ParseAtMostSingleRawBlock(arguments[0]),
                Body: [.. ParseRawContent(arguments[1])],
                Proof: [.. ParseRawContent(arguments[2])]
            ),

            "Exercise" => new Exercise(
                Title: ParseAtMostSingleRawBlock(arguments[0]),
                Body: [.. ParseRawContent(arguments[1])],
                Solution: [.. ParseRawContent(arguments[2])]
            ),

            "Problem" => new Problem(
                Difficulty: int.Parse(arguments[0]),
                Title: ParseAtMostSingleRawBlock(arguments[1]),
                Body: [.. ParseRawContent(arguments[2])],
                Hint1: [.. ParseRawContent(arguments[3])],
                Hint2: [.. ParseRawContent(arguments[4])],
                Solution: [.. ParseRawContent(arguments[5])]
            ),

            "Example" => new Example(
                Title: ParseAtMostSingleRawBlock(arguments[0]),
                Body: [.. ParseRawContent(arguments[1])],
                Solution: [.. ParseRawContent(arguments[2])]
            ),

            // This case should be unreachable due to the initial regex match.
            _ => throw new Exception($"Internal parsing error: unhandled command name {commandName}"),
        };

        // Return the newly created block and the new index in the source text.
        return (newBlock, newIndex);
    }


    /// <summary>
    /// Parses a string that may contain text, math, and lists, returning a list of raw blocks.
    /// This is used for content inside arguments, like a theorem body or a list item, or between
    /// them (e.g. regular text between two theorems).
    /// </summary>
    /// <param name="textContent">The text content to parse.</param>
    /// <returns>A list of parsed block objects.</returns>
    private static List<RawContentBlock> ParseRawContent(string textContent)
    {
        // Initialize a list to store the parsed blocks.
        var blocks = new List<RawContentBlock>();

        // Define a regex to find the start of special blocks (lists or math).
        var specialBlockRegex = new Regex(@"(\\begitems|\$\$)", RegexOptions.Singleline);

        // Initialize the scanning cursor.
        var currentIndex = 0;

        // Loop through the text content.
        while (currentIndex < textContent.Length)
        {
            // Find the next block.
            var match = specialBlockRegex.Match(textContent, currentIndex);

            // If no more blocks are found...
            if (!match.Success)
            {
                // Process the remainder of the text...
                blocks.AddRange(ProcessTextIntoParagraphs(textContent[currentIndex..].Trim()));
                break;
            }

            // If there is text before the found block (e.g. between two blocks)...
            if (match.Index > currentIndex)
            {
                // Process the text segment before the match.
                blocks.AddRange(ProcessTextIntoParagraphs(textContent[currentIndex..match.Index].Trim()));
            }

            // If a list is found.
            if (match.Value == "\\begitems")
            {
                // Parse the list block.
                var (itemList, nextIndex) = ParseItemListBlock(textContent, match.Index);

                // Remember it
                blocks.Add(itemList);

                // Advance the cursor.
                currentIndex = nextIndex;
                continue;
            }
            // If a math block is found.
            else if (match.Value == "$$")
            {
                // Parse the math block.
                var (mathBlock, nextIndex) = ParseMathBlock(textContent, match.Index);

                // Remember it
                blocks.Add(mathBlock);

                // Advance the cursor.
                currentIndex = nextIndex;
                continue;
            }

            // If parsing the block failed, throw an exception.
            throw new TexParserException($"Malformed block at: {textContent.PreviewAt(match.Index)}");
        }

        // Return the collected blocks
        return blocks;
    }


    /// <summary>
    /// Parses a display math block, which is enclosed in '$$'.
    /// </summary>
    /// <param name="sourceText">The TeX content to parse from.</param>
    /// <param name="startIndex">The starting index of the '$$'.</param>
    /// <returns>A tuple containing the parsed MathBlock and the index after the block.</returns>
    private static (MathTex mathBlock, int endIndex) ParseMathBlock(string sourceText, int startIndex)
    {
        // Verify that the block starts with '$$'.
        if (startIndex + 1 < sourceText.Length && sourceText.AsSpan(startIndex, 2).SequenceEqual("$$"))
        {
            // Find the closing '$$' after the opening one.
            var endIndex = sourceText.IndexOf("$$", startIndex + 2);

            // If a closing '$$' is found.
            if (endIndex > 0)
            {
                // Extract the raw content inside the '$$' delimiters.
                var mathContent = sourceText.Substring(startIndex + 2, endIndex - startIndex - 2).Trim();

                // Create a new math object.
                var newMathBlock = new MathTex(mathContent, IsDisplay: true);

                // Return the new block and the index right after the closing '$$'.
                return (newMathBlock, endIndex + 2);
            }
        }

        // If parsing fails, throw an exception.
        throw new TexParserException($"Malformed display math block at: {sourceText.PreviewAt(startIndex)}");
    }

    /// <summary>
    /// Parses a TeX item list (from \begitems to \enditems). It handles nested lists correctly.
    /// </summary>
    /// <param name="sourceText">The TeX content to parse from.</param>
    /// <param name="startIndex">The starting index of the '\begitems' command.</param>
    /// <returns>A tuple containing the parsed list and the index after the list.</returns>
    private static (ItemList parsedList, int endIndex) ParseItemListBlock(string sourceText, int startIndex)
    {
        // Regex to find the start of an item list and capture its optional style.
        var headRegex = new Regex(@"\\begitems(?:\s+\\style\s+(\w+))?", RegexOptions.Singleline);

        // Match the regex at the start of the relevant substring.
        var headMatch = headRegex.Match(sourceText[startIndex..]);

        // If the start of an item list is not found, return failure.
        if (!headMatch.Success)
            throw new TexParserException($"Malformed \\begitems command at: {sourceText.PreviewAt(startIndex)}");

        // Extract the optional style code (e.g., "i", "n") from the regex match, O being the default in OpMac
        var styleCode = headMatch.Groups[1].Success ? headMatch.Groups[1].Value : "O";

        // Map the OpMaC style code to our own enum
        if (!_texListStyleMap.TryGetValue(styleCode ?? "O", out var listStyleType))
            throw new TexParserException($"Unhandled OpMac style code: {styleCode}");

        // Initialize a cursor to the position after the \begitems command.
        var cursor = startIndex + headMatch.Length;

        // Use a regex to find all \begitems and \enditems tokens to handle nesting correctly.
        var listTokenRegex = new Regex(@"\\begitems|\\enditems", RegexOptions.Singleline);

        // Start depth at 1 for the opening \begitems we already found.
        var depth = 1;

        // Variables to hold the index of the matching \enditems.
        int endOfBlockIndex;

        // Loop to find the matching \enditems for the current list.
        while (true)
        {
            // Find the next list token.
            var match = listTokenRegex.Match(sourceText, cursor);

            // If no more tokens are found, the TeX is malformed...
            if (!match.Success)
                throw new TexParserException($"Unclosed \\begitems starting at: {sourceText.PreviewAt(startIndex)}");

            // If we find another \begitems...
            if (match.Value == "\\begitems")
            {
                // Increase the nesting depth.
                depth++;
            }
            // If we find an \enditems...
            else
            {
                // Decrease the nesting depth.
                depth--;

                // If depth is zero, we've found the matching closing tag.
                if (depth == 0)
                {
                    // Record the start and end positions of the closing tag.
                    endOfBlockIndex = match.Index;

                    // Exit the loop.
                    break;
                }
            }

            // Advance the cursor past the found token.
            cursor = match.Index + match.Length;
        }

        // Extract the inner content of the list, between \begitems and its matching \enditems.
        var innerContent = sourceText[(startIndex + headMatch.Length)..endOfBlockIndex];

        // Regex to find list items (\i) and nested list boundaries.
        var itemTokenRegex = new Regex(@"\\begitems|\\enditems|\\i\b", RegexOptions.Singleline);

        // Initialize a list to hold the parsed content blocks for each item.
        var listItems = new List<ImmutableList<RawContentBlock>>();

        // Initialize depth and scan cursors for parsing items.
        // Start at -1 so we don't create a phantom first item.
        int itemParseDepth = 0, scanCursor = 0, currentItemStartIndex = -1;

        // Loop through the inner content of the list to split it into items.
        while (scanCursor < innerContent.Length)
        {
            // Find the next relevant token (\i, \begitems, or \enditems).
            var match = itemTokenRegex.Match(innerContent, scanCursor);

            // If no more tokens are found, parsing is complete.
            if (!match.Success)
                break;

            // Handle nested lists to ensure we only split by top-level \i commands.
            if (match.Value == "\\begitems")
            {
                // Increase the nested list depth.
                itemParseDepth++;

                // Advance the scan cursor past this token.
                scanCursor = match.Index + match.Length;
                continue;
            }

            // If we find the end of a nested list.
            if (match.Value == "\\enditems")
            {
                // Decrease the nested list depth.
                itemParseDepth--;

                // Advance the scan cursor past this token.
                scanCursor = match.Index + match.Length;
                continue;
            }

            // If we find a top-level item marker (\i).
            if (match.Value == "\\i" && itemParseDepth == 0)
            {
                // Only try to finalize a previous item if we already started one.
                if (currentItemStartIndex >= 0)
                {
                    // Extract the text slice for the previous item.
                    var itemSlice = innerContent[currentItemStartIndex..match.Index].Trim();

                    // Recursively parse this slice into raw content blocks.
                    listItems.Add([.. ParseRawContent(itemSlice)]);
                }

                // Mark the start of the new item right after this \i token.
                currentItemStartIndex = match.Index + match.Length;
            }

            // Advance the scan cursor past the current token.
            scanCursor = match.Index + match.Length;
        }

        // Process the last item in the list (the content after the final \i).
        if (currentItemStartIndex >= 0)
        {
            // Extract the text slice for the last item.
            var itemSlice = innerContent[currentItemStartIndex..].Trim();

            // Recursively parse this slice into raw content blocks.
            listItems.Add([.. ParseRawContent(itemSlice)]);
        }

        // Create the final list object.
        var newList = new ItemList([.. listItems], listStyleType);

        // Return the new list and the position after the entire \begitems...\enditems block.
        return (newList, endOfBlockIndex + "\\enditems".Length);
    }

    /// <summary>
    /// Processes a chunk of text into a list of Paragraph objects.
    /// </summary>
    /// <param name="textContent">The text to process.</param>
    /// <returns>A list of Paragraph objects.</returns>
    private static List<Paragraph> ProcessTextIntoParagraphs(string textContent)
    {
        // Initialize the list to hold the resulting blocks.
        var blocks = new List<Paragraph>();

        // Split plain text into paragraphs on blank lines (allowing spaces on the blank line)
        var paragraphs = Regex.Split(textContent, @"(?:\r?\n\s*){2,}");

        // Handle each paragraph separately                
        foreach (var paragraph in paragraphs)
        {
            // Skip empty paragraphs
            if (string.IsNullOrWhiteSpace(paragraph))
                continue;

            // Parse the inline blocks to form a paragraph
            blocks.Add(new Paragraph([.. ParseInlineText(paragraph)]));
        }

        // Return the list of parsed blocks.
        return blocks;
    }

    /// <summary>
    /// Parses inline TeX-style formatting commands and returns a list of structured content blocks.
    /// Supports \textbf{}, \textit{}, \fnote{}, and \uv{} commands + inline math $...$.
    /// </summary>
    /// <param name="inputText">The raw text.</param>
    /// <returns>A list of blocks representing the parsed inline content.</returns>
    private static List<RawContentBlock> ParseInlineText(string inputText)
    {
        // Create a container for the parsed content blocks.
        var parsedBlocks = new List<RawContentBlock>();

        // Start a cursor that will walk the input as we parse (passed by reference into recursion).
        var currentIndex = 0;

        // Begin parsing at the top level with no explicit terminator.
        ParseInlineRecursive(
            sourceText: inputText,
            currentIndexRef: ref currentIndex,
            terminatorCharacter: null,
            outputBlocks: parsedBlocks
        );

        // Consolidate adjacent plain text spans to keep the output tidy.
        return ConsolidateAdjacentTextSpans(parsedBlocks);
    }

    /// <summary>
    /// Recursively parses the source text, honoring grouping braces and inline TeX commands,
    /// emitting structured content blocks.
    /// </summary>
    /// <param name="sourceText">The complete input string being parsed.</param>
    /// <param name="currentIndexRef">A reference to the current cursor position within <paramref name="sourceText"/>.</param>
    /// <param name="terminatorCharacter">An optional character that, when encountered, ends this recursive level (usually <c>'}'</c>).</param>
    /// <param name="outputBlocks">A collection to which parsed <see cref="RawContentBlock"/> instances are appended.</param>
    private static void ParseInlineRecursive(
        string sourceText,
        ref int currentIndexRef,
        char? terminatorCharacter,
        List<RawContentBlock> outputBlocks)
    {
        // Create a builder to accumulate plain text until we need to flush as a block.
        var accumulatedTextBuilder = new StringBuilder();

        // Define a local helper that flushes the current buffer into a new plain text block.
        void FlushAccumulatedText()
        {
            // Only create a block if we have non-empty text in the buffer.
            if (accumulatedTextBuilder.Length == 0)
                return;

            // Get the cleaned raw text
            var cleanedText = CleanRawText(accumulatedTextBuilder.ToString());

            // Append a new plain text span representing the buffered text.
            outputBlocks.Add(new PlainText(cleanedText));

            // Clear the buffer since its contents are now represented in the output block list.
            accumulatedTextBuilder.Clear();
        }

        // Process characters until we run out of input or hit this level's terminator.
        while (currentIndexRef < sourceText.Length)
        {
            // Read the current character under the cursor.
            var currentCharacter = sourceText[currentIndexRef];

            // If we reached the designated terminator for this level, consume it and return to the caller.
            if (terminatorCharacter.HasValue && currentCharacter == terminatorCharacter.Value)
            {
                // Advance past the terminator so the caller resumes after it.
                currentIndexRef++;

                // Before unwinding, flush any buffered text as a plain text block.
                FlushAccumulatedText();

                // End the current recursion level.
                return;
            }

            // Inline math: $ ... $
            // If we encounter a dollar sign, attempt to parse an inline math span delimited by unescaped '$'.
            if (currentCharacter == '$')
            {
                // We are about to change context, so flush any buffered text first.
                FlushAccumulatedText();

                // We will find the next unescaped '$' to terminate the inline math span.
                var scanIndex = currentIndexRef + 1;

                // Track whether we found a closing '$'.
                var foundClosing = false;

                // Scan forward to find the closing '$'.
                while (scanIndex < sourceText.Length)
                {
                    // A closing '$' is valid if it is not escaped by a preceding backslash.
                    if (sourceText[scanIndex] == '$' && sourceText[scanIndex - 1] != '\\')
                    {
                        // Extract the inner math content (excluding delimiters) and trim whitespace.
                        var innerMath = sourceText[(currentIndexRef + 1)..scanIndex].Trim();

                        // Emit inline math
                        outputBlocks.Add(new MathTex(innerMath, IsDisplay: false));

                        // Advance the cursor to the character after the closing '$'.
                        currentIndexRef = scanIndex + 1;

                        // Mark that we found a closing '$' and can stop scanning.
                        foundClosing = true;
                        break;
                    }

                    // Move to the next character.
                    scanIndex++;
                }

                // If no closing '$' was found, it is sus
                if (!foundClosing)
                    throw new TexParserException($"Unclosed inline math starting at: {sourceText.PreviewAt(currentIndexRef)}");

                // Continue parsing from the new cursor position.
                continue;
            }

            // If we encounter a backslash, we may have an escape or a command.
            if (currentCharacter == '\\')
            {
                // Handle simple escapes like \{, \}, \\, and \$ which should become literal characters.
                if (currentIndexRef + 1 < sourceText.Length &&
                    (sourceText[currentIndexRef + 1] == '{' ||
                     sourceText[currentIndexRef + 1] == '}' ||
                     sourceText[currentIndexRef + 1] == '\\' ||
                     sourceText[currentIndexRef + 1] == '$'))
                {
                    // Append the escaped literal character to the buffer.
                    accumulatedTextBuilder.Append(sourceText[currentIndexRef + 1]);

                    // Advance the cursor past the backslash and the escaped character.
                    currentIndexRef += 2;
                    continue;
                }

                // Otherwise, we try to read a command name composed of letters
                var commandNameStartIndex = currentIndexRef + 1;

                // Start scanning forward to capture the alphabetical command name.
                var scanIndex = commandNameStartIndex;

                // Advance while we are on letter characters to form the command token.
                while (scanIndex < sourceText.Length && char.IsLetter(sourceText[scanIndex]))
                    scanIndex++;

                // Extract the command name from the input (may be empty if there were no letters).
                var commandName = sourceText[commandNameStartIndex..scanIndex];

                // Handle the image command which has one or two braced arguments.
                if (commandName == "Image")
                {
                    // Flush any text that was being accumulated before this command
                    FlushAccumulatedText();

                    // First we'll see if it's an inline image, indicated by a *
                    var isInline = sourceText[scanIndex] == '*';

                    // If case of a presence of a *, we need to advance the index past it.
                    if (isInline)
                        currentIndexRef++;

                    // Parse first argument (id)
                    var (idContent, afterIdIndex) = GetBracedContent(sourceText, currentIndexRef);

                    // Advance the main cursor to just after the id argument.
                    currentIndexRef = afterIdIndex;

                    // We need to parse the scale of the image, which is optional.
                    decimal scale;

                    // Peek ahead: is the next non-whitespace char a '{'?
                    var peek = currentIndexRef;

                    // Skip whitespaces
                    while (peek < sourceText.Length && char.IsWhiteSpace(sourceText[peek]))
                        peek++;

                    // Check for the optional scale argument.
                    if (peek < sourceText.Length && sourceText[peek] == '{')
                    {
                        // If it's there, get the scale content.
                        var (scaleContent, afterScaleIndex) = GetBracedContent(sourceText, peek);

                        // Advance the main cursor to just after the scale argument.
                        currentIndexRef = afterScaleIndex;

                        // PlainTex allows various formats...One thing that can be handled easily is when 
                        // the string starts with a decimal point (e.g. .5).
                        if (scaleContent.StartsWith('.'))
                            scaleContent = $"0{scaleContent}";

                        // Parse the scale
                        scale = decimal.Parse(scaleContent, CultureInfo.InvariantCulture);
                    }
                    // If no scale argument is present, default to 1.0.
                    else scale = 1.0m;

                    // We have all arguments, so we can emit an image
                    outputBlocks.Add(new Image(idContent, scale, isInline));

                    // Continue parsing
                    continue;
                }
                // Check if this is one of the supported commands that can have complex content within.
                else if (commandName is "textbf" or "textit" or "fnote" or "uv")
                {
                    // Move the main cursor to just after the command name.
                    currentIndexRef = scanIndex;

                    // Skip any whitespace that may appear between the command and its opening brace.
                    while (currentIndexRef < sourceText.Length && char.IsWhiteSpace(sourceText[currentIndexRef]))
                        currentIndexRef++;

                    // If we do not find an opening brace, it's weird
                    if (currentIndexRef >= sourceText.Length || sourceText[currentIndexRef] != '{')
                        throw new TexParserException($"Incorrect \\{commandName} at: {sourceText.PreviewAt(currentIndexRef)}");

                    // We are about to change context, so flush any buffered text first.
                    FlushAccumulatedText();

                    // Consume the opening brace so the recursive call starts inside the group.
                    currentIndexRef++;

                    // Create a temporary container for the command's inner content.
                    var innerContent = new List<RawContentBlock>();

                    // Recursively parse until the matching '}' of this command's argument.
                    ParseInlineRecursive(
                        sourceText: sourceText,
                        currentIndexRef: ref currentIndexRef,
                        terminatorCharacter: '}',
                        outputBlocks: innerContent
                    );

                    // Create the appropriate block type based on the command.
                    RawContentBlock newBlock = commandName switch
                    {
                        "textbf" => new BoldText([.. innerContent]),
                        "textit" => new ItalicText([.. innerContent]),
                        "fnote" => new Footnote([.. innerContent]),
                        "uv" => new QuoteText([.. innerContent]),

                        // This should be unreachable due to the if condition above.
                        _ => throw new TexParserException($"Internal parsing error: unhandled command: {commandName}"),
                    };

                    // Add the new block to the output.
                    outputBlocks.Add(newBlock);

                    // Continue parsing after the command's closing brace.
                    continue;
                }
                // This block is for commands without braced arguments or just normal commands.
                else
                {
                    // For any non-special commands, preserve the entire command with its braced argument if present.
                    accumulatedTextBuilder.Append('\\').Append(commandName);

                    // Move the main cursor to just after the command name.
                    currentIndexRef = scanIndex;

                    // If there's a braced argument, preserve it literally.
                    if (currentIndexRef < sourceText.Length && sourceText[currentIndexRef] == '{')
                    {
                        // We will scan forward to find the matching closing brace,
                        var braceDepth = 0;

                        // Remember where the argument starts (the opening brace).
                        var argumentStart = currentIndexRef;

                        // Start at the opening brace and scan forward.
                        while (currentIndexRef < sourceText.Length)
                        {
                            // If we find a brace, we're one level down.
                            if (sourceText[currentIndexRef] == '{')
                                braceDepth++;

                            // If we find a closing brace....
                            else if (sourceText[currentIndexRef] == '}')
                            {
                                // We're one level up.
                                braceDepth--;

                                // If we're at 0...
                                if (braceDepth == 0)
                                {
                                    // Advance past the closing brace.
                                    currentIndexRef++;

                                    // Append the entire braced argument including the braces.
                                    accumulatedTextBuilder.Append(sourceText[argumentStart..currentIndexRef]);

                                    // Break out of the loop since we found the end of this argument.
                                    break;
                                }
                            }

                            // We move on because we haven't found the end yet.
                            currentIndexRef++;
                        }
                    }

                    // Continue parsing the remainder of the text.
                    continue;
                }
            }

            // If we see a plain opening brace, it is a TeX grouping that does not change style.
            if (currentCharacter == '{')
            {
                // Flush any buffered text before descending into the group.
                FlushAccumulatedText();

                // Consume the opening brace so the recursive call begins inside the group.
                currentIndexRef++;

                // Recursively parse the group content.
                ParseInlineRecursive(
                    sourceText: sourceText,
                    currentIndexRef: ref currentIndexRef,
                    terminatorCharacter: '}',
                    outputBlocks: outputBlocks
                );

                // Continue parsing after the group's closing brace.
                continue;
            }

            // For a normal character, append it to the accumulation buffer.
            accumulatedTextBuilder.Append(currentCharacter);

            // Advance the cursor to the next character.
            currentIndexRef++;
        }

        // If we exit the loop without hitting a terminator, flush any remaining buffered text as a block.
        FlushAccumulatedText();
    }

    /// <summary>
    /// Coalesces adjacent plain text spans to minimize fragmentation.
    /// </summary>
    /// <param name="rawBlocks">The blocks produced by the parser, possibly with adjacent plain text runs.</param>
    /// <returns>A new list of <see cref="RawContentBlock"/> with adjacent plain text runs merged together.</returns>
    private static List<RawContentBlock> ConsolidateAdjacentTextSpans(List<RawContentBlock> rawBlocks)
        // Use LINQ's Aggregate to fold over the blocks and merge adjacent plain text runs.
        => rawBlocks.Aggregate(
            // Start with an empty accumulator list.
            seed: new List<RawContentBlock>(),
            // For each block, decide whether to merge with the last or append as a new entry.
            func: (accumulator, nextBlock) =>
            {
                // If there is at least one block already in the accumulator, we can consider merging.
                if (accumulator.Count > 0)
                {
                    // Check if both the last block and the current block are plain text spans.
                    if (accumulator[^1] is PlainText lastSpan && nextBlock is PlainText nextSpan)
                    {
                        // Replace the last span with a new one that has combined text content.
                        accumulator[^1] = new PlainText(lastSpan.Text + nextSpan.Text);

                        // Return the accumulator unchanged in size.
                        return accumulator;
                    }
                }

                // Otherwise, types differ (or accumulator is empty), so append the block as-is.
                accumulator.Add(nextBlock);

                // Return the accumulator to be used in the next iteration.
                return accumulator;
            });

    /// <summary>
    /// Parses a string containing raw blocks and simplifies the result into a single block.
    /// If multiple blocks are parsed, they are wrapped in a paragraph.
    /// </summary>
    /// <param name="contentString">The string to parse.</param>
    /// <returns>A single RawContentBlock, or null if the input is empty.</returns>
    private static RawContentBlock? ParseAtMostSingleRawBlock(string contentString)
    {
        // Parse the string into potentially multiple raw blocks.
        var blocks = ParseRawContent(contentString);

        // No parsed content is possible
        if (blocks.Count == 0)
            return null;

        // If exactly one block was parsed, return it directly.
        if (blocks.Count == 1)
            return blocks[0];

        // If multiple blocks were parsed, wrap them in a Paragraph to act as a container.
        return new Paragraph([.. blocks]);
    }

    /// <summary>
    /// Parses a specified number of consecutive braced arguments.
    /// </summary>
    /// <param name="sourceText">The text to search within.</param>
    /// <param name="startIndex">The index to start searching from.</param>
    /// <param name="argumentCount">The number of arguments to parse.</param>
    /// <returns>A tuple with the list of argument strings and the new index.</returns>
    private static (List<string> arguments, int endIndex) ParseBracedArguments(string sourceText, int startIndex, int argumentCount)
    {
        // Initialize a list to store the parsed argument strings.
        var arguments = new List<string>();

        // Set the initial cursor position.
        var currentIndex = startIndex;

        // Loop for the required number of arguments.
        for (var i = 0; i < argumentCount; i++)
        {
            // Find and extract the content of the next braced group.
            var (content, endIndex) = GetBracedContent(sourceText, currentIndex);

            // Add the extracted content to the list of arguments.
            arguments.Add(content);

            // Update the cursor to the position after the parsed argument.
            currentIndex = endIndex;
        }

        // Validate that we have parsed the expected number of arguments.
        if (arguments.Count != argumentCount)
            throw new TexParserException($"Expected {argumentCount} arguments but found {arguments.Count} at: {sourceText.PreviewAt(startIndex)}");

        // Return the list of arguments and the final cursor position.
        return (arguments, currentIndex);
    }

    /// <summary>
    /// Extracts the content of the first top-level braced group found after a start index.
    /// </summary>
    /// <param name="sourceText">The text to search within.</param>
    /// <param name="startIndex">The index to start searching from.</param>
    /// <returns>A tuple containing the extracted content and the index after the closing brace.</returns>
    private static (string content, int endIndex) GetBracedContent(string sourceText, int startIndex)
    {
        // Initialize brace counter for handling nested braces.
        var braceCount = 0;

        // The starting position of the content inside the braces.
        var contentStartIndex = -1;

        // Iterate through the string from the given start index.
        for (var currentIndex = startIndex; currentIndex < sourceText.Length; currentIndex++)
        {
            // If an opening brace is found.
            if (sourceText[currentIndex] == '{')
            {
                // If this is the first opening brace (top level), record the content start position.
                if (braceCount == 0)
                    contentStartIndex = currentIndex + 1;

                // Nesting one level up
                braceCount++;
            }
            // If a closing brace is found.
            else if (sourceText[currentIndex] == '}')
            {
                // Nesting one level down
                braceCount--;

                // If the brace counter is zero, we've found the matching closing brace.
                if (braceCount == 0)
                {
                    // Extract the content between the braces and trim whitespace.
                    var content = sourceText[contentStartIndex..currentIndex].Trim();

                    // Return the content and the index immediately after the closing brace.
                    return (content, currentIndex + 1);
                }
            }
        }

        // Throw an exception if no matching closing brace was found.
        throw new TexParserException($"Unclosed brace starting at: {sourceText.PreviewAt(0)}");
    }

    /// <summary>
    /// Cleans a string of TeX-ish text in a minimal, predictable way:
    /// - collapses ASCII whitespace to single spaces,
    /// - converts unescaped '~' to NBSP,
    /// - turns '---' into an em dash and '--' into an en dash,
    /// - trims leading/trailing ASCII spaces.
    /// Uses Unicode output (no HTML entities).
    /// </summary>
    /// <param name="textContent">The text to clean.</param>
    /// <returns>The cleaned text.</returns>
    private static string CleanRawText(string textContent)
    {
        // Collapse only ASCII whitespace (space, tab, CR, LF, VT, FF) to a single space.
        textContent = Regex.Replace(textContent, @"[ \t\r\n\f\v]+", " ");

        // Replace unescaped tildes with a non-breaking space; keep '\~' as a literal tilde.
        textContent = Regex.Replace(textContent, @"(?<!\\)~", "\u00A0");

        // Replace TeX-style triple dash with an em dash first so it is not partially eaten by the double-dash rule.
        textContent = Regex.Replace(textContent, @"---", "\u2014");

        // Replace TeX-style double dash with an en dash.
        textContent = Regex.Replace(textContent, @"--", "\u2013");

        // Replace TeX-style inline spaces
        textContent = Regex.Replace(textContent, @"\\,", " ");

        // Replace escape signs for literal characters
        textContent = Regex.Replace(textContent, @"\s*\\%", "%");

        // Remove escaped dashes used for hyphenation hints
        textContent = Regex.Replace(textContent, @"\\-", "");

        // All done
        return textContent;
    }

    #endregion

    #region Unknown commands handling

    /// <summary>
    /// Gathers all commands that appear in the parsed document (from text and math blocks)
    /// </summary>
    /// <param name="blocks">The content blocks to go through.</param>
    /// <returns>A list of command names found in all blocks.</returns>
    private static ImmutableHashSet<string> FindCommands(IEnumerable<ContentBlock> blocks)
    {
        // Collect text surfaces from all relevant nodes.
        var allTexts = new List<string>();

        // Traverse sections and their content to capture all data from all content blocks
        foreach (var block in blocks)
            GatherBlockText(block, allTexts);

        // Combine all captured text into a single blob for scanning.
        var combined = allTexts.ToJoinedString(" ");

        // Find all commands in the raw texts
        return [.. Regex.Matches(combined, @"\\[A-Za-z]+")
            // Extract actual commands
            .Select(match => match.Value[1..]),];
    }

    /// <summary>
    /// Recursively walks a content block tree and collects displayable text for command scanning.
    /// </summary>
    /// <param name="block">The current block to inspect.</param>
    /// <param name="collector">The output list that aggregates surface strings.</param>
    private static void GatherBlockText(ContentBlock block, List<string> collector)
    {
        // Handle all types of blocks 
        switch (block)
        {
            case Theorem theorem:
                collector.AddRange(GatherFromRaw([theorem.Title, .. theorem.Body, .. theorem.Proof]));
                break;

            case Exercise exercise:
                collector.AddRange(GatherFromRaw([exercise.Title, .. exercise.Body, .. exercise.Solution]));
                break;

            case Problem problem:
                collector.AddRange(GatherFromRaw([problem.Title, .. problem.Body, .. problem.Hint1, .. problem.Hint2, .. problem.Solution]));
                break;

            case Example example:
                collector.AddRange(GatherFromRaw([.. example.Body, .. example.Solution]));
                break;

            case RawContentBlock rawBlock:
                collector.AddRange(GatherFromRaw([rawBlock]));
                break;

            default: throw new NotImplementedException($"Unhandled block type: {block.GetType()}");
        }
    }

    /// <summary>
    /// Helper that converts a sequence of raw blocks into plain text surfaces.
    /// </summary>
    /// <param name="rawBlocks">A sequence of raw content blocks.</param>
    /// <returns>A list of strings extracted from the raw blocks.</returns>
    private static IEnumerable<string> GatherFromRaw(IEnumerable<RawContentBlock?> rawBlocks)
        // Map raw blocks to strings based on their runtime type.
        => rawBlocks.SelectMany(rawBlock => rawBlock switch
        {
            // Null is fine
            null => [],

            // No text in images
            Image => [],

            // Text directly here
            PlainText text => [text.Text],
            MathTex math => [math.Text],

            // Recurse into containers
            Paragraph paragraph => GatherFromRaw(paragraph.Content),
            BoldText bold => GatherFromRaw(bold.Content),
            ItalicText italic => GatherFromRaw(italic.Content),
            QuoteText quote => GatherFromRaw(quote.Content),
            Footnote footnote => GatherFromRaw(footnote.Content),

            // Handle all blocks from all items
            ItemList list => GatherFromRaw(list.Items.Flatten()),

            // Unhandled cases
            _ => throw new NotImplementedException($"Unhandled block type: {rawBlock.GetType()}"),
        });

    #endregion
}

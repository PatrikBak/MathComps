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
/// <item><c>\\Title{...}</c> for the document's header.</item>
/// <item><c>\\Theorem{title}{body}{proof}</c></item>
/// <item><c>\\Exercise{title}{body}{solution}</c></item>
/// <item><c>\\Problem{difficulty}{title}{body}{hint1}...{hintn}{solution}</c> (0+ hints)</item>
/// <item><c>\\Highlight{paragraph}</c> (a paragraph that should stand out)</item>
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
    /// Maps OpMac list style codes to our <see cref="ListItemStyle"/> enum.
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
    /// Parses a string representing a full TeX document. It extracts the title and sections,
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

        // Return the final Document object, containing the title and all parsed sections.
        var document = new Document(title, sections);

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
        var commandRegex = new Regex(@"\\(Theorem|Exercise|Problem|Example|Highlight|Definition)");

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
                var (commandBlock, newIndex) = ParseHighLevelCommandBlock(rawContent, match.Groups[1].Value, match.Index);

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
    /// <param name="commandName">Already parsed name of the command (e.g. Theorem, Exercise)</param>
    /// <param name="startIndex">The starting index of the command.</param>
    /// <returns>A tuple containing the parsed block and the index after the block.</returns>
    private static (ContentBlock block, int endIndex) ParseHighLevelCommandBlock(string sourceText, string commandName, int startIndex)
    {
        // Calculate the starting position for parsing arguments (+1 for the backslash not in commandName).
        var argumentsStartIndex = startIndex + commandName.Length + 1;

        // Determine the number of arguments required by this command.
        var (minimalArguments, maximalArguments) = commandName switch
        {
            // Highlight has 1 argument (it's just a special paragraph)
            "Highlight" => (1, 1),

            // Definition has 2 arguments (title + body)
            "Definition" => (2, 2),

            // Problem has variable arguments
            "Problem" => (4, (int?)null),

            // All others have 3 arguments.
            _ => (3, 3),
        };

        // Parse the required number of braced arguments.
        var (arguments, newIndex) = ParseBracedArguments(
            sourceText,
            argumentsStartIndex,
            maximalArguments
        );

        // Verify args
        if (arguments.Count < minimalArguments || (maximalArguments is not null && arguments.Count > maximalArguments))
            throw new TexParserException($"Invalid number of arguments for \\{commandName} at: {sourceText.PreviewAt(argumentsStartIndex)}");

        // Create the specific content block based on the command type.
        ContentBlock newBlock = commandName switch
        {
            "Theorem" => new Theorem(
                Title: ParseAtMostSingleRawBlock(arguments[0]),
                Body: [.. ParseRawContent(arguments[1])],
                Proof: [.. ParseRawContent(arguments[2])]
            ),

            "Exercise" => BuildExercise(arguments),

            "Problem" => BuildProblem(arguments),

            "Example" => BuildExample(arguments),

            "Highlight" => new Paragraph(
                Content: [.. ParseRawContent(arguments[0])],
                Highligted: true
            ),

            "Definition" => new Definition(
                Title: ParseAtMostSingleRawBlock(arguments[0]),
                Body: [.. ParseRawContent(arguments[1])]
            ),

            // This case should be unreachable due to the initial regex match.
            _ => throw new Exception($"Internal parsing error: unhandled command name {commandName}"),
        };

        // Return the newly created block and the new index in the source text.
        return (newBlock, newIndex);
    }

    /// <summary>
    /// Builds a <see cref="Problem"/> from its raw arguments, splitting a leading
    /// <c>\Answer{...}</c> off the solution into the structured answer field.
    /// </summary>
    /// <param name="arguments">The raw braced arguments of the <c>\Problem</c> command.</param>
    /// <returns>The parsed problem block.</returns>
    private static Problem BuildProblem(List<string> arguments)
    {
        // Pull the optional final answer off the front of the solution argument.
        var (answer, solution) = SplitLeadingAnswer(arguments[^1]);

        // Assemble the problem; hints are everything between body and solution.
        return new Problem(
            Difficulty: int.Parse(arguments[0]),
            Title: ParseAtMostSingleRawBlock(arguments[1]),
            Body: [.. ParseRawContent(arguments[2])],
            Hints: [.. arguments[3..^1].Select(hint => (ImmutableList<RawContentBlock>)[.. ParseRawContent(hint)])],
            Answer: answer is null ? null : [.. ParseRawContent(answer)],
            Solution: [.. ParseRawContent(solution)]
        );
    }

    /// <summary>
    /// Builds an <see cref="Exercise"/> from its raw arguments, splitting a leading
    /// <c>\Answer{...}</c> off the solution into the structured answer field.
    /// </summary>
    /// <param name="arguments">The raw braced arguments of the <c>\Exercise</c> command.</param>
    /// <returns>The parsed exercise block.</returns>
    private static Exercise BuildExercise(List<string> arguments)
    {
        // Pull the optional final answer off the front of the solution argument.
        var (answer, solution) = SplitLeadingAnswer(arguments[2]);

        // Assemble the exercise.
        return new Exercise(
            Title: ParseAtMostSingleRawBlock(arguments[0]),
            Body: [.. ParseRawContent(arguments[1])],
            Answer: answer is null ? null : [.. ParseRawContent(answer)],
            Solution: [.. ParseRawContent(solution)]
        );
    }

    /// <summary>
    /// Builds an <see cref="Example"/> from its raw arguments, splitting a leading
    /// <c>\Answer{...}</c> off the solution into the structured answer field.
    /// </summary>
    /// <param name="arguments">The raw braced arguments of the <c>\Example</c> command.</param>
    /// <returns>The parsed example block.</returns>
    private static Example BuildExample(List<string> arguments)
    {
        // Pull the optional final answer off the front of the solution argument.
        var (answer, solution) = SplitLeadingAnswer(arguments[2]);

        // Assemble the example.
        return new Example(
            Title: ParseAtMostSingleRawBlock(arguments[0]),
            Body: [.. ParseRawContent(arguments[1])],
            Answer: answer is null ? null : [.. ParseRawContent(answer)],
            Solution: [.. ParseRawContent(solution)]
        );
    }

    /// <summary>
    /// Splits a leading <c>\Answer{...}</c> off a solution argument. The macro only counts when it
    /// is the very first token of the solution; its braced content becomes the answer and the rest
    /// becomes the remaining solution. Returns a null answer when no leading macro is present.
    /// </summary>
    /// <param name="solutionArgument">The raw solution argument, possibly prefixed with the macro.</param>
    /// <returns>The extracted answer (or null) and the remaining solution text.</returns>
    private static (string? answer, string solution) SplitLeadingAnswer(string solutionArgument)
    {
        // The answer macro only counts when it leads the solution.
        var trimmedStart = solutionArgument.TrimStart();
        const string answerMacro = @"\Answer";
        if (!trimmedStart.StartsWith(answerMacro, StringComparison.Ordinal))
            return (null, solutionArgument);

        // Read the braced answer content that follows the macro name; bail if it isn't a brace group
        // (e.g. an unrelated command like \Answers... that merely shares the prefix).
        if (!TryGetBracedContent(trimmedStart, answerMacro.Length, out var answer, out var afterAnswerIndex))
            return (null, solutionArgument);

        // Everything past the answer's closing brace is the actual solution.
        return (answer, trimmedStart[afterAnswerIndex..]);
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
        if (startIndex + 1 < sourceText.Length && sourceText.AsSpan(startIndex, 2) is "$$")
        {
            // Find the closing '$$' after the opening one.
            var endIndex = sourceText.IndexOf("$$", startIndex + 2, StringComparison.Ordinal);

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
            blocks.Add(new Paragraph([.. ParseInlineText(paragraph)], Highligted: false));
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

                // Handle the Link command which has a bracketed argument and a braced argument.
                if (commandName == "Link")
                {
                    // Flush any text that was being accumulated before this command
                    FlushAccumulatedText();

                    // Move the main cursor to just after the command name.
                    currentIndexRef = scanIndex;

                    // Skip any whitespace that may appear between the command and its opening bracket.
                    while (currentIndexRef < sourceText.Length && char.IsWhiteSpace(sourceText[currentIndexRef]))
                        currentIndexRef++;

                    // Parse the optional bracketed argument [url]
                    string url;
                    if (currentIndexRef < sourceText.Length && sourceText[currentIndexRef] == '[')
                    {
                        // Find the closing bracket
                        var closingBracketIndex = sourceText.IndexOf(']', currentIndexRef + 1);

                        // Ensure it's there
                        if (closingBracketIndex < 0)
                            throw new TexParserException($"Unclosed bracket in \\Link at: {sourceText.PreviewAt(currentIndexRef)}");

                        // Extract the URL
                        url = sourceText[(currentIndexRef + 1)..closingBracketIndex].Trim();

                        // Advance past the closing bracket
                        currentIndexRef = closingBracketIndex + 1;
                    }
                    // The [ should be there
                    else throw new TexParserException($"Missing bracketed URL argument in \\Link at: {sourceText.PreviewAt(currentIndexRef)}");

                    // Skip any whitespace between the bracket and the brace
                    while (currentIndexRef < sourceText.Length && char.IsWhiteSpace(sourceText[currentIndexRef]))
                        currentIndexRef++;

                    // If we do not find an opening brace, it's an error
                    if (currentIndexRef >= sourceText.Length || sourceText[currentIndexRef] != '{')
                        throw new TexParserException($"Missing braced text argument in \\Link at: {sourceText.PreviewAt(currentIndexRef)}");

                    // Consume the opening brace so the recursive call starts inside the group.
                    currentIndexRef++;

                    // Create a temporary container for the link's inner content.
                    var linkContent = new List<RawContentBlock>();

                    // Recursively parse until the matching '}' of this command's argument.
                    ParseInlineRecursive(
                        sourceText: sourceText,
                        currentIndexRef: ref currentIndexRef,
                        terminatorCharacter: '}',
                        outputBlocks: linkContent
                    );

                    // Create the link block
                    outputBlocks.Add(new Link(url, [.. linkContent]));

                    // Continue parsing after the command's closing brace.
                    continue;
                }
                // Handle the image command which has one or two braced arguments.
                else if (commandName == "Image")
                {
                    // Flush any text that was being accumulated before this command
                    FlushAccumulatedText();

                    // Move the cursor to after the command name
                    var imageParseIndex = scanIndex;

                    // First we'll see if it's an inline image, indicated by a *
                    var isInline = imageParseIndex < sourceText.Length && sourceText[imageParseIndex] == '*';

                    // If case of a presence of a *, we need to advance the index past it.
                    if (isInline)
                        imageParseIndex++;

                    // Parse up to 2 arguments: id (required), scale (optional)
                    var (imageArgs, afterImageIndex) = ParseBracedArguments(sourceText, imageParseIndex, maxArgumentCount: 2);

                    // We need at least the id
                    if (imageArgs.Count < 1)
                        throw new TexParserException($"Expected at least 1 argument for \\Image at: {sourceText.PreviewAt(currentIndexRef)}");

                    // Advance the main cursor
                    currentIndexRef = afterImageIndex;

                    // Extract id
                    var idContent = imageArgs[0];

                    // Parse optional scale (default 1.0)
                    var scale = 1.0m;

                    // The code should guarantee that we have at most 2 arguments
                    if (imageArgs.Count > 1)
                    {
                        // Get the unparsed scale
                        var scaleContent = imageArgs[1];

                        // PlainTex allows various formats...One thing that can be handled easily is when 
                        // the string starts with a decimal point (e.g. .5).
                        if (scaleContent.StartsWith('.'))
                            scaleContent = $"0{scaleContent}";

                        // Parse the scale
                        scale = decimal.Parse(scaleContent, CultureInfo.InvariantCulture);
                    }

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
        return new Paragraph([.. blocks], Highligted: false);
    }

    /// <summary>
    /// Parses up to a specified number of consecutive braced arguments.
    /// If no <paramref name="maxArgumentCount"/> is provided, parses all available braced arguments.
    /// </summary>
    /// <param name="sourceText">The text to search within.</param>
    /// <param name="startIndex">The index to start searching from.</param>
    /// <param name="maxArgumentCount">The maximum number of arguments to parse. Defaults to parse all.</param>
    /// <returns>A tuple with the list of argument strings and the new index.</returns>
    private static (List<string> arguments, int endIndex) ParseBracedArguments(
        string sourceText,
        int startIndex,
        int? maxArgumentCount = null)
    {
        // Initialize a list to store the parsed argument strings.
        var arguments = new List<string>();

        // Set the initial cursor position.
        var currentIndex = startIndex;

        // Loop until we've parsed the max number of arguments or run out of braces.
        while (arguments.Count < (maxArgumentCount ?? int.MaxValue) &&
               TryGetBracedContent(sourceText, currentIndex, out var content, out var endIndex))
        {
            // Add the extracted content to the list of arguments.
            arguments.Add(content);

            // Update the cursor to the position after the parsed argument.
            currentIndex = endIndex;
        }

        // Return the list of arguments and the final cursor position.
        return (arguments, currentIndex);
    }

    /// <summary>
    /// Attempts to extract the content of the first top-level braced group found after a start index.
    /// Returns false if no opening brace is found before the next high-level command or end of string.
    /// </summary>
    /// <param name="sourceText">The text to search within.</param>
    /// <param name="startIndex">The index to start searching from.</param>
    /// <param name="content">The extracted content if successful.</param>
    /// <param name="endIndex">The index after the closing brace if successful.</param>
    /// <returns>True if a braced group was found and extracted, false otherwise.</returns>
    private static bool TryGetBracedContent(string sourceText, int startIndex, out string content, out int endIndex)
    {
        // Start if with no content and current position
        content = string.Empty;
        endIndex = startIndex;

        // Keep track where are are
        var scanIndex = startIndex;

        // Scan forward to find an opening brace, but stop if we hit a backslash (next command)
        while (scanIndex < sourceText.Length)
        {
            // Get the current character
            var currentChar = sourceText[scanIndex];

            // If found a whitespace
            if (char.IsWhiteSpace(currentChar))
            {
                // Skip it and continue scanning
                scanIndex++;
                continue;
            }

            // If found an opening brace
            if (currentChar == '{')
            {
                // Start tracking nested braces
                var braceCount = 1;
                var contentStartIndex = scanIndex + 1;

                // Scan forward to find the closing brace
                for (var i = contentStartIndex; i < sourceText.Length; i++)
                {
                    // Found another opening brace
                    if (sourceText[i] == '{')
                        braceCount++;

                    // Found a closing brace
                    else if (sourceText[i] == '}')
                    {
                        // Close a nested brace
                        braceCount--;

                        // Found the closing brace of the top-level group
                        if (braceCount == 0)
                        {
                            // Extract the content 
                            content = sourceText[contentStartIndex..i].Trim();

                            // Update the end index where we stopped
                            endIndex = i + 1;

                            // Return success
                            return true;
                        }
                    }
                }

                // Unclosed brace - throw exception
                throw new TexParserException($"Unclosed brace starting at: {sourceText.PreviewAt(scanIndex)}");
            }

            // Any other character means no more braced arguments
            return false;
        }

        // Reached end of string without finding a brace
        return false;
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
        textContent = Regex.Replace(textContent, "---", "\u2014");

        // Replace TeX-style double dash with an en dash.
        textContent = Regex.Replace(textContent, "--", "\u2013");

        // Replace TeX-style inline spaces
        textContent = Regex.Replace(textContent, @"\\,", " ");

        // Replace escape signs for literal characters
        textContent = Regex.Replace(textContent, @"\s*\\%", "%");

        // Convert TeX-style hyphenation hints (\-) to soft hyphens
        textContent = Regex.Replace(textContent, @"\\-", "\u00AD");

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
        // Use ContentTree.Traverse to collect all text surfaces from PlainText and MathTex nodes.
        var (_, collectedTexts) = ContentTree.Traverse(
            [.. blocks],
            ImmutableList<string>.Empty,
            (node, texts) => node switch
            {
                // Collect text from leaf nodes that contain TeX commands
                PlainText text => new(node, texts.Add(text.Text)),
                MathTex math => new(node, texts.Add(math.Text)),

                // All other nodes: pass through unchanged
                _ => new(node, texts)
            }
        );

        // Combine all captured text into a single blob for scanning.
        var combined = collectedTexts.ToJoinedString(" ");

        // Match backslash followed by Unicode letters (including diacritics)
        return [.. Regex.Matches(combined, @"\\[\p{L}]+").Select(match => match.Value[1..])];
    }

    #endregion
}


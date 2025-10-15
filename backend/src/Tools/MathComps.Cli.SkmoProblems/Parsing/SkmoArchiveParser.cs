using MathComps.Shared;
using MathComps.TexParser.Types;
using System.Collections.Immutable;
using System.Text.RegularExpressions;

namespace MathComps.Cli.SkmoProblems.Parsing;

/// <summary>
/// A static class for parsing the raw TeX files of the Slovak Mathematical Olympiad (SKMO) archive.
/// </summary>
public static class SkmoArchiveParser
{
    /// <summary>
    /// A dictionary mapping original author names found in the archive to their corrected or standardized versions.
    /// </summary>
    private static readonly ImmutableDictionary<string, string> _correctedNames =
        // Load corrected names
        File.ReadAllLines("Parsing/corrected_names.txt")
            // The separator is a pipe
            .Select(line => line.Split(" | "))
            // Map original names to corrected ones
            .ToImmutableDictionary(parts => parts[0], parts => parts[1]);

    /// <summary>
    /// A set of author strings that should be discarded during parsing, such as placeholders or non-author credits.
    /// </summary>
    private static readonly ImmutableHashSet<string> _discardedEntries = [.. File.ReadAllLines("Parsing/discarded_entries.txt")];

    /// <summary>
    /// Parses all problems from the SKMO archive directly from raw TeX files.
    /// </summary>
    /// <returns>An immutable list of all parsed problems as <see cref="SkmoParsedProblem"/> objects.</returns>
    /// <summary>
    /// Performs a full parse of the SKMO archive from the raw TeX files on disk.
    /// </summary>
    /// <param name="years">Optional set of specific olympiad years to parse. If null or empty, parses all years.</param>
    /// <returns>An immutable list of all parsed problems as <see cref="SkmoParsedProblem"/> objects.</returns>
    public static ImmutableList<SkmoParsedProblem> ParseSkmoArchive(ImmutableHashSet<int>? years = null) =>
        // Start with getting all year directories
        [.. Directory.GetDirectories(Path.Combine("../../../../", SkmoDataPaths.SkmoArchiveDirectory))
            // Order them from the latest
            .OrderByDescending(folder => int.Parse(Path.GetFileName(folder)))
            // Parse the year from the folder name
            .Select(folder =>
            {
                // Assume it can be done
                if (!int.TryParse(Path.GetFileName(folder), out var olympiadYear))
                    throw new FormatException($"Invalid folder: {folder}. Expected an olympiad year.");

                // Return the year so we don't need to parse again
                return (folder, olympiadYear);
            })
            
            // Filter by specific years if requested
            .Where(pair => years is null || years.Contains(pair.olympiadYear))
            // Each gives ABC and Z problem and solution files...The Z ones have the 'z' suffix
            .SelectMany(pair => new[] { "", "z" }.SelectMany(suffix =>
            {
                // Convenient deconstruct
                var (folder,olympiadYear) = pair;

                // Apparently 51 and 52 doesn't have a 'z' folder, so we skip it
                if (olympiadYear is 51 or 52 && suffix is "z")
                    return [];

                // Load the problem and solution files...
                var problemFilePath = Path.Combine(folder, $"zadania{suffix}.tex");
                var solutionFilePath = Path.Combine(folder, $"riesenia{suffix}.tex");

                // Ensure each file exists
                if (!File.Exists(problemFilePath) || !File.Exists(solutionFilePath))
                    throw new FileNotFoundException($"Required problem/solution files not found in folder: {folder}");

                // Read the problems
                var problemFile = File.ReadAllText(problemFilePath);
                var solutionFile = File.ReadAllText(solutionFilePath);

                // 58 solutions contain duplicate problem 'vyberko, den 4, priklad 2'
                if (olympiadYear is 58 && suffix is "")
                    solutionFile = solutionFile.Replace("{%%%%%   vyberko, den 4, priklad 2\r\n...}", "");

                // Parse the problem file
                var problemFileData = ParseProblemSolutionFile($"{olympiadYear}{suffix}", problemFile).ToList();

                // Warn about empty problem file
                if (problemFileData.Count == 0)
                    throw new FormatException($"No problems found in file: {problemFilePath}");

                // Parse the solution file
                var solutionFileData = ParseProblemSolutionFile($"{olympiadYear}{suffix}",solutionFile)
                    // We'll try to look for problems by id
                    .ToDictionary(problem => problem.Id, problem => problem.Content);

                // Warn about empty solution file
                if (solutionFileData.Count == 0)
                    throw new FormatException($"No solutions found in file: {solutionFilePath}");

                // Combine the problem and solution data
                return problemFileData.Select(problem =>
                {
                    // Find the corresponding solution
                    var solution = solutionFileData.GetValueOrDefault(problem.Id);

                    // Create a raw problem data object
                    return
                    (
                        OlympiadYear: olympiadYear,
                        problem.Id,
                        Statement: problem.Content,
                        Solution: solution,
                        problem.AuthorString
                    );
                });
            }))
            // Skip empty problems
            .Where(problem => problem.Statement is not ("..." or { Length: 0}))
            // Handle empty solutions and authors
            .Select(problem => problem with
            {
                Solution = problem.Solution == "..." ? null : problem.Solution,
                AuthorString = problem.AuthorString is null or "..." ? null : problem.AuthorString,
            })
            // Handle each problem now, ending up with a list of problems and a set of authors without countries
            .Select(problem =>
            {
                #region Handle authors

                // TST problems should have no authors, the author strings here are original sources
                var authorString = problem.Id.StartsWith("vyberko") ? null : problem.AuthorString;

                // No empty strings
                authorString = string.IsNullOrEmpty(authorString?.Trim()) ? null : authorString;

                // Create authors from the author strings
                // Real author strings might have commas, indicating multiple authors, so we split them
                var authors = authorString?.Split(',')
                    // Get rid of non-breaking spaces
                    .Select(author => author.Replace('~', ' '))
                    // Remove any leading or trailing whitespace
                    .Select(author => author.Trim())
                    // Get rid of discarded entries
                    .Where(author => !_discardedEntries.Contains(author))
                    // Translate their names
                    .Select(author => _correctedNames.GetValueOrDefault(author, defaultValue: author))
                    // No empty values
                    .Where(author => !string.IsNullOrEmpty(author))
                    // Evaluate to an immutable list
                    .ToImmutableList() ?? [];

                #endregion

                #region Parse Competition Data

                // A bit of correcting so parsing is easier
                var problemId = problem.Id
                    .Replace("trojstretnutie", "CAPS")
                    .Replace(", priklad", "")
                    .Replace('t', 'T')
                    .Replace("vyberko, den ", "TST D")
                    .Replace("vyberko C, den 1", "TSTC");

                // The regex for the 'official' olympiad contests
                var ourMOMatch = Regex.Match(problemId, @"^(.+)-(.+)-(\d+)$");

                // The regex for 'international' contests + non-official ones
                var internationalMatch = Regex.Match(problemId, @"^(\w*) (\w*)(?: )?(\d+)$");

                // Prepare a tuple holding the result
                (string? Category, string Competition, string? Subcompetition, int Order) parsedId;

                // Try to match our MO
                if (ourMOMatch.Success)
                {
                    // If it works out, we have no subcompetition, the rest is there
                    parsedId = (ourMOMatch.Groups[1].Value, ourMOMatch.Groups[2].Value, null, int.Parse(ourMOMatch.Groups[3].Value));
                }
                // Try to match the international contests
                else if (internationalMatch.Success)
                {
                    // The subcompetition is optional, so we check if it exists
                    var subcompetition = internationalMatch.Groups[2].Value;
                    subcompetition = subcompetition.Length == 0 ? null : subcompetition;

                    // The rest should be straightforward...We don't have a category for these...
                    // I guess it can be corrected later...
                    parsedId = (null, internationalMatch.Groups[1].Value, subcompetition, int.Parse(internationalMatch.Groups[3].Value));
                }
                // This is sad
                else throw new FormatException($"Invalid problem ID format: {problem.Id}");

                #endregion

                // Return the final problem data
                return new SkmoParsedProblem
                (
                    new SkmoRawProblem(
                        OlympiadYear: problem.OlympiadYear,
                        Category: parsedId.Category,
                        Competition: parsedId.Competition,
                        Subcompetition: parsedId.Subcompetition,
                        Order: parsedId.Order,
                        Statement: problem.Statement,
                        Solution: problem.Solution,
                        Authors: authors
                    ),
                    ParsedStatement: null,
                    ParsedSolution: null
                );
            }),];

    /// <summary>
    /// Parses a single TeX file containing multiple problem or solution entries.
    /// Each entry is expected to be in the format:
    /// <code>
    /// {%%%%%   A-I-1
    /// ... content ...}
    /// \podpis{Author Name}
    /// </code>
    /// where the `\podpis` command is optional.
    /// </summary>
    /// <param name="fileId">An identifier for the file being parsed, used for logging and error reporting.</param>
    /// <param name="file">The string content of the TeX file.</param>
    /// <returns>An enumerable sequence of tuples, each containing the parsed ID, content, and optional author string for a problem.</returns>
    private static IEnumerable<(string Id, string Content, string? AuthorString)> ParseProblemSolutionFile(string fileId, string file)
    {
        // Get the sections of the file that match the header pattern
        var matches = Regex.Matches(file, @"\{%%%%%\s+(.+)$", RegexOptions.Multiline);

        // Parse the sections
        return matches.Select((currentMatch, i) =>
        {
            // Figure out the problem ID
            var problemId = currentMatch.Groups[1].Value.Trim();

            // The content starts right after the current match's header.
            var contentStartIndex = currentMatch.Index + currentMatch.Length;

            // The content ends at the start of the next match's header, or at the end of the file.
            var contentEndIndex = i + 1 < matches.Count ? matches[i + 1].Index : file.Length;

            // Extract the raw content block for this problem.
            var rawContent = file[contentStartIndex..contentEndIndex];

            // We'll figure out the author and final content.
            string? author = null;
            string finalContent;

            // Check if an author signature exists in the content block.
            var authorMatch = Regex.Match(rawContent, @"(?m)^\\podpis\{(.*)\}\s*$");

            // If so...
            if (authorMatch.Success)
            {
                // Parse the author's name
                author = authorMatch.Groups[1].Value.Trim();

                // The actual content is the part of the block before the author signature.
                finalContent = rawContent[..authorMatch.Index].Trim();
            }
            // Otherwise...
            else
            {
                // No author found and the final content is the whole block.
                finalContent = rawContent.Trim();
            }

            // The way we parsed it, the content should end with a closing brace.
            if (!finalContent.EndsWith('}'))
                // If it doesn't, we have a problem with the file format.
                throw new FormatException($"{fileId}: Invalid problem content format for ID '{problemId}': missing closing brace.");

            // Remove the closing brace from the final content
            finalContent = finalContent[..^1].Trim();

            // We're done
            return (problemId, finalContent, author);
        });
    }
}

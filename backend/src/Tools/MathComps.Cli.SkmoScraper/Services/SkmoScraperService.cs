using HtmlAgilityPack;
using Spectre.Console;
using System.Text;

namespace MathComps.Cli.SkmoScraper.Services;

/// <summary>
/// Provides functionality to scrape solution documents from the SKMO website.
/// Handles the complex table structures found on the Slovak Mathematical Olympiad website,
/// extracting solution links from both main competition tables and additional document tables.
/// </summary>
/// <param name="httpClient">The HTTP client used for making requests to the SKMO website.</param>
public class SkmoScraperService(HttpClient httpClient) : ISkmoScraperService
{
    /// <summary>
    /// The base URL for the Slovak Mathematical Olympiad website.
    /// </summary>
    private const string BaseUrl = "https://skmo.sk/";

    /// <summary>
    /// Delay between requests to be respectful to the website (in milliseconds).
    /// </summary>
    private const int RequestDelayMs = 1000;

    /// <inheritdoc/>
    public async Task<List<ScrapedSolution>> ScrapeAllYearsAsync(
        int startYear,
        int? endYear,
        CancellationToken cancellationToken = default)
    {
        // We'l gather results here
        var allSolutions = new List<ScrapedSolution>();

        // Start with the provided year
        var currentYear = startYear;

        // Use AnsiConsole.Status to provide real-time feedback during the scraping process.
        await AnsiConsole.Status()
            .StartAsync("Scraping years...", async context =>
            {
                // We'll break when no new years
                while (true)
                {
                    // Log year
                    context.Status($"[bold blue]Scraping year {currentYear}...[/]");

                    // Get the year data
                    var (noMoreContent, solutionsForYear) = await ScrapeYearAsync(currentYear, cancellationToken);

                    // Stop if we're reached the end of available years
                    if (noMoreContent)
                    {
                        // Make aware of end
                        AnsiConsole.MarkupLine($"[green]Stopping at year {currentYear}. No new content found.[/]");

                        // Stop parsing
                        break;
                    }

                    // Stop if we've reached the specified end year.
                    if (endYear.HasValue && currentYear > endYear.Value)
                    {
                        // Make aware
                        AnsiConsole.MarkupLine($"[green]Reached end year {endYear.Value}. Stopping scraping.[/]");

                        // Stop parsing
                        break;
                    }

                    // Log count
                    AnsiConsole.MarkupLine($"[dim]Found {solutionsForYear.Count} solution(s) for year {currentYear}.[/]");

                    // Record solutions
                    allSolutions.AddRange(solutionsForYear);

                    // Advance to the next year
                    currentYear++;

                    // Add a delay between requests to be respectful to the website.
                    await Task.Delay(RequestDelayMs, cancellationToken);
                }
            });

        // We're done
        return allSolutions;
    }

    /// <summary>
    /// Scrapes a single competition year from the website.
    /// Fetches the HTML content and parses both main competition tables and additional competitions.
    /// </summary>
    /// <param name="year">The competition year to scrape (e.g., 70, 71).</param>
    /// <param name="cancellationToken">A token to monitor for cancellation requests.</param>
    /// <returns>
    /// A tuple containing:
    /// <list type="bullet">
    ///   <item>
    ///     <description>
    ///       <c>noMoreContent</c>: Whether this year has no more year content. Apparently when we use 'year' bigger than the biggest,
    ///       it will default to the biggest with available data
    ///     </description>
    ///   </item>
    ///   <item>
    ///     <description>
    ///       <c>solutions</c>: A list of <see cref="ScrapedSolution"/> objects parsed from the page. The list is empty if no solutions are found or the page is unavailable.
    ///     </description>
    ///   </item>
    /// </list>
    /// </returns>
    private async Task<(bool noMoreContent, List<ScrapedSolution> solutions)> ScrapeYearAsync(int year, CancellationToken cancellationToken)
    {
        // Fetch the web
        var response = await httpClient.GetAsync($"{BaseUrl}dokumenty.php?rocnik={year}", cancellationToken);

        // Ensure the HTTP request was successful before proceeding with parsing.
        response.EnsureSuccessStatusCode();

        // Handle encoding issues by reading as bytes first, then decoding with proper encoding.
        var contentBytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);

        // Apparently SKMO has this encoding hmmm
        var pageContent = Encoding.GetEncoding("windows-1250").GetString(contentBytes);

        // Parse the HTML content using HtmlAgilityPack for robust DOM navigation.
        var document = new HtmlDocument();
        document.LoadHtml(pageContent);

        // If the header says a different year, then we're reached the end (see the XML comment)
        if (!document.DocumentNode.SelectSingleNode("//h1").InnerText.Contains($"{year}. ročník"))
            return (noMoreContent: true, solutions: new());

        // Extract solution links from both the main competition table and additional documents table.
        return (noMoreContent: false, solutions: [
            .. ParseMainCompetitionTable(document, year),
            .. ParseOtherDocumentsTable(document, year),
        ]);
    }

    /// <summary>
    /// Parses the main competition table ("kolá MO") from the provided HTML document for a given year.
    /// This table contains solution links organized by competition category and round, with a complex header structure.
    /// </summary>
    /// <param name="document">The HTML document representing the competition page.</param>
    /// <param name="year">The competition year (ročník) being parsed.</param>
    /// <returns>An enumeration of <see cref="ScrapedSolution"/> objects representing all solution links found 
    /// in the main competition table for the specified year.</returns>
    private static IEnumerable<ScrapedSolution> ParseMainCompetitionTable(HtmlDocument document, int year)
    {
        // Locate the main competition table by finding the h2 heading and its following table.
        var tableNode = document.DocumentNode.SelectSingleNode("//h2[contains(text(), 'kol') and contains(text(), 'MO')]/following-sibling::table[1]")
            // Ensure the table is there
            ?? throw new Exception($"Could not find the main competition table for year {year}");

        // Get the table's rows...
        var rows = tableNode.SelectNodes(".//tr");

        // Should be at least 3 cuz the first 2 are headers
        if (rows == null || rows.Count < 3)
            throw new Exception($"Main competition table for year {year} has an unexpected structure (less than 3 rows)");

        // Process each data row (skipping the two header rows) to extract solution links.
        foreach (var dataRow in rows.Skip(2))
        {
            // Get the individual cells
            var cells = dataRow.SelectNodes(".//td|.//th");

            // This must be fine
            if (cells is null or { Count: 0 })
                throw new Exception($"Main competition table for year {year} has an unexpected structure (now cell in a row).");

            // The first cell contains the category (A, B, C, Z9, etc.)
            var category = cells[0].InnerText.Trim();

            // Some cells have a span. This is the shift by which we need to adjust the cell index
            var currentColSpan = 0;

            // Process each data cell, now we know whether solutions are
            for (var i = 1; i < cells.Count; i++)
            {
                // Get the cell
                var cell = cells[i];

                // Parse the col span
                var colSpan = cell.GetAttributeValue<int?>("colspan", def: null);

                // The cells with a span have no solutions
                if (colSpan.HasValue)
                {
                    // But we need to account for it
                    // -1 because the loop will advance by 1 anyway
                    currentColSpan += colSpan.Value - 1;

                    // Skip this cell
                    continue;
                }

                // Get the 'real' index accounting for colspans
                var realIndex = i + currentColSpan;

                // Hard-coded indices of cells that contain solution links
                var roundId = realIndex switch
                {
                    // Domáce
                    3 => "I",

                    // Školské...But there is a special case!!! Apparently Z4 used to have
                    // a school round but in the SKMO archive data, its problems are 'II'
                    5 when category is "Z4" => "II",
                    5 => "S",

                    // Okresné
                    7 => "II",

                    // Krajské, in A, B, C its the 'second' round, otherwise the third round
                    9 when category is "A" or "B" or "C" => "II",
                    9 when category.StartsWith('Z') => "III",

                    // Celoštátne
                    11 => "III",

                    // The rest are not solution cells
                    _ => null,
                };

                // Skip non-solution cells
                if (roundId is null)
                    continue;

                // Get the solution node
                var linkNode = cell.SelectSingleNode(".//a");

                // Some solution cells are just empty
                if (linkNode is null)
                    continue;

                // Get the href
                var href = linkNode.GetAttributeValue<string?>("href", def: null)
                    // It must be there
                    ?? throw new Exception($"Expected a link in the solution cell for year {year}");

                // Create absolute URL from relative href
                var solutionLink = new Uri(new Uri(BaseUrl), href).ToString();

                // Create absolute URLs from relative hrefs and store the solution data.
                yield return new ScrapedSolution(
                    Year: year,
                    CompetitionId: roundId,
                    Category: category,
                    SolutionLink: solutionLink
                );
            }
        }
    }

    /// <summary>
    /// Parses the 'ďalšie dokumenty' (other documents) table which contains solution links for special events.
    /// This table has a simpler structure with events like IMO, MEMO, EGMO, etc. in the first column.
    /// </summary>
    /// <param name="document">The HTML document containing the table to parse.</param>
    /// <param name="year">The competition year associated with the solutions.</param>
    /// <returns>
    /// An enumerable sequence of <see cref="ScrapedSolution"/> objects representing the solution links found in the table.
    /// Returns an empty sequence if the table is not present or no solutions are found.
    /// </returns>
    private static IEnumerable<ScrapedSolution> ParseOtherDocumentsTable(HtmlDocument document, int year)
    {
        // Locate the additional documents table by finding the h2 heading and its following table.
        var tableNode = document.DocumentNode.SelectSingleNode("//h2[contains(text(), 'dokumenty')]/following-sibling::table[1]")
            // Must be there
            ?? throw new Exception($"Additional competition table for year {year} is not there.");

        // Process each data row (skip the header row) to extract solution links.
        foreach (var row in tableNode.SelectNodes(".//tr").Skip(1))
        {
            // Get the cells
            var cells = row.SelectNodes(".//td|.//th");

            // Expecting 4 columns...
            if (cells == null || cells.Count != 4)
                throw new Exception($"Additional competition table for year {year} has an unexpected structure.");

            // The 'riešenia' (solutions) are expected to be in the third column (index 2).
            var solutionCell = cells[2];

            // We should have a link
            var linkNode = solutionCell.SelectSingleNode(".//a");

            // Some solution cells are just empty
            if (linkNode is null)
                continue;

            // Get the link value
            var href = linkNode.GetAttributeValue<string?>("href", def: null)
                // It must be there
                ?? throw new Exception($"Expected a link in the solution cell for year {year} in the additional documents table.");

            // Extract the event name from the first column (IMO, MEMO, EGMO, etc.).
            var competitionName = cells[0].InnerText.Trim();

            // Get the absolute URL from the relative href
            var solutionLink = new Uri(new Uri(BaseUrl), href).ToString();

            // Create the solution record with null category since this table doesn't use categories.
            yield return new ScrapedSolution(
               Year: year,
               CompetitionId: competitionName,
               Category: null,
               SolutionLink: solutionLink
           );
        }
    }
}

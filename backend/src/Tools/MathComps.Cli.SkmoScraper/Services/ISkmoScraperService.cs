namespace MathComps.Cli.SkmoScraper.Services;

/// <summary>
/// Defines the contract for a service that scrapes the SKMO website.
/// </summary>
public interface ISkmoScraperService
{
    /// <summary>
    /// Scrapes solution links for all SKMO competition years, starting from the specified year.
    /// Continues scraping each subsequent year until the end year is reached or no new solution data is found.
    /// </summary>
    /// <param name="startYear">The first competition year ("ročník") to begin scraping from. This should 
    /// correspond to the earliest year of interest.</param>
    /// <param name="endYear">The last competition year ("ročník") to scrape. If null, 
    /// scraping continues until the scraper detects no new solution data for a year.</param>
    /// <param name="cancellationToken">A cancellation token that can be used to abort the scraping operation early.</param>
    /// <returns>
    /// A list of <see cref="ScrapedSolution"/> records, each representing a discovered solution link for a competition, year, and category.
    /// </returns>
    Task<List<ScrapedSolution>> ScrapeAllYearsAsync(
        int startYear,
        int? endYear,
        CancellationToken cancellationToken = default);
}

using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Extensions;

/// <summary>
/// Custom PostgreSQL database functions and text normalization utilities.
/// </summary>
public static class PostgresDbFunctions
{
    /// <summary>
    /// Removes accents and diacritics from text using PostgreSQL's unaccent() function.
    /// The function is wrapped inside a custom immutable_unaccent() function to ensure 
    /// because PG requires the function to be immutable to be used in indexes.
    /// </summary>
    /// <param name="text">The text to normalize by removing accents.</param>
    /// <returns>Text with all diacritics removed (café → cafe, pôžitok → pozitok).</returns>
    /// <remarks>
    /// This method is translated to SQL by EF Core and should only be used in LINQ queries on database columns.
    /// Requires the 'unaccent' PostgreSQL extension to be enabled in the database.
    /// </remarks>
    [DbFunction("immutable_unaccent", "public")]
    // The argument is used in the translated SQL, not in this throwing body.
    // ReSharper disable once UnusedParameter.Global
    public static string Unaccent(string text) =>
        // This method body will never execute; EF Core translates it to SQL.
        throw new NotSupportedException("This method is for use in EF Core queries only.");
}


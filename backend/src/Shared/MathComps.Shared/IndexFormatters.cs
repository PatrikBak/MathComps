using System.Text;

namespace MathComps.Shared;

/// <summary>
/// Provides static helper methods for formatting numerical indices into various string representations,
/// such as Roman or alphabetic numerals.
/// </summary>
public static class IndexFormatters
{
    /// <summary>
    /// Converts a 1-based index to an uppercase Roman numeral.
    /// </summary>
    /// <param name="number">The positive integer to convert.</param>
    /// <returns>The Roman numeral as a string, or the original number as a string if it's not positive.</returns>
    public static string ToRoman(int number)
    {
        // Roman numerals are not defined for zero or negative numbers, so we return the input as is.
        if (number <= 0)
            return number.ToString();

        // This map is ordered from largest to smallest value to facilitate a greedy conversion algorithm.
        var romanMap = new[]
        {
            (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
            (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
            (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
        };

        // Use a StringBuilder for efficient string concatenation in a loop.
        var romanBuilder = new StringBuilder();

        // Iterate through the map and append the corresponding numeral for each value.
        foreach (var (value, numeral) in romanMap)
        {
            // Repeatedly subtract the largest possible value from the number.
            while (number >= value)
            {
                // Append the corresponding Roman numeral.
                romanBuilder.Append(numeral);

                // Now just the remaining part of the number needs to be converted.
                number -= value;
            }
        }

        // We have the built string
        return romanBuilder.ToString();
    }

    /// <summary>
    /// Converts a 1-based index to an alphabetic label (A, B, ..., Z, AA, AB, ...).
    /// </summary>
    /// <param name="number">The 1-based index to convert.</param>
    /// <param name="useUppercase">True for uppercase (A, B), false for lowercase (a, b).</param>
    /// <returns>The alphabetic label as a string, or the original number as a string if it's not positive.</returns>
    public static string ToAlpha(int number, bool useUppercase)
    {
        // Alphabetic labels are not typically used for non-positive indices.
        if (number <= 0)
            return number.ToString();

        // Determine the starting character based on the case preference.
        var initialCharacter = useUppercase ? 'A' : 'a';

        // Prepare a StringBuilder to construct the result.
        var alphaBuilder = new StringBuilder();

        // The conversion logic works like changing a number to base-26.
        while (number > 0)
        {
            // Adjust the number to be 0-based (A=0, B=1, etc.) before the modulo operation.
            number--;

            // Get the remainder to find the character
            var remainder = number % 26;

            // Prepend the corresponding character to the result.
            alphaBuilder.Insert(0, (char)(initialCharacter + remainder));

            // Prepare for the next digit.
            number /= 26;
        }

        // We have the built string
        return alphaBuilder.ToString();
    }
}

using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain;

/// <summary>
/// School counted as <see cref="SchoolGradeDto"/> counts it, each school year running from July to the following
/// June.
/// </summary>
public static class SchoolYear
{
    /// <summary>
    /// The years of primary school before high school.
    /// </summary>
    private const int PrimarySchoolYears = 9;

    /// <summary>
    /// The years of high school, the last one ending in the maturita.
    /// </summary>
    private const int HighSchoolYears = 4;

    /// <summary>
    /// The month a school year counts from once the last one has ended in June.
    /// </summary>
    private const int TurnMonth = 7;

    /// <summary>
    /// The calendar year the school year holding an instant ends in, the year turning on the first of July, read
    /// in UTC.
    /// </summary>
    /// <param name="instant">The instant.</param>
    /// <returns>The year its school year ends in.</returns>
    private static int EndingYearOf(DateTimeOffset instant)
    {
        // The instant as UTC reads it
        var utc = instant.ToUniversalTime();

        // A school year past its turn ends in the next calendar year
        return utc.Year + (utc.Month >= TurnMonth ? 1 : 0);
    }

    /// <summary>
    /// The latest maturita anybody in school can be heading for at an instant: that of a student in the first year
    /// of primary school.
    /// </summary>
    /// <param name="instant">The instant.</param>
    /// <returns>The year of that maturita.</returns>
    public static int LatestGraduationYear(DateTimeOffset instant) =>
        // The end of the school year under way, and every year of both schools after the first
        EndingYearOf(instant) + PrimarySchoolYears + HighSchoolYears - 1;

    /// <summary>
    /// Works out where a student was in school at an instant, counted back from the year of their maturita.
    /// </summary>
    /// <remarks>
    /// A maturita before the instant's school year is past high school, whatever the profile says. One further off
    /// than <see cref="LatestGraduationYear"/> allowed then, which a year saved in a later school year can be, still
    /// reads as the first year.
    /// </remarks>
    /// <param name="graduationYear"><inheritdoc cref="User.GraduationYear" path="/summary"/></param>
    /// <param name="hasLeftHighSchool"><inheritdoc cref="User.HasLeftHighSchool" path="/summary"/></param>
    /// <param name="instant">The instant.</param>
    /// <returns>Their grade then.</returns>
    public static SchoolGradeDto GradeAt(int? graduationYear, bool hasLeftHighSchool, DateTimeOffset instant)
    {
        // The calendar year the instant's school year ends in
        var schoolYearEnd = EndingYearOf(instant);

        // Past high school by their own word, with no year left to count from, or with the maturita already behind
        // the instant
        if (hasLeftHighSchool || graduationYear is not { } maturitaYear || maturitaYear < schoolYearEnd)
            return new PastHighSchoolDto();

        // Their year of school over both schools, the maturita's year being the last, and the first at the earliest
        var yearOfSchool = Math.Max(1, PrimarySchoolYears + HighSchoolYears - (maturitaYear - schoolYearEnd));

        // High school once primary school is behind them, primary school otherwise
        return yearOfSchool > PrimarySchoolYears
            ? new HighSchoolGradeDto(yearOfSchool - PrimarySchoolYears)
            : new PrimarySchoolGradeDto(yearOfSchool);
    }
}

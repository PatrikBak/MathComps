using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the school years a student's grade is counted in: the latest maturita a profile may name, and the grade a
/// maturita far beyond it still comes to.
/// </summary>
public class SchoolYearTests
{
    /// <summary>
    /// The latest maturita is that of a student starting the first year of primary school, twelve years after the
    /// school year under way ends, and the school year turns on the first of July.
    /// </summary>
    [Fact]
    public void The_latest_maturita_is_a_first_graders_and_moves_on_in_July()
    {
        // The last minute of June, in the school year ending in 2026
        Assert.Equal(2038, SchoolYear.LatestGraduationYear(new DateTimeOffset(2026, 6, 30, 23, 59, 0, TimeSpan.Zero)));

        // The first of July, in the one ending in 2027
        Assert.Equal(2039, SchoolYear.LatestGraduationYear(new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero)));
    }

    /// <summary>
    /// A maturita further off than a first-grader's, which a profile saved in a later school year can hold for an
    /// earlier round, reads as the first year of primary school rather than a year before it.
    /// </summary>
    [Fact]
    public void A_maturita_past_a_first_graders_reads_as_the_first_year()
    {
        // A round in the school year ending in 2027
        var heldAt = new DateTimeOffset(2026, 9, 15, 10, 0, 0, TimeSpan.Zero);

        // A first-grader then
        Assert.Equal(new PrimarySchoolGradeDto(1), SchoolYear.GradeAt(2039, false, heldAt));

        // A maturita a year further off still reads as one
        Assert.Equal(new PrimarySchoolGradeDto(1), SchoolYear.GradeAt(2040, false, heldAt));
    }
}

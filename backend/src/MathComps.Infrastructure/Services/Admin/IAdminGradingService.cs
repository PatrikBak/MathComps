using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Competitions;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Grades the hosted groups: one grade per sat entry per problem, read from every conversation the entrant
/// started about the problem while their entry counted.
/// </summary>
/// <remarks>
/// A sat entry is graded only where <see cref="HostedEntryRules.IsGraded"/> says its run is.
/// </remarks>
public interface IAdminGradingService
{
    /// <summary>
    /// Reads everything grading one group starts from.
    /// </summary>
    /// <param name="groupSlug">What addresses the group.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>
    /// The group's name and dates, and each of its competitions with every graded entrant on every problem, in
    /// the order the taxonomy sets the categories out.
    /// </returns>
    /// <exception cref="HostedGroupNotFoundException">No group the site grades goes by the slug.</exception>
    Task<GradingBoardDto> GetBoardAsync(
        string groupSlug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads one entrant's grade on one problem, with everything it is read from.
    /// </summary>
    /// <param name="problemId">The problem.</param>
    /// <param name="userId">The entrant.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>
    /// The conversations the grade is read from, what the entrant said about their solution, and where the grade
    /// stands.
    /// </returns>
    /// <exception cref="HostedGradeTargetException">Nobody grades the entrant on the problem.</exception>
    Task<GradeDetailDto> GetGradeAsync(
        Guid problemId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Changes one entrant's grade on one problem, applying only what the change carries to the grade as it
    /// stands when the write lands, so two changes to different parts of the grade arriving together both
    /// survive. Lowering the mark below the help pulls the help down to it unless the change sets the help too,
    /// and taking the mark back clears the help and leaves the grade unsettled. A change leaving the grade as it
    /// was writes nothing.
    /// </summary>
    /// <param name="graderId">The grader making the change.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="userId">The entrant.</param>
    /// <param name="change">What changed.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The grade as it now stands, or null while there still is none.</returns>
    /// <exception cref="HostedGradeTargetException">Nobody grades the entrant on the problem.</exception>
    /// <exception cref="HostedGradeValueException">The grade the change leaves breaks its rules.</exception>
    Task<GradeDto?> UpdateGradeAsync(
        Guid graderId,
        Guid problemId,
        Guid userId,
        UpdateGradeRequest change,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a slug addresses no group the site grades.
/// </summary>
public sealed class HostedGroupNotFoundException() : Exception("No graded group goes by this slug");

/// <summary>
/// Thrown when a grade is read or changed for a student and a problem nobody grades.
/// </summary>
public sealed class HostedGradeTargetException() : Exception("Nobody grades this student on this problem");

/// <summary>
/// Thrown when a change would leave a grade breaking the rules its fields state (<see cref="HostedGrade"/>).
/// </summary>
public sealed class HostedGradeValueException() : Exception("The grade is not valid");

using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// Runs the competitions the site hosts itself: what a student can see of them, what an entry needs of them, and
/// what they can do with an entry — sit it, give it up for the problems, or close it early.
/// </summary>
/// <remarks>
/// Nothing here grades anything. An entry is a window and a set of problems; what a student argued inside it is
/// their defense conversations.
/// </remarks>
public interface IHostedCompetitionService
{
    /// <summary>
    /// Reads every group a student can see, with the entry they currently hold in each competition.
    /// </summary>
    /// <param name="userId">The student reading, or null for a signed-out visitor, who holds no entries.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The competitions view.</returns>
    Task<HostedCompetitionsViewDto> GetViewAsync(Guid? userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads whether a student has what an entry needs of them.
    /// </summary>
    /// <param name="userId">The student asking.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The student's readiness.</returns>
    Task<EntryReadinessDto> GetReadinessAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes a student's entry into one competition: their clock starts and, on a first entry ever, the rules are
    /// accepted along with it.
    /// </summary>
    /// <param name="userId">The student entering.</param>
    /// <param name="roundId">The competition being entered.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The entry as it now stands, and the set it opens.</returns>
    Task<SpentEntryDto> EnterAsync(Guid userId, Guid roundId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gives a student's entry up: the problems open to them and no clock is ever started. It spends the entry
    /// exactly as sitting it would, the rules accepted along with it on a first entry ever.
    /// </summary>
    /// <param name="userId">The student giving it up.</param>
    /// <param name="roundId">The competition being given up.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The entry as it now stands, and the set it opens.</returns>
    Task<SpentEntryDto> ForfeitAsync(Guid userId, Guid roundId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Closes a running entry where the student says rather than where its clock does. Nothing is added to what
    /// they have written; what it changes is that nothing more can be.
    /// </summary>
    /// <param name="userId">The student handing in.</param>
    /// <param name="roundId">The competition whose entry is being handed in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The entry as it now stands.</returns>
    Task<HostedEntryDto> FinishAsync(Guid userId, Guid roundId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads one competition's problem set, with whatever the student has said about each. An embargoed set is
    /// served only to a student who has spent an entry into it.
    /// </summary>
    /// <param name="userId">The student reading.</param>
    /// <param name="roundId">The competition whose problems these are.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The problems, in the order the competition sets them.</returns>
    Task<IReadOnlyList<HostedCompetitionProblemDto>> GetProblemsAsync(
        Guid userId, Guid roundId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a round is not one the site hosts, so there is no competition under the id.
/// </summary>
public sealed class HostedCompetitionNotFoundException() : Exception("Competition not found");

/// <summary>
/// Thrown when an entry is taken into a group that is not currently taking them, before it opens or after it
/// has closed.
/// </summary>
public sealed class HostedGroupNotOpenException() : Exception("This competition is not taking entries");

/// <summary>
/// Thrown when a student takes a second entry into a competition whose group allows only one.
/// </summary>
public sealed class HostedEntryAlreadySpentException() : Exception("This entry has already been spent");

/// <summary>
/// Thrown when an entry is handed in that is not one the student is currently sitting.
/// </summary>
public sealed class HostedEntryNotRunningException() : Exception("There is no entry to hand in");

/// <summary>
/// Thrown when a student enters without the account details an entry asks of them.
/// </summary>
public sealed class HostedEntryProfileIncompleteException()
    : Exception("This competition needs a name, a graduation year and an email address");

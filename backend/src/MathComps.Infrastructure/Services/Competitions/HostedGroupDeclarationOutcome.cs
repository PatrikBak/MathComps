namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// What declaring a group from its manifest did.
/// </summary>
/// <param name="GroupId">The group that now stands under the manifest's slug.</param>
/// <param name="Created">Whether the group was created rather than updated.</param>
/// <param name="RoundsLinked">How many rounds the group now runs.</param>
/// <param name="ProblemCount"><inheritdoc cref="Domain.EfCoreEntities.HostedGroup.ProblemCount" path="/summary"/></param>
/// <param name="RoundsAwaitingProblems">How many of those rounds are still empty.</param>
public record HostedGroupDeclarationOutcome(
    Guid GroupId, bool Created, int RoundsLinked, int ProblemCount, int RoundsAwaitingProblems);

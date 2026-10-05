using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Seeds the site's own competitions: the groups it runs, their rounds and problems, the students entering them, and
/// the conversations they hold about the problems.
/// </summary>
public static class HostedSeed
{
    /// <summary>
    /// How long a seeded group's clock runs.
    /// </summary>
    private const int ClockMinutes = 180;

    /// <summary>
    /// Builds one user, every field derived from their username.
    /// </summary>
    /// <param name="userId">The user's id.</param>
    /// <param name="username">The user's username.</param>
    /// <returns>The user.</returns>
    public static User NewUser(Guid userId, string username) => new()
    {
        Id = userId,
        ExternalId = $"ext-{username}",
        Username = username,
        Email = $"{username.ToLowerInvariant()}@example.com",
    };

    /// <summary>
    /// Builds one sat entry whose clock was never handed in.
    /// </summary>
    /// <param name="userId">The student.</param>
    /// <param name="roundId">The round entered.</param>
    /// <param name="startedAt"><inheritdoc cref="HostedEntry.StartedAt" path="/summary"/></param>
    /// <returns>The entry.</returns>
    public static HostedEntry NewEntry(Guid userId, Guid roundId, DateTimeOffset startedAt) => new()
    {
        UserId = userId,
        RoundId = roundId,
        StartedAt = startedAt,
    };

    /// <summary>
    /// Builds one version of a grade, with nothing written for the other graders.
    /// </summary>
    /// <param name="entryId"><inheritdoc cref="HostedGrade.EntryId" path="/summary"/></param>
    /// <param name="problemId"><inheritdoc cref="HostedGrade.ProblemId" path="/summary"/></param>
    /// <param name="authorId"><inheritdoc cref="HostedGrade.AuthorId" path="/summary"/></param>
    /// <param name="mark">The mark the work earns on its competition's scale, however much the examiner helped.</param>
    /// <param name="help"><inheritdoc cref="HostedGrade.Help" path="/summary"/></param>
    /// <param name="isFinal"><inheritdoc cref="HostedGrade.IsFinal" path="/summary"/></param>
    /// <param name="createdAt"><inheritdoc cref="HostedGrade.CreatedAt" path="/summary"/></param>
    /// <returns>The version.</returns>
    public static HostedGrade NewGrade(
        Guid entryId, Guid problemId, Guid authorId, int mark, int help, bool isFinal, DateTimeOffset createdAt) =>
        new()
        {
            EntryId = entryId,
            ProblemId = problemId,
            Mark = mark,
            Help = help,
            InternalComment = string.Empty,
            IsFinal = isFinal,
            AuthorId = authorId,
            CreatedAt = createdAt,
        };

    /// <summary>
    /// Tracks one hosted group of two problems per round, which lets students re-enter only while it never closes.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="slug">What addresses the group.</param>
    /// <param name="opensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
    /// <param name="closesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <returns>The tracked group.</returns>
    public static HostedGroup NewGroup(
        MathCompsDbContext context, string slug, DateTimeOffset opensAt, DateTimeOffset? closesAt)
    {
        // The group row
        var group = new HostedGroup
        {
            Id = Guid.CreateVersion7(),
            Slug = slug,
            OpensAt = opensAt,
            ClosesAt = closesAt,
            ClockMinutes = ClockMinutes,
            AllowsReentry = closesAt is null,
            ProblemCount = 2,
        };
        context.HostedGroups.Add(group);

        // The tracked group
        return group;
    }

    /// <summary>
    /// Tracks one round of a group with its problems, numbered in the order given.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season the round sits in.</param>
    /// <param name="group">The group it runs in.</param>
    /// <param name="roundId">The round's id.</param>
    /// <param name="competitionPath">The path of the competition it hangs under, which says its level.</param>
    /// <param name="problemIds">Its problems' ids, in order.</param>
    public static void NewRound(
        MathCompsDbContext context, Season season, HostedGroup group, Guid roundId, string competitionPath,
        params Guid[] problemIds)
    {
        // The round, under the deepest node its path names
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, competitionPath).Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 9, 15),
            VisibleSince = group.ClosesAt,
            HostedGroupId = group.Id,
        });

        // Its problems
        for (var index = 0; index < problemIds.Length; index += 1)
            context.Problems.Add(new Problem
            {
                Id = problemIds[index],
                RoundId = roundId,
                Number = index + 1,
                Slug = $"{competitionPath}-{index + 1}",
            });
    }

    /// <summary>
    /// Tracks one conversation about one problem.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="sessionId">The conversation's id.</param>
    /// <param name="userId">The student holding it.</param>
    /// <param name="problemId">The problem it is about.</param>
    /// <param name="createdAt">When it started.</param>
    public static void NewConversation(
        MathCompsDbContext context, Guid sessionId, Guid userId, Guid problemId, DateTimeOffset createdAt)
    {
        // The session, stamped with the kind its target row is allowed to attach to
        context.DefenseSessions.Add(new DefenseSession
        {
            Id = sessionId,
            UserId = userId,
            TargetKind = DefenseTargetKind.Problem,
            ProblemStatement = "Statement",
            ProblemReference = "Reference",
            ExaminerConfig = "{}",
            CreatedAt = createdAt,
        });

        // What it is about
        context.ProblemDefenses.Add(new ProblemDefense { DefenseSessionId = sessionId, ProblemId = problemId });

        // And the student's opening line
        NewTurn(context, sessionId, 0, TranscriptRole.Candidate, createdAt);
    }

    /// <summary>
    /// Tracks one line of a conversation.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="sessionId">The conversation.</param>
    /// <param name="sequence"><inheritdoc cref="DefenseTurn.Sequence" path="/summary"/></param>
    /// <param name="role"><inheritdoc cref="DefenseTurn.Role" path="/summary"/></param>
    /// <param name="createdAt"><inheritdoc cref="DefenseTurn.CreatedAt" path="/summary"/></param>
    public static void NewTurn(
        MathCompsDbContext context, Guid sessionId, int sequence, TranscriptRole role, DateTimeOffset createdAt) =>
        // The line, saying nothing anybody reads
        context.DefenseTurns.Add(new DefenseTurn
        {
            Id = Guid.CreateVersion7(),
            SessionId = sessionId,
            Role = role,
            Content = "line",
            Sequence = sequence,
            CreatedAt = createdAt,
        });
}

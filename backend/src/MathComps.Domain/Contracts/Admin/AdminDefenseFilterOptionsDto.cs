namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// What the review queue's filters can be set to. Counts are over every conversation rather than over whatever the
/// other filters currently leave.
/// </summary>
/// <param name="Users">Everyone who has held a conversation.</param>
/// <param name="Problems">Every problem one has been held against.</param>
/// <param name="PromptVersions">Every set of examiner settings one has run on.</param>
public record AdminDefenseFilterOptionsDto(
    IReadOnlyList<AdminDefenseUserOptionDto> Users,
    IReadOnlyList<AdminDefenseProblemOptionDto> Problems,
    IReadOnlyList<AdminDefensePromptVersionOptionDto> PromptVersions);

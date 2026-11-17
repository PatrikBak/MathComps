using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// The cycle a board was finalized into.
/// </summary>
/// <param name="CycleName">The cycle's name, in the language the selection is read in.</param>
/// <param name="OpensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
/// <param name="HasOpened">Whether the cycle has opened to students.</param>
public record BoardFinalizationDto(string CycleName, DateTimeOffset OpensAt, bool HasOpened);

using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// Request for links to photos the caller took for a defense and has not sent yet.
/// </summary>
/// <param name="PhotoIds">The photos' ids, null when the request sent null.</param>
public record GetDefensePhotoLinksRequest(ImmutableList<Guid>? PhotoIds);

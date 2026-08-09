using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A request to revise a note. It replaces what the note says rather than adding to it, so both fields stand for
/// the note's whole new state and clearing the category means passing null rather than leaving it out.
/// </summary>
/// <param name="Content">What the note should now say (markdown), null when the request omitted it.</param>
/// <param name="Category">Which failure it should now name, or null to name none.</param>
public record UpdateAdminNoteRequest(string? Content, DefenseReportCategory? Category);

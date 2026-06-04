namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// The minimum a draft problem contributes to the read-only preview: its position (to derive the slug) and
/// whether it carries a solution (to know whether the preview must check the <c>Solution</c> document type as
/// well as the always-present <c>Statement</c>).
/// </summary>
/// <param name="Order">1-based position within the round, taken from the <c>pN.md</c> filename.</param>
/// <param name="HasSolution">Whether the draft supplies a solution half for this problem.</param>
public record DraftProblemRef(int Order, bool HasSolution);

using System.Collections.Immutable;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// One language variant a draft problem contributes to the read-only preview: its language, whether it is the
/// original, and whether it carries a solution (so the preview knows to classify the <c>Solution</c> document
/// type as well as the always-present <c>Statement</c>).
/// </summary>
/// <param name="Language">The text's language.</param>
/// <param name="Original">Whether this text is the original (<c>true</c>) or a translation (<c>false</c>).</param>
/// <param name="HasSolution">Whether this text supplies a solution half.</param>
public record DraftTextRef(Language Language, bool Original, bool HasSolution);

/// <summary>
/// The minimum a draft problem contributes to the read-only preview: its position (to derive the slug) and its
/// per-language text variants (the original plus any translations).
/// </summary>
/// <param name="Order">1-based position within the round, taken from the filenames.</param>
/// <param name="Texts">The text variants this problem would import.</param>
public record DraftProblemRef(int Order, ImmutableArray<DraftTextRef> Texts);

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Extension members for <see cref="DocumentType"/>.
/// </summary>
public static class DocumentTypeExtensions
{
    extension(DocumentType documentType)
    {
        /// <summary>
        /// Whether a problem keeps the document once per language, an original plus its translations. A document kept
        /// once per problem has a single text, in whichever language it was written, and it is that problem's
        /// original.
        /// </summary>
        public bool HasLanguageVariants => documentType switch
        {
            DocumentType.Statement or DocumentType.Solution or DocumentType.Hints => true,
            DocumentType.GradingNote => false,
            _ => throw new ArgumentOutOfRangeException(nameof(documentType), documentType, "Unknown document type.")
        };
    }
}

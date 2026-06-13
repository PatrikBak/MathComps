namespace MathComps.Domain.Constants;

/// <summary>
/// Shared constants related to vector embeddings.
/// </summary>
public static class EmbeddingConstants
{
    /// <summary>
    /// Target dimensionality for problem embeddings.
    /// </summary>
    public const int VectorDimensions = 1536;

    /// <summary>
    /// Database column type for storing embeddings.
    /// </summary>
    public const string VectorColumnType = "vector(1536)";

    /// <summary>
    /// Well-known task types used when generating embeddings.
    /// </summary>
    public static class Types
    {
        /// <summary>
        /// Task type optimized for **search queries**.
        /// Use this for the single problem (the "query") you are pasting in to find similar entries.
        /// </summary>
        public const string RetrievalQuery = "RETRIEVAL_QUERY";

        /// <summary>
        /// Task type optimized for **documents to be retrieved** from a database.
        /// Use this for all the problems in your database (the "documents") that you are searching against.
        /// </summary>
        public const string RetrievalDocument = "RETRIEVAL_DOCUMENT";
    }
}

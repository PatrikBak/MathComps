using MathComps.Cli.Similarity.Dtos;
using MathComps.Cli.Similarity.Settings;
using MathComps.Domain;
using MathComps.Domain.Constants;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pgvector.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// <para>
/// A service for calculating similarity scores between math problems.
/// </para>
/// <para>
/// The process involves two main stages: candidate retrieval and weighted scoring.
/// </para>
/// <list type="number">
/// <item>
/// <term>Candidate Retrieval</term>
/// <description>
/// A set of candidate problems is selected from the database using a series of hard filters. This ensures
/// that only relevant problems are considered for scoring, making the process efficient. The filters are:
/// <list type="bullet">
/// <item><term>Competition Clustering</term><description>Only problems from competitions in a similar "cluster" are considered.
/// Clusters are defined in settings, with the intention of grouping competitions by difficulty.</description></item>
/// <item><term>Tag Overlap</term><description>Candidates must share at least one tag with the source problem.</description></item>
/// <item><term>Semantic Similarity Threshold</term><description>Candidates must meet a minimum semantic similarity score for their
/// problem statements (and solutions, if available).</description></item>
/// </list>
/// </description>
/// </item>
/// <item>
/// <term>Weighted Scoring</term>
/// <description>
/// The retrieved candidates are then scored using a weighted combination of several similarity signals:
/// <list type="bullet">
/// <item><term>Statement Similarity</term><description>Based on the cosine distance of statement embeddings.</description></item>
/// <item><term>Solution Similarity</term><description>Based on the cosine distance of solution embeddings (if available).</description></item>
/// <item><term>Tag Similarity</term><description>Based on the Jaccard index of shared tags.</description></item>
/// <item><term>Competition Similarity</term><description>A score that decreases as the distance between competition clusters increases.</description></item>
/// </list>
/// </description>
/// </item>
/// </list>
/// <para>
/// The final output is a ranked list of similar problems with their composite scores.
/// </para>
/// </summary>
/// <param name="dbContextFactory">Factory for creating database contexts with proper configuration and connection management.</param>
/// <param name="settings">Configuration settings injected through IOptions pattern for similarity calculation parameters.</param>
public class ProblemSimilarityService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOptions<SimilarityCalculationSettings> settings) : IProblemSimilarityService
{
    /// <inheritdoc/>
    public async Task<IReadOnlyList<SimilarityResult>> CalculateProblemSimilaritiesAsync(
        ProblemSimilarityData sourceProblemData,
        CancellationToken cancellationToken = default)
    {
        // Gain DB access
        await using var context = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // First, we identify competitions that are "similar" to the source problem's competition.
        // This is done by clustering competitions and selecting those within a certain tolerance.
        // Every competition that is used in the database must be present in the cluster map.
        if (!settings.Value.CompetitionClusterMap.TryGetValue(sourceProblemData.CompetitionClusteringKey, out var sourceClusterId))
            throw new InvalidOperationException($"Competition clustering key '{sourceProblemData.CompetitionClusteringKey}' not found in CompetitionClusterMap.");

        // Identify all slugs that belong to the relevant competition clusters.
        var relevantCompetitionSlug = settings.Value.CompetitionClusterMap
            .Where(pair => Math.Abs(pair.Value - sourceClusterId) <= settings.Value.CompetitionTolerance)
            .Select(pair => pair.Key)
            .ToList();

        // Construct a query to find candidate problems based on a set of criteria.
        // We need to join with ProblemEmbeddings to access the embeddings
        var candidatesQuery =
            from problem in context.Problems
            from embedding in context.ProblemEmbeddings
                // Exclude the current problem
            where problem.Id != sourceProblemData.ProblemId
                // We need problem embeddings suitable suitable to be compared to
                && embedding.DocumentType == DocumentType.ProblemStatement
                && embedding.EmbeddingType == EmbeddingConstants.Types.RetrievalDocument
                // The candidate must be from a relevant competition.
                && relevantCompetitionSlug.Contains(problem.RoundInstance.Round.CompositeSlug)
                // The candidate must have at least one tag in common with the source problem
                && problem.ProblemTagsAll.AsQueryable()
                    .Where(ProblemTag.IsGoodEnoughTag)
                    .Any(problemTag => sourceProblemData.TagsIds.Contains(problemTag.TagId))
                // The candidate's statement must be semantically similar to the source problem's statement
                && embedding.Embedding.CosineDistance(sourceProblemData.StatementEmbedding) <= (1 - settings.Value.MinimalSimilarity)
            select new
            {
                Problem = problem,
                StatementEmbedding = embedding.Embedding
            };

        // If the source problem has a solution...
        if (sourceProblemData.SolutionEmbedding != null)
        {
            // Filter by solution similarity too
            candidatesQuery =
                from candidate in candidatesQuery
                let solutionEmbedding = candidate.Problem.Embeddings
                    .FirstOrDefault(embedding =>
                        embedding.DocumentType == DocumentType.ProblemWithSolution &&
                        embedding.EmbeddingType == EmbeddingConstants.Types.RetrievalDocument)
                // Either no solution, or similar enough
                where solutionEmbedding == null ||
                      solutionEmbedding.Embedding.CosineDistance(sourceProblemData.SolutionEmbedding) <= (1 - settings.Value.MinimalSimilarity)
                select candidate;
        }

        // Now we need to connect the candidate data with solution embeddings, if they exist
        var candidatesWithSolutionEmb =
            from candidate in candidatesQuery
            let solutionEmbedding = candidate.Problem.Embeddings
                .Where(embedding =>
                    embedding.DocumentType == DocumentType.ProblemWithSolution &&
                    embedding.EmbeddingType == EmbeddingConstants.Types.RetrievalDocument)
                .Select(embedding => embedding.Embedding)
                .FirstOrDefault()
            select new
            {
                candidate.Problem,
                candidate.StatementEmbedding,
                SolutionEmbedding = solutionEmbedding
            };

        // Now we can actually order candidates
        return [.. (await candidatesWithSolutionEmb
            // ...by statement similarity
            .OrderBy(candidate => candidate.StatementEmbedding.CosineDistance(sourceProblemData.StatementEmbedding))
            // ...and take the top N according to the settings
            .Take(settings.Value.TotalCandidateLimit)
            // Retrieve the relevant data
            .Select(candidate => new
            {
                // The problem's id,
                candidate.Problem.Id,

                // Statement distance
                StatementDistance = (double)candidate.StatementEmbedding.CosineDistance(sourceProblemData.StatementEmbedding),

                // Solution distance, if both problems have it
                SolutionDistance = candidate.SolutionEmbedding != null && sourceProblemData.SolutionEmbedding != null
                    ? (double?)candidate.SolutionEmbedding.CosineDistance(sourceProblemData.SolutionEmbedding)
                    : null,

                // Tags
                TagIds = candidate.Problem.ProblemTagsAll.AsQueryable()
                    // Only good enough tags
                    .Where(ProblemTag.IsGoodEnoughTag)
                    // Get their ids
                    .Select(problemTag => problemTag.TagId)
                    // In a set
                    .ToImmutableHashSet(),

                // The 'competition-category-round' slug
                Slug = candidate.Problem.RoundInstance.Round.CompositeSlug,
            })
            // Evaluate
            .ToListAsync(cancellationToken))
            // Now we can do in-memory similarity calculation
            .Select(candidateData =>
            {
                // The statement similarity
                var statementSimilarity = 1 - candidateData.StatementDistance;

                // The solution similarity
                var solutionSimilarity = candidateData.SolutionDistance is null ? null : 1 - candidateData.SolutionDistance;

                // The tag similarity (Jaccard)
                var tagSimilarity =
                    // The number of common tags
                    1d * candidateData.TagIds.Intersect(sourceProblemData.TagsIds).Count
                    // Divided by the number of all their tags altogether
                    / candidateData.TagIds.Union(sourceProblemData.TagsIds).Count;

                // The competition similarity
                var competitionSimilarity = 1 - (Math.Abs(
                        // Basically the opposite of the 'distance' in the map
                        settings.Value.CompetitionClusterMap[sourceProblemData.CompetitionClusteringKey] -
                        settings.Value.CompetitionClusterMap[candidateData.Slug]
                    )
                    // Nees to be normalized by the maximal distance
                    / settings.Value.CompetitionTolerance);

                // These four values make up all components
                var components = new SimilarityComponents(
                    statementSimilarity,
                    solutionSimilarity,
                    tagSimilarity,
                    competitionSimilarity);

                // Get the final score
                var finalSimilarity = CalculateWeightedSimilarityScore(settings.Value.SimilarityWeights, components);

                // We're happy
                return new SimilarityResult(candidateData.Id, candidateData.Slug, finalSimilarity, components);
            })
            // In the end, the results should be ordered from the most similar
            .OrderByDescending(result => result.SimilarityScore),];
    }

    /// <summary>
    /// Calculates the final weighted similarity score from individual component similarities.
    /// Handles weight redustribution and normalizing the result.
    /// </summary>
    /// <param name="weights">Configured weights for each similarity component.</param>
    /// <param name="components">The individual similarity components</param>
    /// <returns>Final weighted similarity score between 0 and 1.</returns>
    private static double CalculateWeightedSimilarityScore(SimilarityWeights weights, SimilarityComponents components)
    {
        // Calculate total configured weight for normalization.
        var totalWeight =
            weights.StatementSimilarity +
            weights.SolutionSimilarity +
            weights.TagSimilarity +
            weights.CompetitionSimilarity;

        // This is sad
        if (totalWeight <= 0)
            throw new InvalidOperationException($"The total weight sum should not be <= 0, it is {totalWeight}");

        // When we have all components, it's simple
        if (components.SolutionSimilarity is not null)
        {
            // Just a linear combination and normalization
            return (
                (weights.StatementSimilarity * components.StatementSimilarity) +
                (weights.SolutionSimilarity * components.SolutionSimilarity.Value) +
                (weights.TagSimilarity * components.TagSimilarity) +
                (weights.CompetitionSimilarity * components.CompetitionSimilarity)
                )
                // Normalized
                / totalWeight;
        }

        // When solution similarity is not available, we calculate the score based on the other components.

        // We adjust the total weight to normalize the score correctly.
        var adjustedTotalWeight = totalWeight - weights.SolutionSimilarity;

        // This would be very sads
        if (adjustedTotalWeight <= 0)
            throw new InvalidOperationException($"The total weight sum of non-solution weight should not be <= 0, it is {adjustedTotalWeight}");

        // Find the score without adjusting
        return (
            (weights.StatementSimilarity * components.StatementSimilarity) +
            (weights.TagSimilarity * components.TagSimilarity) +
            (weights.CompetitionSimilarity * components.CompetitionSimilarity)
            )
            // Re-normalize to a full score
            / adjustedTotalWeight;
    }
}

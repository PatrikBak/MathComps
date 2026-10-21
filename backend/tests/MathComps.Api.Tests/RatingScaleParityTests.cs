using MathComps.Domain.EfCoreEntities;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the web and its e2e fake hold a proposal rating to the backend's scale: its lowest score, its
/// highest, and the steps one whole score is cut into.
/// </summary>
/// <remarks>
/// The scale lives three times on purpose: the score bar moves a score along it as it is being set, the fake
/// refuses what the backend refuses without importing the app's copy, and neither can read a C# constant. Drift is
/// the failure that matters, because a score the bar offers is then refused with the bar still showing it, and a
/// fake drifting with the app lets every e2e test over it pass.
/// </remarks>
public class RatingScaleParityTests
{
    /// <summary>
    /// The web's module holding the rating scale.
    /// </summary>
    private static string RatingScalePath => RepoPaths.Resolve(
        "web", "src", "components", "features", "problem-selection", "model", "rating-scale.ts");

    /// <summary>
    /// The e2e fake answering a proposal's writes.
    /// </summary>
    private static string ProposalWritesFakePath =>
        RepoPaths.Resolve("web", "e2e", "support", "selection-proposal-writes.ts");

    /// <summary>
    /// The web's scale is the backend's.
    /// </summary>
    [Fact]
    public void Ts_scale_matches_the_backend() =>
        // The web scale's ends and its steps per score are the backend's
        AssertScaleMatches(RatingScalePath);

    /// <summary>
    /// The e2e fake's scale is the backend's.
    /// </summary>
    [Fact]
    public void E2e_fake_scale_matches_the_backend() =>
        // The fake refuses exactly the scores the backend refuses
        AssertScaleMatches(ProposalWritesFakePath);

    /// <summary>
    /// Asserts that a web module declares the backend's rating scale.
    /// </summary>
    /// <param name="path">The module.</param>
    private static void AssertScaleMatches(string path)
    {
        // The lowest score
        Assert.Equal(ProposalRating.MinScore.ToString(), WebSource.ReadConstant(path, "MIN_SCORE"));

        // The highest score
        Assert.Equal(ProposalRating.MaxScore.ToString(), WebSource.ReadConstant(path, "MAX_SCORE"));

        // And the steps one whole score is cut into
        Assert.Equal(ProposalRating.StepsPerPoint.ToString(), WebSource.ReadConstant(path, "STEPS_PER_POINT"));
    }
}

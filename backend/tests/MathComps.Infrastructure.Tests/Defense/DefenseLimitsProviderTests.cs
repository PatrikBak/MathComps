using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Defense;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Tests <see cref="DefenseLimitsProvider"/>: every cap a caller is told is the one configured.
/// </summary>
public class DefenseLimitsProviderTests
{
    /// <summary>
    /// Each cap lands in its own field. They are all ints, so the values are kept distinct: caps handed over in the
    /// wrong order would otherwise sail past.
    /// </summary>
    [Fact]
    public void Every_cap_comes_back_as_configured()
    {
        // The defense's caps
        var defenseLimits = new DefenseLimits
        {
            MaxCandidateChars = 100,
            MaxFeedbackCommentChars = 50,
            MaxMessagesPerDefense = 2,
            MaxPhotosPerMessage = 3,
            DailySpendCeilingPerUser = 1.00m,
        };

        // The caps a caller is told
        var limits = new DefenseLimitsProvider(MsOptions.Create(defenseLimits)).Limits;

        // Every cap as configured
        Assert.Equal(100, limits.MaxCandidateChars);
        Assert.Equal(50, limits.MaxFeedbackCommentChars);
        Assert.Equal(2, limits.MaxMessagesPerDefense);
        Assert.Equal(3, limits.MaxPhotosPerMessage);
    }
}

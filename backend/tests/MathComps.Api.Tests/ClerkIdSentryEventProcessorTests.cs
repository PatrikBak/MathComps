using MathComps.Api.Extensions;
using Microsoft.AspNetCore.Http;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers <see cref="ClerkIdSentryEventProcessor"/>. A student's error goes to a third party, so anything beyond the
/// id riding along would send their account details out with every fault, while every page went on working.
/// </summary>
public class ClerkIdSentryEventProcessorTests
{
    /// <summary>
    /// An error a signed-in student's request reports names them by their Clerk id, and carries nothing else about
    /// them.
    /// </summary>
    [Fact]
    public void A_signed_in_callers_error_carries_their_Clerk_id_alone()
    {
        // A request from a signed-in student
        var request = new DefaultHttpContext { User = TestCallers.SignedIn("ext-student", isAdmin: false) };

        // The processor reading that request
        var processor = new ClerkIdSentryEventProcessor(new HttpContextAccessor { HttpContext = request });

        // An error the request reports, passed through the processor
        var processed = processor.Process(new SentryEvent());

        // The student's id, and no name, address or IP beside it
        Assert.Equal("ext-student", processed.User.Id);
        Assert.Null(processed.User.Username);
        Assert.Null(processed.User.Email);
        Assert.Null(processed.User.IpAddress);
    }
}

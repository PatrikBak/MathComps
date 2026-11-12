using MathComps.Api.Extensions;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Defense;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers who a phone's handoff routes act for, as the request log and error reports read it. A phone carries no
/// sign-in, so with nobody named, many phones failing in the same minute leave no way to tell whose failure was
/// whose. The code itself is the phone's only key, so it must never ride along.
/// </summary>
public class DefensePhotoHandoffEndpointsTests
{
    /// <summary>
    /// The code every phone here sends.
    /// </summary>
    private const string Code = "0123456789abcdef0123456789abcdef";

    /// <summary>
    /// The Clerk id of the student the code belongs to.
    /// </summary>
    private const string StudentClerkId = "ext-student";

    /// <summary>
    /// A request sent by a working code that then fails, on each route a phone calls, names the code's student on its
    /// request line and its error, by their Clerk id and nothing else.
    /// </summary>
    [Fact]
    public async Task A_phones_failing_request_names_its_codes_student_alone()
    {
        // A fault in the route's work, such as a photo failing to be read
        var fault = new InvalidOperationException();

        // Each phone route sent the code, which finds the student before the route hits the fault
        foreach (var request in await SendFromPhoneAsync(StudentClerkId, fault))
        {
            // The failure's error names the student
            Assert.Equal(StudentClerkId, ErrorOf(request).User.Id);

            // The request's line, once the response is written
            var line = await LogLineOfAsync(request);

            // The student's id is all the line adds, so the code stays off it
            Assert.Equal([new KeyValuePair<string, object?>("ClerkId", StudentClerkId)], line.Parameters);
        }
    }

    /// <summary>
    /// A request sent by a code that finds no student, being unknown or run out, names nobody.
    /// </summary>
    [Fact]
    public async Task A_phones_request_by_a_code_finding_no_student_names_nobody()
    {
        // The refusal a code finding nobody gets
        var refusal = new DefensePhotoHandoffNotFoundException();

        // Each phone route sent the code, which finds nobody and is refused
        foreach (var request in await SendFromPhoneAsync(studentClerkId: null, refusal))
        {
            // An error the request reports keeps the user the SDK gave it, naming nobody
            Assert.Null(ErrorOf(request).User.Id);

            // The request's line, once the response is written
            var line = await LogLineOfAsync(request);

            // Adds nothing
            Assert.Empty(line.Parameters);
        }
    }

    /// <summary>
    /// Sends <see cref="Code"/> through each route a phone calls, with the code finding a student or nobody, and the
    /// route's work then failing.
    /// </summary>
    /// <param name="studentClerkId">The Clerk id of the student the code finds, or null when it finds nobody.</param>
    /// <param name="failure">What the route's work fails with once the code is read.</param>
    /// <returns>The requests, once each route has failed.</returns>
    private static async Task<IReadOnlyList<HttpContext>> SendFromPhoneAsync(string? studentClerkId, Exception failure)
    {
        // The API's routes, mapped
        var mapped = MappedApi.Build();

        // The handoff service, finding the student the code belongs to
        var handoffService = Mock.Get(mapped.Services.GetRequiredService<IDefensePhotoHandoffService>());
        handoffService
            .Setup(service => service.FindStudentAsync(Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync(studentClerkId);

        // The check, failing
        handoffService
            .Setup(service => service.CheckAsync(Code, It.IsAny<Language>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(failure);

        // The send, failing
        handoffService
            .Setup(service => service.SendAsync(
                Code, It.IsAny<DateTimeOffset>(), It.IsAny<Stream>(), It.IsAny<Language>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(failure);

        // Each route a phone calls, with the query it sends
        (string Method, string Pattern, string Query)[] routes =
        [
            (HttpMethods.Get, "/defense/photos/handoff", ""),
            (HttpMethods.Post, "/defense/photos/handoff/photos", "?capturedAt=2026-11-12T10:00:00Z"),
        ];

        // The requests sent so far
        List<HttpContext> requests = [];

        // Each route in turn
        foreach (var (method, pattern, query) in routes)
        {
            // A request from a phone with no sign-in, carrying the code
            var request = new DefaultHttpContext
            {
                RequestServices = mapped.Services,
                Request =
                {
                    QueryString = new QueryString(query),
                    Headers = { Authorization = $"PhotoHandoff {Code}" },
                    Body = new MemoryStream([1, 2, 3]),
                },
            };

            // Sent through the route
            var thrown = await Record.ExceptionAsync(() => mapped.Route(method, pattern).RequestDelegate!(request));

            // Which reached the failing work, past the code
            Assert.Same(failure, thrown);

            // Kept for its asserts
            requests.Add(request);
        }

        // Every request, failed
        return requests;
    }

    /// <summary>
    /// Runs an error a request reports through the error reports' processor.
    /// </summary>
    /// <param name="request">The request, once its route has failed.</param>
    /// <returns>The error, as it leaves.</returns>
    private static SentryEvent ErrorOf(HttpContext request) =>
        // A fresh error, passed through the processor reading the request
        new ClerkIdSentryEventProcessor(new HttpContextAccessor { HttpContext = request }).Process(new SentryEvent());

    /// <summary>
    /// Runs a request through the request log's interceptor, as its response is written.
    /// </summary>
    /// <param name="request">The request, once its route has failed.</param>
    /// <returns>The request's log line, holding what the interceptor added.</returns>
    private static async Task<HttpLoggingInterceptorContext> LogLineOfAsync(HttpContext request)
    {
        // The line the request logs
        var line = new HttpLoggingInterceptorContext { HttpContext = request };

        // Passed through the interceptor once the response is written
        await new ClerkIdHttpLoggingInterceptor().OnResponseAsync(line);

        // The line
        return line;
    }
}

using System.Globalization;
using System.Net;
using System.Net.Sockets;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A stand-in for a chat endpoint that takes every connection on a loopback port and never answers on it. The chat
/// caller is registered against it the way the hosts register theirs, so its SDK client is configured as production's
/// is. The caller retries failures, and each attempt opens a connection of its own.
/// </summary>
public sealed class SilentChatEndpoint : IAsyncDisposable
{
    /// <summary>
    /// The port the caller connects to.
    /// </summary>
    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);

    /// <summary>
    /// Every connection taken so far, held open so the caller keeps waiting on each.
    /// </summary>
    private readonly List<TcpClient> _connections = [];

    /// <summary>
    /// Guards <see cref="_connections"/>, which the accepting loop adds to while a test reads it.
    /// </summary>
    private readonly Lock _gate = new();

    /// <summary>
    /// Completes once the first connection is taken.
    /// </summary>
    private readonly TaskCompletionSource _firstConnection = new(TaskCreationOptions.RunContinuationsAsynchronously);

    /// <summary>
    /// The endpoint's shutdown signal, cancelled as its disposal begins.
    /// </summary>
    private readonly CancellationTokenSource _shutdown = new();

    /// <summary>
    /// The loop taking connections until the endpoint is disposed.
    /// </summary>
    private readonly Task _accepting;

    /// <summary>
    /// The registration the caller comes from.
    /// </summary>
    private readonly ServiceProvider _provider;

    /// <summary>
    /// Opens the port and registers the chat caller against it, with retries on.
    /// </summary>
    /// <param name="requestTimeout"><inheritdoc cref="LlmSettings.RequestTimeout" path="/summary"/></param>
    public SilentChatEndpoint(TimeSpan requestTimeout)
    {
        // Open the port.
        _listener.Start();

        // Take every connection that arrives from here on.
        _accepting = AcceptAsync();

        // The connection settings, pointed at the port, with retries on so a retried attempt shows as a second
        // connection.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Llm:BaseUrl"] = $"http://{_listener.LocalEndpoint}/v3",
                ["Llm:ApiKey"] = "test-key",
                ["Llm:MaxRetries"] = "2",
                ["Llm:RetryDelay"] = "00:00:00",
                ["Llm:RequestTimeout"] = requestTimeout.ToString("c", CultureInfo.InvariantCulture),
            })
            .Build();

        // The chat stack as the hosts register it.
        _provider = new ServiceCollection().AddLlmChat(configuration).BuildServiceProvider();

        // The caller out of it.
        Caller = _provider.GetRequiredService<ILlmChatCaller>();
    }

    /// <summary>
    /// The caller whose requests reach this endpoint.
    /// </summary>
    public ILlmChatCaller Caller { get; }

    /// <summary>
    /// How many connections the caller has opened, one per attempt. Read it once <see cref="FirstConnection"/>
    /// completes.
    /// </summary>
    public int Connections
    {
        get
        {
            // The count of connections taken so far.
            lock (_gate)
                return _connections.Count;
        }
    }

    /// <summary>
    /// Completes once the caller's first connection is taken. Under load that can be after the call has ended. The
    /// request timeout also covers opening the connection, and HttpClient goes on opening it after the request is
    /// cancelled.
    /// </summary>
    public Task FirstConnection => _firstConnection.Task;

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        // Tell the accepting loop to stop taking connections.
        await _shutdown.CancelAsync();

        // Wait for the loop to end, since the loop may ask the port for a connection until then.
        await _accepting;

        // Close the port.
        _listener.Stop();

        // Drop every connection taken.
        lock (_gate)
            _connections.ForEach(connection => connection.Dispose());

        // Shut down the chat stack registered for the test.
        await _provider.DisposeAsync();

        // Release the shutdown signal.
        _shutdown.Dispose();
    }

    /// <summary>
    /// Takes connections until the endpoint is disposed.
    /// </summary>
    /// <returns>A task that completes once the endpoint's disposal begins.</returns>
    private async Task AcceptAsync()
    {
        // Take connections until disposing the endpoint ends the wait.
        try
        {
            // One connection at a time, for as long as the endpoint lives.
            while (true)
            {
                // The next connection the caller opens.
                var connection = await _listener.AcceptTcpClientAsync(_shutdown.Token);

                // Hold it, never reading or answering.
                lock (_gate)
                    _connections.Add(connection);

                // Mark the first connection as taken.
                _firstConnection.TrySetResult();
            }
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
        {
            // The endpoint is being disposed.
        }
    }
}

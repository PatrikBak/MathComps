using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Shared.Cli;

/// <summary>
/// A generic wrapper that defers service resolution until <see cref="Lazy{T}.Value"/>
/// is first accessed.
/// </summary>
/// <typeparam name="T">The service type to resolve lazily.</typeparam>
/// <param name="serviceProvider">The <see cref="IServiceProvider"/> used to resolve <typeparamref name="T"/>.</param>
public class LazyService<T>(IServiceProvider serviceProvider)
    : Lazy<T>(serviceProvider.GetRequiredService<T>) where T : class;

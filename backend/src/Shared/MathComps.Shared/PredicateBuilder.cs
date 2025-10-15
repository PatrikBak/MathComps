using System.Linq.Expressions;

namespace MathComps.Shared;

/// <summary>
/// A helper class allowing to glue boolean expressions together using 'or' and 'and' conjunctions.
/// </summary>
public static class PredicateBuilder
{
    /// <summary>
    /// Returns the expression returning 'true'.
    /// </summary>
    /// <typeparam name="T">The type of the lambda argument.</typeparam>
    /// <returns>The expression '_ => true'</returns>
    public static Expression<Func<T, bool>> True<T>() => _ => true;

    /// <summary>
    /// Returns the expression returning 'false'.
    /// </summary>
    /// <typeparam name="T">The type of the lambda argument.</typeparam>
    /// <returns>The expression '_ => false'</returns>
    public static Expression<Func<T, bool>> False<T>() => _ => false;

    /// <summary>
    /// Glues the two passed boolean expressions using the 'or' conjunction.
    /// </summary>
    /// <typeparam name="T">The type of the lambda argument.</typeparam>
    /// <param name="expression1">The first expression.</param>
    /// <param name="expression2">The second expression.</param>
    /// <returns>If the two expressions are 'x => c1' and 'x => c2', then the result is 'x => c1 || c2'</returns>
    public static Expression<Func<T, bool>> Or<T>(this Expression<Func<T, bool>> expression1, Expression<Func<T, bool>> expression2)
        // This code just works, I've used it for years
        => Expression.Lambda<Func<T, bool>>(Expression.OrElse(expression1.Body, Expression.Invoke(expression2, expression1.Parameters.Cast<Expression>())), expression1.Parameters);

    /// <summary>
    /// Glues the two passed boolean expressions using the 'and' conjunction.
    /// </summary>
    /// <typeparam name="T">The type of the lambda argument.</typeparam>
    /// <param name="expression1">The first expression.</param>
    /// <param name="expression2">The second expression.</param>
    /// <returns>If the two expressions are 'x => c1' and 'x => c2', then the result is 'x => c1 && c2'</returns>
    public static Expression<Func<T, bool>> And<T>(this Expression<Func<T, bool>> expression1, Expression<Func<T, bool>> expression2)
        // This code just works, I've used it for years
        => Expression.Lambda<Func<T, bool>>(Expression.AndAlso(expression1.Body, Expression.Invoke(expression2, expression1.Parameters.Cast<Expression>())), expression1.Parameters);
}

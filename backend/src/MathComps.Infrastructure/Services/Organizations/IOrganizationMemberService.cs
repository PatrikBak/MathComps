using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Organizations;

/// <summary>
/// Reads who is on the organizations' lists, and which of an organization's categories each leads.
/// </summary>
/// <remarks>
/// An account is a member of an organization while the address it carries is on that organization's list, however
/// either is capitalized.
/// </remarks>
public interface IOrganizationMemberService
{
    /// <summary>
    /// Whether an account is a member of an organization. An address stands until it is taken off the list, and
    /// each read sees the list as it stands.
    /// </summary>
    /// <param name="userId">The account membership is read for.</param>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose list is read.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether they are a member.</returns>
    Task<bool> IsMemberAsync(Guid userId, string organizationSlug, CancellationToken cancellationToken = default);

    /// <summary>
    /// When an account became a member of an organization: when its address was put on the list.
    /// </summary>
    /// <param name="userId">The account membership is read for.</param>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose list is read.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>When its address was put on the list, or null where it is not on it.</returns>
    Task<DateTimeOffset?> GetMemberSinceAsync(
        Guid userId, string organizationSlug, CancellationToken cancellationToken = default);

    /// <summary>
    /// When each of several accounts became a member of an organization: when its address was put on the list.
    /// </summary>
    /// <param name="userIds">The accounts membership is read for.</param>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose list is read.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>When each address was put on the list, by account, for the ones among them who are members.</returns>
    Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetMemberSinceAsync(
        IReadOnlyCollection<Guid> userIds, string organizationSlug, CancellationToken cancellationToken = default);

    /// <summary>
    /// The ids of the organizations an account is a member of.
    /// </summary>
    /// <param name="userId">The account membership is read for.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The <see cref="Organization.Id"/> of each, none for an account on no list.</returns>
    Task<IReadOnlyList<Guid>> GetOrganizationIdsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Which of an organization's categories an account leads.
    /// </summary>
    /// <param name="userId">The account whose lead categories are read.</param>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose categories are read.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The <see cref="OrganizationCategory.Id"/> of each, none for an account leading nothing there.</returns>
    Task<IReadOnlySet<Guid>> GetLeadCategoryIdsAsync(
        Guid userId, string organizationSlug, CancellationToken cancellationToken = default);
}

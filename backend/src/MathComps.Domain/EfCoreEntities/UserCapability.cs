namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Something one account is allowed to do that the site does not allow by default, held as a
/// <see cref="UserGrant"/> against that account. A capability names an exception rather than a job, which is
/// what keeps it apart from the administrative role.
/// </summary>
public enum UserCapability
{
    /// <summary>
    /// Lets the account walk into a hosted competition with nothing in the way: a group outside the window it
    /// takes entries in, an embargoed round's problems with no entry spent, and none of what an entry ordinarily
    /// asks of the account first.
    /// </summary>
    /// <remarks>
    /// For the accounts that stress-test the examiner rather than compete. They need a competition's problems
    /// before anybody else has them, and they are never ranked, so nothing an entry ordinarily asks of the
    /// account is asked of them.
    ///
    /// The clock is where it stops. An entry starts one and everything that clock decides holds, because the
    /// point of getting in early is sitting the competition as a student sits it.
    /// </remarks>
    BypassCompetitionGates,
}

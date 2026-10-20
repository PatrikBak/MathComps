namespace MathComps.Infrastructure.Migrations;

/// <summary>
/// What an account could be granted before the MathComps organization's list took over, named by the migrations
/// written while grants existed. Nothing reads or writes one since <see cref="AddOrganizations"/> dropped the table
/// and its type.
/// </summary>
// The body stays: the compiler fails writing the XML doc of a body-less enum (CS1569)
// ReSharper disable RedundantTypeDeclarationBody
internal enum UserCapability
{
}
// ReSharper restore RedundantTypeDeclarationBody

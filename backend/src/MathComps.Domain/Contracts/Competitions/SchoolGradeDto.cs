using System.Text.Json.Serialization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// Where a student was in school, counted the Slovak and Czech way: nine years of primary school, then four of
/// high school ending in the maturita.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(PrimarySchoolGradeDto), typeDiscriminator: "primarySchool")]
[JsonDerivedType(typeof(HighSchoolGradeDto), typeDiscriminator: "highSchool")]
[JsonDerivedType(typeof(PastHighSchoolDto), typeDiscriminator: "pastHighSchool")]
public abstract record SchoolGradeDto;

/// <summary>
/// A year of primary school, or the matching year of an eight-year gymnasium.
/// </summary>
/// <param name="Year">Which one, from 1.</param>
public sealed record PrimarySchoolGradeDto(int Year) : SchoolGradeDto;

/// <summary>
/// A year of high school.
/// </summary>
/// <param name="Year">Which one, from 1.</param>
public sealed record HighSchoolGradeDto(int Year) : SchoolGradeDto;

/// <summary>
/// Done with high school.
/// </summary>
public sealed record PastHighSchoolDto : SchoolGradeDto;

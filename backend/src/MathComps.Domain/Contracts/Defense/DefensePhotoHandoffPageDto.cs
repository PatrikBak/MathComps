namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A photo the student's phone sent to a problem, as a composer on it takes it.
/// </summary>
/// <param name="PhotoId"><inheritdoc cref="DefensePhotoReadingDto" path="/param[@name='PhotoId']"/></param>
/// <param name="Text">The page written out as Markdown with LaTeX math, mistakes included.</param>
/// <param name="CapturedAt"><inheritdoc cref="EfCoreEntities.DefensePhotoHandoffPage.CapturedAt" path="/summary"/>
/// </param>
/// <param name="Link"><inheritdoc cref="DefenseTurnPhotoDto" path="/param[@name='Link']"/></param>
public record DefensePhotoHandoffPageDto(Guid PhotoId, string Text, DateTimeOffset CapturedAt, string Link);

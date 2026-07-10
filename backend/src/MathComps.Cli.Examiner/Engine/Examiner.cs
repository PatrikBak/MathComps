using System.Collections.Concurrent;
using MathComps.Cli.Examiner.Dtos;
using MathComps.Cli.Examiner.Fixtures;
using MathComps.Cli.Examiner.Settings;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Shared.Extensions;
using MathComps.Shared.Io;
using Microsoft.Extensions.Options;

namespace MathComps.Cli.Examiner.Engine;

/// <summary>
/// Implements <see cref="IExaminer"/> over an <see cref="IOpenRouterChatCaller"/>. Each turn generates a reply, then
/// math-checks and leak-checks it — independently, every turn — and, when a guard flags it, regenerates the reply up
/// to a cap, re-verifying each fresh attempt.
/// </summary>
/// <param name="chatCaller">The chat caller backing every step.</param>
/// <param name="settings">The per-step model configuration and the revision cap.</param>
public class Examiner(IOpenRouterChatCaller chatCaller, IOptions<ExaminerSettings> settings)
    : IExaminer
{
    /// <summary>
    /// The settings, resolved once at construction.
    /// </summary>
    private readonly ExaminerSettings _settings = settings.Value;

    /// <summary>
    /// Prompt-template reads keyed by path — the templates don't change during a run, so each is read once.
    /// </summary>
    private readonly ConcurrentDictionary<string, Task<string>> _prompts = new();

    /// <inheritdoc/>
    public async Task<ExaminerTurnOutcome> NextReplyAsync(
        Fixture fixture, CancellationToken cancellationToken = default)
    {
        // The examiner replies to the candidate — refuse a transcript that isn't waiting on us.
        fixture.Transcript.EnsureAwaitingExaminer();

        // The conversation so far, the user message every step reads.
        var conversation = fixture.Transcript.ToMarkdown();

        // Generate the first reply.
        var reply = await GenerateAsync(fixture, conversation, revisionNote: "", cancellationToken);

        // Run the guards over it.
        var (mathCheck, leakCheck) = await RunGuardsAsync(fixture, conversation, reply, cancellationToken);

        // Regenerate while a guard flags the reply, re-verifying each fresh attempt; once the cap is hit the last
        // attempt ships regardless.
        var revisions = 0;
        while (BuildRevisionNote(mathCheck, leakCheck) is { } note && revisions < _settings.MaxRevisions)
        {
            // Count this revision and regenerate with the specific flaw called out.
            revisions++;
            reply = await GenerateAsync(fixture, conversation, note, cancellationToken);

            // Verify the fresh attempt, so the loop knows whether the flaw is actually fixed.
            (mathCheck, leakCheck) = await RunGuardsAsync(fixture, conversation, reply, cancellationToken);
        }

        // Ship whatever we ended on, carrying its verdicts and how many revisions it took.
        return new ExaminerTurnOutcome(reply, mathCheck, leakCheck, revisions);
    }

    /// <summary>
    /// Runs both guards over one reply concurrently, since they judge the same reply from unrelated angles. The
    /// math-check finds and verifies whatever the reply asserts; the leak-check scans it for over-explaining.
    /// </summary>
    /// <param name="fixture">The fixture whose problem and reference the guards judge against.</param>
    /// <param name="conversation">The conversation so far, the context both guards read the reply in.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>The math-check and leak-check verdicts, both always present.</returns>
    private async Task<(MathCheckResult Math, LeakCheckResult Leak)> RunGuardsAsync(
        Fixture fixture, string conversation, string reply, CancellationToken cancellationToken)
    {
        // Start the math-check, letting the checker find the reply's claims itself.
        var mathCheckTask = RunGuardAsync<MathCheckResult>(
            _settings.MathCheck, fixture, conversation, reply, cancellationToken);

        // Start the leak-check against the whole transcript, concurrent with the math-check.
        var leakCheckTask = RunGuardAsync<LeakCheckResult>(
            _settings.LeakCheck, fixture, conversation, reply, cancellationToken);

        // Await both before reading their verdicts.
        await Task.WhenAll(mathCheckTask, leakCheckTask);

        // Hand back both verdicts.
        return (mathCheckTask.Result, leakCheckTask.Result);
    }

    /// <summary>
    /// Runs the generate step: the persona prompt (problem, reference, and any revision note) becomes the system
    /// message, and the conversation so far becomes the user message.
    /// </summary>
    /// <param name="fixture">The fixture whose problem and reference fill the prompt.</param>
    /// <param name="conversation">The conversation so far, the examiner responds to.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The generated reply.</returns>
    private async Task<string> GenerateAsync(
        Fixture fixture, string conversation, string revisionNote, CancellationToken cancellationToken)
    {
        // Fill the persona prompt with the problem, reference, and the revision note (empty most turns).
        var systemPrompt = (await ReadPromptAsync(_settings.Generate.Prompt, cancellationToken))
            .Replace("{problem}", fixture.Problem)
            .Replace("{reference}", fixture.Reference)
            .Replace("{revision_note}", revisionNote);

        // The conversation so far is what the examiner responds to.
        return await chatCaller.CompleteAsync<string>(
            systemPrompt, conversation, _settings.Generate.Model, _settings.Generate.ReasoningEffort,
            _settings.Generate.MaxOutputTokens, cancellationToken);
    }

    /// <summary>
    /// Runs one guard step over the proposed reply: fills the step's prompt with the problem and reference, hands the
    /// model the whole conversation plus the reply, and returns the structured verdict it binds. The math-check and the
    /// leak-check are the same call — they differ only in prompt, model, and verdict type.
    /// </summary>
    /// <typeparam name="TResult">The guard's structured verdict type.</typeparam>
    /// <param name="step">The guard step's prompt, model, and reasoning configuration.</param>
    /// <param name="fixture">The fixture whose problem and reference the guard judges against.</param>
    /// <param name="conversation">The conversation so far, the context the reply is judged in.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The guard's structured verdict.</returns>
    private async Task<TResult> RunGuardAsync<TResult>(
        ChatStepSettings step, Fixture fixture, string conversation, string reply,
        CancellationToken cancellationToken)
    {
        // The system and user messages for this guard.
        var (systemPrompt, userPrompt) = await BuildGuardPromptsAsync(
            step.Prompt, fixture, conversation, reply, cancellationToken);

        // Call the model for its structured verdict.
        return await chatCaller.CompleteAsync<TResult>(
            systemPrompt, userPrompt, step.Model, step.ReasoningEffort, step.MaxOutputTokens, cancellationToken);
    }

    /// <summary>
    /// Builds a guard step's two messages: the template with the problem and reference filled in as the system
    /// message, and the whole conversation followed by the proposed reply as the user message. Both guards share this
    /// shape, so the <c>## Examiner (proposed)</c> heading their prompts key off lives in one place.
    /// </summary>
    /// <param name="promptPath">The guard's prompt template path.</param>
    /// <param name="fixture">The fixture whose problem and reference fill the template.</param>
    /// <param name="conversation">The conversation so far.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The system and user messages for the guard call.</returns>
    private async Task<(string System, string User)> BuildGuardPromptsAsync(
        string promptPath, Fixture fixture, string conversation, string reply, CancellationToken cancellationToken)
    {
        // The guard judges against the problem and its reference solution.
        var systemPrompt = (await ReadPromptAsync(promptPath, cancellationToken))
            .Replace("{problem}", fixture.Problem)
            .Replace("{reference}", fixture.Reference);

        // The whole conversation followed by the proposed reply under scrutiny.
        var userPrompt = $"{conversation}\n\n## Examiner (proposed)\n\n{reply}";

        // Both messages for the guard call.
        return (systemPrompt, userPrompt);
    }

    /// <summary>
    /// Reads a prompt template, caching it so a run reads each file once rather than on every step and revision.
    /// </summary>
    /// <param name="path">The template's path.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The template's contents.</returns>
    private Task<string> ReadPromptAsync(string path, CancellationToken cancellationToken) =>
        // First request for a path runs the read; later ones reuse its cached task.
        _prompts.GetOrAdd(path, key => FileUtilities.ReadAppFileAsync(key, cancellationToken));

    /// <summary>
    /// Builds the revision instruction from whichever guard flagged the reply, or null when both passed and no
    /// revision is due.
    /// </summary>
    /// <param name="mathCheck">The math-check verdict.</param>
    /// <param name="leakCheck">The leak-check verdict.</param>
    /// <returns>The revision note to feed the generator, or null when nothing flagged.</returns>
    private static string? BuildRevisionNote(MathCheckResult mathCheck, LeakCheckResult leakCheck)
    {
        // Gather a note per flagged guard; a turn can trip both.
        var notes = new List<string>();

        // A wrong claim is unrecoverable, so lead the revision with the correction.
        if (!mathCheck.Holds)
            notes.Add($"One of your claims is wrong: {mathCheck.Correction} Fix it.");

        // A leak hands away earned progress, so tell the generator exactly what to withhold.
        if (leakCheck.Leaks)
            notes.Add(
                $"You gave away too much: {leakCheck.WhatLeaked} Redo the reply without revealing it — " +
                "and don't just rephrase the same hint more gently; move up a level and ask a broader, " +
                "strategy-level question that leaves the discovery to the candidate.");

        // Nothing flagged means no revision; otherwise mark the note so the prompt reads it as an instruction.
        return notes.Count == 0 ? null : "REVISION REQUIRED — " + notes.ToJoinedString(" ");
    }
}

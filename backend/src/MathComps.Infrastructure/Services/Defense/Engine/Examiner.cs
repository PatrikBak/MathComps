using System.Collections.Concurrent;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Dtos;
using MathComps.Shared.Extensions;
using MathComps.Shared.Io;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Implements <see cref="IExaminer"/> over an <see cref="IOpenRouterChatCaller"/>. Each turn generates a reply, then
/// math-checks and leak-checks it — independently, every turn — and, when a guard flags it, regenerates the
/// reply up to a cap, re-verifying each fresh attempt. Every model call's billed cost and tokens are summed
/// into the turn's outcome.
/// </summary>
/// <param name="chatCaller">The chat caller backing every step.</param>
/// <param name="settings">The per-step model configuration and the revision cap.</param>
public class Examiner(IOpenRouterChatCaller chatCaller, IOptions<ExaminerSettings> settings)
    : IExaminer
{
    /// <summary>
    /// The per-step model configuration and the revision cap.
    /// </summary>
    private readonly ExaminerSettings _settings = settings.Value;

    /// <summary>
    /// Prompt-template contents keyed by path — the templates don't change during a run, so each is read once. Holds
    /// the read's result, not its task, so a transient read failure isn't cached and permanently reused.
    /// </summary>
    private readonly ConcurrentDictionary<string, string> _prompts = new();

    /// <inheritdoc/>
    public async Task<ExaminerTurnOutcome> NextReplyAsync(
        string problem, string reference, Transcript transcript, CancellationToken cancellationToken = default)
    {
        // The examiner replies to the candidate — refuse a transcript that isn't waiting on us.
        transcript.EnsureAwaitingExaminer();

        // The conversation so far, the user message every step reads.
        var conversation = transcript.ToMarkdown();

        // The turn's running usage, summed over every model call the loop makes.
        var usage = ModelUsage.Zero;

        // Generate and verify the first reply.
        var (reply, mathCheck, leakCheck, stepUsage) = await GenerateAndVerifyAsync(
            problem, reference, conversation, revisionNote: "", cancellationToken);

        // Fold in what its three calls cost.
        usage += stepUsage;

        // No revisions yet.
        var revisions = 0;

        // Regenerate while a guard flags the reply, re-verifying each fresh attempt; once the cap is hit the last
        // attempt ships regardless.
        while (BuildRevisionNote(mathCheck, leakCheck) is { } note && revisions < _settings.MaxRevisions)
        {
            // Count this revision.
            revisions++;

            // Regenerate with the specific flaw called out, re-verifying the fresh attempt.
            (reply, mathCheck, leakCheck, stepUsage) = await GenerateAndVerifyAsync(
                problem, reference, conversation, note, cancellationToken);

            // Fold in what the revision cost.
            usage += stepUsage;
        }

        // Ship whatever we ended on, carrying its verdicts, how many revisions it took, and what the turn cost.
        return new ExaminerTurnOutcome(reply, mathCheck, leakCheck, revisions, usage);
    }

    /// <summary>
    /// Generates one reply and runs both guards over it, returning the reply, the two verdicts, and the summed cost of
    /// all three model calls. The turn's first pass and each revision are the same three calls, differing only in the
    /// revision note fed to the generator.
    /// </summary>
    /// <param name="problem">The problem that fills the prompts.</param>
    /// <param name="reference">The reference solution that fills the prompts.</param>
    /// <param name="conversation">The conversation so far, the generator answers and the guards read the
    /// reply in.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>The generated reply, both guard verdicts, and the three calls' summed usage.</returns>
    private async Task<(string Reply, MathCheckResult Math, LeakCheckResult Leak, ModelUsage Usage)>
        GenerateAndVerifyAsync(
            string problem, string reference, string conversation, string revisionNote,
            CancellationToken cancellationToken)
    {
        // Generate the reply.
        var generated = await GenerateAsync(problem, reference, conversation, revisionNote, cancellationToken);

        // Verify it with both guards.
        var (math, leak) = await RunGuardsAsync(problem, reference, conversation, generated.Value, cancellationToken);

        // The reply, both verdicts, and everything the three calls billed.
        return (generated.Value, math.Value, leak.Value, generated.Usage + math.Usage + leak.Usage);
    }

    /// <summary>
    /// Runs both guards over one reply concurrently, since they judge the same reply from unrelated angles. The
    /// math-check finds and verifies whatever the reply asserts; the leak-check scans it for over-explaining.
    /// </summary>
    /// <param name="problem">The problem the guards judge against.</param>
    /// <param name="reference">The reference solution the guards judge against.</param>
    /// <param name="conversation">The conversation so far, the context both guards read the reply in.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>The math-check and leak-check results, each carrying its verdict and what the call cost.</returns>
    private async Task<(ChatCallResult<MathCheckResult> Math, ChatCallResult<LeakCheckResult> Leak)> RunGuardsAsync(
        string problem, string reference, string conversation, string reply, CancellationToken cancellationToken)
    {
        // Start the math-check, letting the checker find the reply's claims itself.
        var mathCheckTask = RunGuardAsync<MathCheckResult>(
            _settings.MathCheck, problem, reference, conversation, reply, cancellationToken);

        // Start the leak-check against the whole transcript, concurrent with the math-check.
        var leakCheckTask = RunGuardAsync<LeakCheckResult>(
            _settings.LeakCheck, problem, reference, conversation, reply, cancellationToken);

        // Await both before reading their results.
        await Task.WhenAll(mathCheckTask, leakCheckTask);

        // Hand back both results.
        return (mathCheckTask.Result, leakCheckTask.Result);
    }

    /// <summary>
    /// Runs the generate step: the persona prompt (problem, reference, and any revision note) becomes the system
    /// message, and the conversation so far becomes the user message.
    /// </summary>
    /// <param name="problem">The problem that fills the prompt.</param>
    /// <param name="reference">The reference solution that fills the prompt.</param>
    /// <param name="conversation">The conversation so far, the examiner responds to.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The generated reply and what the call cost.</returns>
    private async Task<ChatCallResult<string>> GenerateAsync(
        string problem, string reference, string conversation, string revisionNote,
        CancellationToken cancellationToken)
    {
        // Fill the persona prompt with the problem, reference, and the revision note (empty most turns).
        var systemPrompt = (await ReadPromptAsync(_settings.Generate.Prompt, cancellationToken))
            .Replace("{problem}", problem)
            .Replace("{reference}", reference)
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
    /// <param name="problem">The problem the guard judges against.</param>
    /// <param name="reference">The reference solution the guard judges against.</param>
    /// <param name="conversation">The conversation so far, the context the reply is judged in.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The guard's structured verdict and what the call cost.</returns>
    private async Task<ChatCallResult<TResult>> RunGuardAsync<TResult>(
        ChatStepSettings step, string problem, string reference, string conversation, string reply,
        CancellationToken cancellationToken)
    {
        // The system and user messages for this guard.
        var (systemPrompt, userPrompt) = await BuildGuardPromptsAsync(
            step.Prompt, problem, reference, conversation, reply, cancellationToken);

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
    /// <param name="problem">The problem that fills the template.</param>
    /// <param name="reference">The reference solution that fills the template.</param>
    /// <param name="conversation">The conversation so far.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The system and user messages for the guard call.</returns>
    private async Task<(string System, string User)> BuildGuardPromptsAsync(
        string promptPath, string problem, string reference, string conversation, string reply,
        CancellationToken cancellationToken)
    {
        // The guard judges against the problem and its reference solution.
        var systemPrompt = (await ReadPromptAsync(promptPath, cancellationToken))
            .Replace("{problem}", problem)
            .Replace("{reference}", reference);

        // The whole conversation followed by the proposed reply under scrutiny.
        var userPrompt = $"{conversation}\n\n## Examiner (proposed)\n\n{reply}";

        // Both messages for the guard call.
        return (systemPrompt, userPrompt);
    }

    /// <summary>
    /// Reads a prompt template, caching its contents so a run reads each file once rather than on every step and
    /// revision.
    /// </summary>
    /// <param name="path">The template's path.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The template's contents.</returns>
    private async Task<string> ReadPromptAsync(string path, CancellationToken cancellationToken)
    {
        // Reuse the cached contents once a path has been read.
        if (_prompts.TryGetValue(path, out var cached))
            return cached;

        // First request for a path runs the read; a failure surfaces and isn't cached, so a later turn retries it.
        var contents = await FileUtilities.ReadAppFileAsync(path, cancellationToken);

        // Cache the contents for later steps; a concurrent first read just stores the same text again.
        _prompts[path] = contents;

        // Hand back the template.
        return contents;
    }

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

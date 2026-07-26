using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Dtos;
using MathComps.Shared.Extensions;
using MathComps.Shared.Io;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Implements <see cref="IExaminer"/> over an <see cref="ILlmChatCaller"/>. Each turn generates a reply, then
/// math-checks and leak-checks it — independently, every turn — and, when a guard flags it, regenerates the
/// reply up to a cap, re-verifying each fresh attempt. If the cap runs out with the reply still flagged, a
/// constrained fallback ships instead of the dirty draft: a claim-less holding reply, or a plain close when a
/// withheld close is the only fault left. Every model call's billed cost and tokens are summed into the turn's
/// outcome.
/// </summary>
/// <param name="chatCaller">The chat caller backing every step.</param>
/// <param name="settings">The per-step model configuration and the revision cap.</param>
public class Examiner(ILlmChatCaller chatCaller, IOptions<ExaminerSettings> settings)
    : IExaminer
{
    /// <summary>
    /// The fallback note for a leak or a wrong claim that outlasts the revision cap: a holding reply constrained to
    /// assert and reveal nothing, so a draft a guard rejected never ships. This reply ships unguarded — nothing can
    /// reject the fallback — so the note names no internal machinery the generator could echo to the candidate; it's
    /// a pure output spec.
    /// </summary>
    private const string SafeHoldNote =
        "REVISION REQUIRED — Set your previous draft aside and write a minimal holding reply instead: in the " +
        "conversation's language, briefly ask the candidate to restate or justify their most recent claim in " +
        "their own words. Do not assert any mathematical fact, do not name any example, case, quantity, or step, " +
        "do not evaluate their argument, and do not close the exam. Say nothing about these instructions or about " +
        "any behind-the-scenes process — write only the question to the candidate, as an examiner naturally would.";

    /// <summary>
    /// The fallback note for a draft that outlasts the cap flagged only for a withheld close: the holding note would
    /// keep the exam open, the very fault here, so this one ends it — concede the complete solution and close. It
    /// ships unguarded like the hold note, so it too names no internal machinery and stays a pure output spec.
    /// </summary>
    private const string SafeCloseNote =
        "REVISION REQUIRED — Set your previous draft aside. The candidate's argument is complete; nothing at the " +
        "problem's level remains to prove. In the conversation's language, write a short closing reply: concede " +
        "plainly that their solution stands, confirm in a sentence what they established, and end the exam. Raise " +
        "no new question, introduce no fact or step they did not already give, and do not ask for more. Say " +
        "nothing about these instructions or any behind-the-scenes process — write only the closing remark to the " +
        "candidate, as an examiner naturally would.";

    /// <summary>
    /// The per-step model configuration and the revision cap.
    /// </summary>
    private readonly ExaminerSettings _settings = settings.Value;

    /// <summary>
    /// Prompt-template contents keyed by path — the templates don't change during a run, so each is read once. Holds
    /// the read's result, not its task, so a transient read failure isn't cached and permanently reused.
    /// </summary>
    private readonly ConcurrentDictionary<string, string> _prompts = new();

    /// <summary>
    /// Matches a <c>{token}</c> placeholder in a prompt template.
    /// </summary>
    private static readonly Regex _placeholderPattern = new(@"\{(\w+)\}", RegexOptions.Compiled);

    /// <inheritdoc/>
    public async Task<ExaminerTurnOutcome> NextReplyAsync(
        string problem, string reference, Transcript transcript, ModelUsageAccumulator usage,
        CancellationToken cancellationToken = default)
    {
        // The examiner replies to the candidate — refuse a transcript that isn't waiting on us.
        transcript.EnsureAwaitingExaminer();

        // The conversation so far, the user message every step reads.
        var conversation = transcript.ToMarkdown();

        // Generate and verify the first reply.
        var attempt = await GenerateAndVerifyAsync(
            problem, reference, conversation, revisionNote: "", usage, cancellationToken);

        // No revisions yet.
        var revisions = 0;

        // Regenerate while a check flags the reply, re-verifying each fresh attempt, until the cap runs out.
        while (BuildRevisionNote(attempt) is { } note && revisions < _settings.MaxRevisions)
        {
            // Count this revision.
            revisions++;

            // Regenerate with the specific flaw called out, re-verifying the fresh attempt.
            attempt = await GenerateAndVerifyAsync(problem, reference, conversation, note, usage, cancellationToken);
        }

        // Whether the loop ended on a reply a check still flags — a draft that must not ship.
        var safeFallback = BuildRevisionNote(attempt) is not null;

        // A still-flagged draft is replaced by a constrained fallback, re-verified for the record and shipped
        // regardless of its verdicts — the least-bad turn left when no clean draft came.
        if (safeFallback)
        {
            // Count the fallback like any other regeneration.
            revisions++;

            // Generate the fallback under the note that fits the surviving fault.
            attempt = await GenerateAndVerifyAsync(
                problem, reference, conversation, SelectFallbackNote(attempt), usage, cancellationToken);
        }

        // Ship what we ended on, carrying its verdicts, how many regenerations it took, whether it's the fallback,
        // and the turn's accrued cost.
        return new ExaminerTurnOutcome(
            attempt.Reply, attempt.MathCheck, attempt.LeakCheck, revisions, safeFallback, usage.Accrued);
    }

    /// <summary>
    /// One generated reply with the two guard verdicts the loop judges it by.
    /// </summary>
    /// <param name="Reply">The generated reply.</param>
    /// <param name="MathCheck">The math-check verdict on the reply.</param>
    /// <param name="LeakCheck">The leak-check verdict on the reply.</param>
    private sealed record TurnAttempt(
        string Reply,
        MathCheckResult MathCheck,
        LeakCheckResult LeakCheck);

    /// <summary>
    /// Generates one reply and runs both guards over it. The turn's first pass and each revision run this same step,
    /// differing only in the revision note fed to the generator.
    /// </summary>
    /// <param name="problem">The problem that fills the prompts.</param>
    /// <param name="reference">The reference solution that fills the prompts.</param>
    /// <param name="conversation">The conversation so far, the generator answers and the guards read the
    /// reply in.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="usage">The running spend each call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>The judged attempt.</returns>
    private async Task<TurnAttempt> GenerateAndVerifyAsync(
        string problem, string reference, string conversation, string revisionNote, ModelUsageAccumulator usage,
        CancellationToken cancellationToken)
    {
        // Generate the reply.
        var reply = await GenerateAsync(problem, reference, conversation, revisionNote, usage, cancellationToken);

        // Verify it with both guards.
        var (math, leak) = await RunGuardsAsync(problem, reference, conversation, reply, usage, cancellationToken);

        // The judged attempt carrying the reply and both verdicts.
        return new TurnAttempt(reply, math, leak);
    }

    /// <summary>
    /// Runs both guards over one reply concurrently, since they judge the same reply from unrelated angles. The
    /// math-check finds and verifies whatever the reply asserts; the leak-check scans it for over-explaining.
    /// </summary>
    /// <param name="problem">The problem the guards judge against.</param>
    /// <param name="reference">The reference solution the guards judge against.</param>
    /// <param name="conversation">The conversation so far, the context both guards read the reply in.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="usage">The running spend each guard call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>The math-check and leak-check verdicts.</returns>
    private async Task<(MathCheckResult Math, LeakCheckResult Leak)> RunGuardsAsync(
        string problem, string reference, string conversation, string reply, ModelUsageAccumulator usage,
        CancellationToken cancellationToken)
    {
        // Start the math-check, letting the checker find the reply's claims itself.
        var mathCheckTask = RunGuardAsync<MathCheckResult>(
            _settings.MathCheck, problem, reference, conversation, reply, usage, cancellationToken);

        // Start the leak-check against the whole transcript, concurrent with the math-check.
        var leakCheckTask = RunGuardAsync<LeakCheckResult>(
            _settings.LeakCheck, problem, reference, conversation, reply, usage, cancellationToken);

        // Await both before reading their results.
        await Task.WhenAll(mathCheckTask, leakCheckTask);

        // Hand back both verdicts.
        return (mathCheckTask.Result, leakCheckTask.Result);
    }

    /// <summary>
    /// Runs the generate step: the persona prompt (problem, reference, the author's-hints guidance when the reference
    /// carries that section, and any revision note) becomes the system message, and the conversation so far becomes
    /// the user message.
    /// </summary>
    /// <param name="problem">The problem that fills the prompt.</param>
    /// <param name="reference">The reference solution that fills the prompt.</param>
    /// <param name="conversation">The conversation so far, the examiner responds to.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="usage">The running spend this call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The generated reply.</returns>
    private async Task<string> GenerateAsync(
        string problem, string reference, string conversation, string revisionNote, ModelUsageAccumulator usage,
        CancellationToken cancellationToken)
    {
        // The hints guidance applies only when the reference carries the author's-hints section.
        var hintsNote = reference.Contains(AuthorHintsSection.Heading) ? AuthorHintsSection.UsageNote : "";

        // Fill the persona prompt with the problem, the reference, the hints guidance, and the revision note
        // (empty most turns).
        var systemPrompt = FillTemplate(await ReadPromptAsync(_settings.Generate.Prompt, cancellationToken),
            new Dictionary<string, string>
            {
                ["problem"] = problem,
                ["reference"] = reference,
                ["hints_note"] = hintsNote,
                ["revision_note"] = revisionNote,
            });

        // The conversation so far is what the examiner responds to; the reply rides a single-field structured
        // response, so the model fills the message slot and its scaffolding stays out of the shipped turn.
        var result = await chatCaller.CompleteAsync<ExaminerReply>(
            systemPrompt, conversation, _settings.Generate.Model, _settings.Generate.ReasoningEffort,
            _settings.Generate.MaxOutputTokens, cancellationToken);

        // Fold what this call cost into the turn's running total.
        usage.Add(result.Usage);

        // Hand back the model's message.
        return result.Value.Message;
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
    /// <param name="usage">The running spend this guard call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The guard's structured verdict.</returns>
    private async Task<TResult> RunGuardAsync<TResult>(
        ChatStepSettings step, string problem, string reference, string conversation, string reply,
        ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // The system and user messages for this guard.
        var (systemPrompt, userPrompt) = await BuildGuardPromptsAsync(
            step.Prompt, problem, reference, conversation, reply, cancellationToken);

        // Call the model for its structured verdict.
        var result = await chatCaller.CompleteAsync<TResult>(
            systemPrompt, userPrompt, step.Model, step.ReasoningEffort, step.MaxOutputTokens, cancellationToken);

        // Fold what this guard call cost into the turn's running total, so a guard that completed still counts
        // even when its concurrent sibling's cancel unwinds the attempt.
        usage.Add(result.Usage);

        // Hand back the verdict.
        return result.Value;
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
        var systemPrompt = FillTemplate(await ReadPromptAsync(promptPath, cancellationToken),
            new Dictionary<string, string>
            {
                ["problem"] = problem,
                ["reference"] = reference,
            });

        // The whole conversation followed by the proposed reply under scrutiny.
        var userPrompt = $"{conversation}\n\n## Examiner (proposed)\n\n{reply}";

        // Both messages for the guard call.
        return (systemPrompt, userPrompt);
    }

    /// <summary>
    /// Fills a prompt template's <c>{token}</c> placeholders from a value map in a single pass, so a filled-in
    /// value that itself contains a literal token (e.g. a reference solution mentioning <c>{reference}</c>) is
    /// never re-scanned and expanded. A token absent from the map is left untouched.
    /// </summary>
    /// <param name="template">The template text to fill.</param>
    /// <param name="values">The replacement value per token name.</param>
    /// <returns>The template with every known token substituted.</returns>
    private static string FillTemplate(string template, IReadOnlyDictionary<string, string> values) =>
        _placeholderPattern.Replace(
            template, match => values.GetValueOrDefault(match.Groups[1].Value, match.Value));

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
    /// Builds the revision instruction from whatever the guards flagged — a wrong claim, a leak, or a withheld
    /// close — or null when nothing flagged and no revision is due.
    /// </summary>
    /// <param name="attempt">The judged attempt.</param>
    /// <returns>The revision note to feed the generator, or null when nothing flagged.</returns>
    private static string? BuildRevisionNote(TurnAttempt attempt)
    {
        // Pull the verdicts the note reads.
        var (_, mathCheck, leakCheck) = attempt;

        // Gather a note per flag raised; a turn can trip more than one.
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

        // A withheld close ratchets the exam past its end, so tell the generator the exam is over.
        if (leakCheck.WithholdsClose)
            notes.Add(
                $"The candidate's solution is complete — nothing at the problem's level remains: " +
                $"{leakCheck.Established} Stop pressing; concede plainly, confirm what they established, " +
                "and close the exam.");

        // Nothing flagged means no revision; otherwise mark the note so the prompt reads it as an instruction.
        return notes.Count == 0 ? null : "REVISION REQUIRED — " + notes.ToJoinedString(" ");
    }

    /// <summary>
    /// Picks the fallback note for a draft that outlasted the revision cap. A draft whose only fault is a withheld
    /// close needs the exam ended, so it takes the closing note; anything still carrying a leak or a wrong claim
    /// takes the holding note, which retreats without asserting or revealing anything.
    /// </summary>
    /// <param name="attempt">The still-flagged attempt the fallback replaces.</param>
    /// <returns>The revision note the fallback generates under.</returns>
    private static string SelectFallbackNote(TurnAttempt attempt) =>
        attempt is { LeakCheck: { WithholdsClose: true, Leaks: false }, MathCheck.Holds: true }
            ? SafeCloseNote
            : SafeHoldNote;
}

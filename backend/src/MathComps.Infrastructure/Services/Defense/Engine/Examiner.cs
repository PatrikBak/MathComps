using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.RegularExpressions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Dtos;
using MathComps.Shared.Extensions;
using MathComps.Shared.Io;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Implements <see cref="IExaminer"/> over an <see cref="ILlmChatCaller"/>. Each turn generates a reply, then
/// math-checks, leak-checks and language-checks it — independently, every turn — and, when a guard flags it,
/// regenerates the reply up to a cap, re-verifying each fresh attempt. If the cap runs out with a wrong claim or a
/// mis-paid step still on the reply, a constrained fallback ships instead of the dirty draft: a claim-less holding
/// reply, whichever fault survived. Every model call's billed cost and tokens
/// are summed into the turn's outcome.
/// </summary>
/// <param name="chatCaller">The chat caller backing every step.</param>
/// <param name="settings">The per-step model configuration, the path to every note, and the revision cap.</param>
public class Examiner(ILlmChatCaller chatCaller, IOptions<ExaminerSettings> settings)
    : IExaminer
{
    /// <summary>
    /// The heading a guard's user message puts the proposed reply under. Every guard prompt keys off it, so the
    /// wording lives in one place.
    /// </summary>
    private const string ProposedReplyHeading = "## Examiner (proposed)";

    /// <summary>
    /// The per-step model configuration, the note paths, and the revision cap.
    /// </summary>
    private readonly ExaminerSettings _settings = settings.Value;

    /// <summary>
    /// Prompt-template and note contents keyed by path — none of them change during a run, so each is read once.
    /// Holds the read's result, not its task, so a transient read failure isn't cached and permanently reused.
    /// </summary>
    private readonly ConcurrentDictionary<string, string> _prompts = new();

    /// <summary>
    /// Matches a <c>{token}</c> placeholder in a prompt template or note.
    /// </summary>
    private static readonly Regex _placeholderPattern = new(@"\{(\w+)\}", RegexOptions.Compiled);

    /// <inheritdoc/>
    public async Task<ExaminerTurnOutcome> NextReplyAsync(
        string problem, string reference, Transcript transcript, ModelUsageAccumulator usage,
        CancellationToken cancellationToken = default)
    {
        // The examiner replies to the candidate — refuse a transcript that isn't waiting on us.
        transcript.EnsureAwaitingExaminer();

        // The conversation so far, the user message the generator and the reference guards read.
        var conversation = transcript.ToMarkdown();

        // The candidate's latest turn, which the precondition above has just established is the last one. The
        // language check sees this and nothing else: the language to answer in is theirs to change mid-exam, so
        // handing the checker the earlier turns would only give it grounds to flag the examiner for following.
        var candidateTurn = transcript.Turns[^1].Text;

        // Every note this turn fills a prompt with, read once for the whole turn.
        var notes = await ReadNotesAsync(cancellationToken);

        // The hints guidance applies only when the reference carries the author's-hints section.
        var hintsNote = reference.Contains(DefenseReferenceBuilder.Heading) ? notes.AuthorHints : "";

        // Every attempt the turn makes, kept in order: the last one ships and the rest are the record of what was
        // tried and why it was sent back.
        var attempts = new List<ExaminerAttempt>
        {
            await GenerateAndVerifyAsync(
                problem, reference, conversation, candidateTurn, hintsNote, revisionNote: "", usage,
                cancellationToken),
        };

        // Regenerate while a check flags the reply, re-verifying each fresh attempt, until the cap runs out.
        while (BuildRevisionNote(attempts[^1], notes) is { } note && attempts.Count <= _settings.MaxRevisions)
        {
            // Regenerate with the specific flaw called out, re-verifying the fresh attempt.
            attempts.Add(await GenerateAndVerifyAsync(
                problem, reference, conversation, candidateTurn, hintsNote, note, usage, cancellationToken));
        }

        // Whether the loop ended on a fault the fallback exists for — a draft that must not ship.
        var safeFallback = NeedsSafeFallback(attempts[^1]);

        // A still-flagged draft is replaced by a constrained fallback, re-verified for the record and shipped
        // regardless of its verdicts — the least-bad turn left when no clean draft came.
        if (safeFallback)
        {
            // Generate the fallback under the holding note, whatever the surviving fault. A withheld close takes
            // it too: ending the conversation is the one move no guard verifies, so it never ships from a fallback
            // nothing can reject, and the conversation holds one more turn instead.
            attempts.Add(await GenerateAndVerifyAsync(
                problem, reference, conversation, candidateTurn, hintsNote,
                WrapRevision(notes.Revision, notes.SafeHold), usage, cancellationToken));
        }

        // Ship the trail, whether it ended on the fallback, and the turn's accrued cost.
        return new ExaminerTurnOutcome(attempts, safeFallback, usage.Accrued);
    }

    /// <summary>
    /// Generates one reply and runs every guard over it. The turn's first pass and each revision run this same step,
    /// differing only in the revision note fed to the generator.
    /// </summary>
    /// <param name="problem">The problem that fills the prompts.</param>
    /// <param name="reference">The reference solution that fills the prompts.</param>
    /// <param name="conversation">The conversation so far, the generator answers and the reference guards read the
    /// reply in.</param>
    /// <param name="candidateTurn">The candidate's latest turn, the only context the language check reads.</param>
    /// <param name="hintsNote">The author's-hints guidance for the prompt, or empty for a reference without that
    /// section.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="usage">The running spend each call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>The judged attempt.</returns>
    private async Task<ExaminerAttempt> GenerateAndVerifyAsync(
        string problem, string reference, string conversation, string candidateTurn, string hintsNote,
        string revisionNote, ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // Time the whole attempt: writing the draft, then judging it.
        var stopwatch = Stopwatch.StartNew();

        // Generate the reply.
        var (reply, generateCall) = await GenerateAsync(
            problem, reference, conversation, hintsNote, revisionNote, usage, cancellationToken);

        // Verify it with every guard.
        var guards = await RunGuardsAsync(
            problem, reference, conversation, candidateTurn, reply, usage, cancellationToken);

        // Stop the clock now that the attempt is judged.
        stopwatch.Stop();

        // The attempt, carrying the reply, every verdict, the calls that produced them, and how long it all took.
        return new ExaminerAttempt(
            reply,
            revisionNote,
            guards.Math.Verdict,
            guards.Leak.Verdict,
            guards.Language.Verdict,
            [generateCall, guards.Math.Call, guards.Leak.Call, guards.Language.Call],
            (int)stopwatch.ElapsedMilliseconds);
    }

    /// <summary>
    /// Runs every guard over one reply concurrently, since they judge the same reply from unrelated angles. The
    /// math-check finds and verifies whatever the reply asserts; the leak-check scans it for over-explaining; the
    /// language check reads it against the candidate's latest turn alone.
    /// </summary>
    /// <param name="problem">The problem the reference guards judge against.</param>
    /// <param name="reference">The reference solution the reference guards judge against.</param>
    /// <param name="conversation">The conversation so far, the context the reference guards read the reply in.</param>
    /// <param name="candidateTurn">The candidate's latest turn, the only context the language check reads.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="usage">The running spend each guard call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>Every guard's verdict, each paired with the call that produced it.</returns>
    private async Task<(GuardRun<MathCheckResult> Math, GuardRun<LeakCheckResult> Leak,
        GuardRun<LanguageCheckResult> Language)> RunGuardsAsync(
        string problem, string reference, string conversation, string candidateTurn, string reply,
        ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // Start the math-check, letting the checker find the reply's claims itself.
        var mathCheckTask = RunGuardAsync<MathCheckResult>(
            ExaminerStep.MathCheck, _settings.MathCheck, problem, reference, conversation, reply, usage,
            cancellationToken);

        // Start the leak-check against the whole transcript, concurrent with the math-check.
        var leakCheckTask = RunGuardAsync<LeakCheckResult>(
            ExaminerStep.LeakCheck, _settings.LeakCheck, problem, reference, conversation, reply, usage,
            cancellationToken);

        // Start the language check against the candidate's latest turn, concurrent with the others.
        var languageCheckTask = RunLanguageGuardAsync(candidateTurn, reply, usage, cancellationToken);

        // Await them all before reading their results.
        await Task.WhenAll(mathCheckTask, leakCheckTask, languageCheckTask);

        // Hand back every guard's run.
        return (mathCheckTask.Result, leakCheckTask.Result, languageCheckTask.Result);
    }

    /// <summary>
    /// One guard's verdict paired with the call that produced it, so an attempt can record what each guard said and
    /// what asking it cost.
    /// </summary>
    /// <typeparam name="TVerdict">The guard's structured verdict type.</typeparam>
    /// <param name="Verdict">What the guard decided.</param>
    /// <param name="Call">The model call it made.</param>
    private sealed record GuardRun<TVerdict>(TVerdict Verdict, ExaminerStepCall Call);

    /// <summary>
    /// Every note the generate prompt can be filled with, read once for the turn.
    /// </summary>
    /// <param name="Revision">The wrapper every revision instruction is written into.</param>
    /// <param name="WrongClaim">The instruction for a reply the math-check found a wrong claim in.</param>
    /// <param name="Leak">The instruction for a reply the leak-check found hands away earned progress.</param>
    /// <param name="WithheldClose">The instruction for a reply that keeps pressing a completed solution.</param>
    /// <param name="LanguageSwitch">The instruction for a reply that drifted out of the candidate's language.</param>
    /// <param name="SafeHold">The instruction a draft that outlasted the revision cap is replaced under.</param>
    /// <param name="AuthorHints">The guidance for using the author's staged hints.</param>
    private sealed record Notes(
        string Revision, string WrongClaim, string Leak, string WithheldClose, string LanguageSwitch,
        string SafeHold, string AuthorHints);

    /// <summary>
    /// Runs the generate step: the persona prompt (problem, reference, the author's-hints guidance when the reference
    /// carries that section, and any revision note) becomes the system message, and the conversation so far becomes
    /// the user message.
    /// </summary>
    /// <param name="problem">The problem that fills the prompt.</param>
    /// <param name="reference">The reference solution that fills the prompt.</param>
    /// <param name="conversation">The conversation so far, the examiner responds to.</param>
    /// <param name="hintsNote">The author's-hints guidance for the prompt, or empty for a reference without that
    /// section.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="usage">The running spend this call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The generated reply, and the call that wrote it.</returns>
    private async Task<(string Reply, ExaminerStepCall Call)> GenerateAsync(
        string problem, string reference, string conversation, string hintsNote, string revisionNote,
        ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
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

        // Time the call, so a slow turn can be traced to the step that spent it.
        var stopwatch = Stopwatch.StartNew();

        // The conversation so far is what the examiner responds to; the reply comes back as plain text, the one shape
        // that carries the LaTeX the examiner writes through unaltered.
        var result = await chatCaller.CompleteTextAsync(
            ChatCallRequest.For(_settings.Generate, systemPrompt, conversation), cancellationToken);

        // Stop the clock before the bookkeeping below.
        stopwatch.Stop();

        // Fold what this call cost into the turn's running total.
        usage.Add(result.Usage);

        // Hand the message back with its math in the project's dollar delimiters, alongside what writing it cost.
        return (
            MathDelimiterNormalizer.Normalize(result.Value),
            BuildStepCall(ExaminerStep.Generate, _settings.Generate, result, stopwatch.ElapsedMilliseconds));
    }

    /// <summary>
    /// Runs one reference guard over the proposed reply: fills the step's prompt with the problem and reference, hands
    /// the model the whole conversation plus the reply, and returns the structured verdict it binds. The math-check
    /// and the leak-check are the same call — they differ only in prompt, model, and verdict type.
    /// </summary>
    /// <typeparam name="TResult">The guard's structured verdict type.</typeparam>
    /// <param name="stepKind">Which step this guard is, for the record of what the attempt called.</param>
    /// <param name="step">The guard step's prompt, model, and reasoning configuration.</param>
    /// <param name="problem">The problem the guard judges against.</param>
    /// <param name="reference">The reference solution the guard judges against.</param>
    /// <param name="conversation">The conversation so far, the context the reply is judged in.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="usage">The running spend this guard call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The guard's verdict and the call that produced it.</returns>
    private async Task<GuardRun<TResult>> RunGuardAsync<TResult>(
        ExaminerStep stepKind, ChatStepSettings step, string problem, string reference, string conversation,
        string reply, ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // The guard judges against the problem and its reference solution.
        var systemPrompt = FillTemplate(await ReadPromptAsync(step.Prompt, cancellationToken),
            new Dictionary<string, string>
            {
                ["problem"] = problem,
                ["reference"] = reference,
            });

        // The whole conversation followed by the proposed reply under scrutiny.
        var userPrompt = $"{conversation}\n\n{ProposedReplyHeading}\n\n{reply}";

        // Make the call and hand back the run.
        return await CallGuardAsync<TResult>(stepKind, step, systemPrompt, userPrompt, usage, cancellationToken);
    }

    /// <summary>
    /// Runs the language check over the proposed reply. Its prompt takes no placeholders and its user message is just
    /// the candidate's latest turn beside the reply: the question is which language two pieces of prose are in, and
    /// the problem, the reference and the rest of the conversation say nothing about that.
    /// </summary>
    /// <param name="candidateTurn">The candidate's latest turn, the language the reply has to match.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="usage">The running spend this call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The language-check verdict and the call that produced it.</returns>
    private async Task<GuardRun<LanguageCheckResult>> RunLanguageGuardAsync(
        string candidateTurn, string reply, ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // The check's instructions, which stand on their own.
        var systemPrompt = await ReadPromptAsync(_settings.LanguageCheck.Prompt, cancellationToken);

        // The candidate's latest turn followed by the proposed reply under scrutiny.
        var userPrompt = $"## Candidate\n\n{candidateTurn}\n\n{ProposedReplyHeading}\n\n{reply}";

        // Make the call and hand back the run.
        return await CallGuardAsync<LanguageCheckResult>(
            ExaminerStep.LanguageCheck, _settings.LanguageCheck, systemPrompt, userPrompt, usage, cancellationToken);
    }

    /// <summary>
    /// Makes one guard's model call and folds what it cost into the turn, the part every guard shares once its own
    /// two messages are built.
    /// </summary>
    /// <typeparam name="TResult">The guard's structured verdict type.</typeparam>
    /// <param name="stepKind">Which step this guard is, for the record of what the attempt called.</param>
    /// <param name="step">The guard step's model and reasoning configuration.</param>
    /// <param name="systemPrompt">The guard's instructions.</param>
    /// <param name="userPrompt">What the guard reads the reply in.</param>
    /// <param name="usage">The running spend this guard call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The guard's verdict and the call that produced it.</returns>
    private async Task<GuardRun<TResult>> CallGuardAsync<TResult>(
        ExaminerStep stepKind, ChatStepSettings step, string systemPrompt, string userPrompt,
        ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // Time the call. The guards run concurrently, so this is what says which of them a slow attempt was
        // waiting on.
        var stopwatch = Stopwatch.StartNew();

        // Call the model for its structured verdict.
        var result = await chatCaller.CompleteAsync<TResult>(
            ChatCallRequest.For(step, systemPrompt, userPrompt), cancellationToken);

        // Stop the clock before the bookkeeping below.
        stopwatch.Stop();

        // Fold what this guard call cost into the turn's running total, so a guard that completed still counts
        // even when its concurrent sibling's cancel unwinds the attempt.
        usage.Add(result.Usage);

        // Hand back the verdict alongside what asking for it cost.
        return new GuardRun<TResult>(
            result.Value, BuildStepCall(stepKind, step, result, stopwatch.ElapsedMilliseconds));
    }

    /// <summary>
    /// Records one call: which step made it, how it was routed, and what it billed. The reasoning level comes off the
    /// step's settings, so a session's trail can be read against the config snapshot taken when it started; the model
    /// comes off the reply instead, because a fallback chain means the settings only say which model was asked for.
    /// </summary>
    /// <typeparam name="TResult">The shape the call's reply was read into.</typeparam>
    /// <param name="stepKind">Which step made the call.</param>
    /// <param name="step">The step's model and reasoning configuration.</param>
    /// <param name="result">The call's reply, carrying the model that answered and what it billed.</param>
    /// <param name="elapsedMs">How long the call took, in milliseconds.</param>
    /// <returns>The recorded call.</returns>
    private static ExaminerStepCall BuildStepCall<TResult>(
        ExaminerStep stepKind, ChatStepSettings step, ChatCallResult<TResult> result, long elapsedMs) =>
        new(stepKind, result.ServedModel, step.ReasoningEffort, result.Usage, (int)elapsedMs);

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
    /// Reads every note a turn fills the generate prompt with, going through the same cache the step prompts use.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the reads.</param>
    /// <returns>The turn's notes.</returns>
    private async Task<Notes> ReadNotesAsync(CancellationToken cancellationToken)
    {
        // Where each note lives.
        var paths = _settings.Notes;

        // Read them all, giving each the tokens it may carry.
        return new Notes(
            await ReadNoteAsync(paths.Revision, ["notes"], cancellationToken),
            await ReadNoteAsync(paths.WrongClaim, ["correction"], cancellationToken),
            await ReadNoteAsync(paths.Leak, ["what_leaked"], cancellationToken),
            await ReadNoteAsync(paths.WithheldClose, [], cancellationToken),
            await ReadNoteAsync(paths.LanguageSwitch, [], cancellationToken),
            await ReadNoteAsync(paths.SafeHold, [], cancellationToken),
            await ReadNoteAsync(paths.AuthorHints, [], cancellationToken));
    }

    /// <summary>
    /// Reads one note, refusing an empty one and any placeholder nothing fills: braces nothing fills would reach
    /// the model as literal text in the examiner's instructions, which no gate and no guard would flag. The text is
    /// trimmed, so a file's trailing newline can't land in the middle of a joined revision instruction.
    /// </summary>
    /// <param name="path">The note's path.</param>
    /// <param name="tokens">The placeholder names this note may carry.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The note's text.</returns>
    private async Task<string> ReadNoteAsync(
        string path, IReadOnlyCollection<string> tokens, CancellationToken cancellationToken)
    {
        // The note as written, without the whitespace the file wraps it in.
        var text = (await ReadPromptAsync(path, cancellationToken)).Trim();

        // An empty note instructs the model in nothing. The revision note is the costly one: it would still read as
        // a note, so the loop would send every flagged draft back and burn its whole cap under no instruction.
        if (text.Length == 0)
            throw new InvalidOperationException($"The examiner note at '{path}' is empty.");

        // The note's first placeholder that nothing fills.
        var unfilled = _placeholderPattern.Matches(text)
            .Select(match => match.Groups[1].Value)
            .FirstOrDefault(token => !tokens.Contains(token));

        // Refuse a note carrying a hole nothing fills.
        if (unfilled is not null)
            throw new InvalidOperationException(
                $"The examiner note at '{path}' carries a '{{{unfilled}}}' placeholder that nothing fills.");

        // Hand back the note.
        return text;
    }

    /// <summary>
    /// Builds the revision instruction from whatever the guards flagged — a wrong claim, a leak, or a withheld
    /// close — or null when nothing flagged and no revision is due.
    /// </summary>
    /// <param name="attempt">The judged attempt.</param>
    /// <param name="notes">The turn's notes: the wrapper and an instruction per flaw.</param>
    /// <returns>The revision note to feed the generator, or null when nothing flagged.</returns>
    private static string? BuildRevisionNote(ExaminerAttempt attempt, Notes notes)
    {
        // Pull the verdicts the note reads.
        var (_, _, mathCheck, leakCheck, languageCheck, _, _) = attempt;

        // Gather an instruction per flag raised; a turn can trip more than one.
        var flagged = new List<string>();

        // A wrong claim is unrecoverable, so lead the revision with the correction.
        if (!mathCheck.Holds)
            flagged.Add(FillTemplate(notes.WrongClaim, new Dictionary<string, string>
            {
                ["correction"] = mathCheck.Correction.EnsureSentenceEnd(),
            }));

        // A leak hands away earned progress, so send the reply back with what leaked named.
        if (leakCheck.Leaks)
            flagged.Add(FillTemplate(notes.Leak, new Dictionary<string, string>
            {
                ["what_leaked"] = leakCheck.WhatLeaked.EnsureSentenceEnd(),
            }));

        // A withheld close ratchets the conversation past its end, so tell the generator it is over.
        if (leakCheck.WithholdsClose)
            flagged.Add(notes.WithheldClose);

        // A switched language leaves the candidate reading a reply they may not understand, so send it back.
        if (languageCheck.SwitchesLanguage)
            flagged.Add(notes.LanguageSwitch);

        // Nothing flagged means no revision; otherwise mark the instructions so the prompt reads them as one.
        return flagged.Count == 0 ? null : WrapRevision(notes.Revision, flagged.ToJoinedString(" "));
    }

    /// <summary>
    /// Marks one or more instructions to the generator as a revision to make.
    /// </summary>
    /// <param name="revisionNote">The wrapper note, carrying the placeholder the instructions go in.</param>
    /// <param name="instructions">What the generator has to fix.</param>
    /// <returns>The revision note ready for the prompt.</returns>
    private static string WrapRevision(string revisionNote, string instructions) =>
        FillTemplate(revisionNote, new Dictionary<string, string> { ["notes"] = instructions });

    /// <summary>
    /// Whether an attempt carries a fault the constrained fallback exists for: a wrong claim, a leak, or a withheld
    /// close. A switched language deliberately isn't one, which is why this reads the reference guards and not the
    /// note the loop runs on. The generator never sees its own rejected draft, so the fallback can only replace a
    /// drifted reply with a claim-less hold, and losing a sharp question over a translation slip is the worse trade:
    /// a wrong-language challenge the candidate can paste into a translator still carries the exam forward.
    /// </summary>
    /// <param name="attempt">The judged attempt.</param>
    /// <returns>True when the attempt must not ship as it stands.</returns>
    private static bool NeedsSafeFallback(ExaminerAttempt attempt) =>
        !attempt.MathCheck.Holds || attempt.LeakCheck.Leaks || attempt.LeakCheck.WithholdsClose;
}

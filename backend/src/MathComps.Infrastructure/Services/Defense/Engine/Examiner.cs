using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
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
/// Implements <see cref="IExaminer"/> over an <see cref="ILlmChatCaller"/> with concurrent guards and capped
/// revisions. <see cref="ExaminerAttempt.NeedsSafeFallback"/> determines when the last draft needs a holding reply.
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

    /// <summary>
    /// Matches the line that opens a section of a note file: a name in square brackets, in any case, so a miscapitalized
    /// name still opens a section of its own.
    /// </summary>
    private static readonly Regex _sectionHeaderPattern = new(
        @"^\[([a-z-]+)\][ \t]*\r?$", RegexOptions.Compiled | RegexOptions.Multiline | RegexOptions.IgnoreCase);

    /// <inheritdoc/>
    public async Task<ExaminerTurnOutcome> NextReplyAsync(
        ExaminerInput input, ModelUsageAccumulator usage, CancellationToken cancellationToken = default)
    {
        // The problem, its reference, and the conversation the turn replies to.
        var (problem, reference, transcript) = input;

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
                problem, reference, conversation, candidateTurn, hintsNote, revisionNote: "", retryNote: "", usage,
                cancellationToken),
        };

        // Regenerate while a check flags the reply, re-verifying each fresh attempt, until the cap runs out.
        while (BuildRevisionNote(attempts[^1], notes) is { } note && attempts.Count <= _settings.MaxRevisions)
        {
            // Regenerate with the turn so far shown and the specific flaw called out, re-verifying the fresh attempt.
            attempts.Add(await GenerateAndVerifyAsync(
                problem, reference, conversation, candidateTurn, hintsNote, note,
                BuildRetryNote(attempts, note, notes, noteStatesLastFlags: true), usage, cancellationToken));
        }

        // Whether the loop ended on a fault the fallback exists for — a draft that must not ship.
        var safeFallback = attempts[^1].NeedsSafeFallback;

        // A still-flagged draft is replaced by a constrained fallback, re-verified for the record and shipped
        // regardless of its verdicts — the least-bad turn left when no clean draft came.
        if (safeFallback)
        {
            // The holding instruction, whatever the surviving fault.
            var holdingNote = WrapRevision(notes.Revision, notes.SafeHold);

            // Generate the fallback under the holding instruction, with the whole turn shown first.
            attempts.Add(await GenerateAndVerifyAsync(
                problem, reference, conversation, candidateTurn, hintsNote, holdingNote,
                BuildRetryNote(attempts, holdingNote, notes, noteStatesLastFlags: false), usage, cancellationToken));
        }

        // Ship the trail, whether it ended on the fallback, and the turn's accrued cost.
        return new ExaminerTurnOutcome(attempts, safeFallback, usage.Accrued);
    }

    /// <inheritdoc/>
    public async Task<ExaminerAttempt> CheckReplyAsync(
        ExaminerInput input, string reply, ModelUsageAccumulator usage, CancellationToken cancellationToken = default)
    {
        // The problem, its reference, and the conversation the reply answers.
        var (problem, reference, transcript) = input;

        // The reply answers the candidate, so refuse a transcript that isn't waiting on the examiner.
        transcript.EnsureAwaitingExaminer();

        // The reply with its math in the project's dollar delimiters, the form every generated draft is judged in.
        var normalizedReply = MathDelimiterNormalizer.Normalize(reply);

        // Time the judging, the only part of an attempt this runs.
        var stopwatch = Stopwatch.StartNew();

        // Judge the reply with every guard, reading it in the conversation it answers.
        var guards = await RunGuardsAsync(
            problem, reference, transcript.ToMarkdown(), transcript.Turns[^1].Text, normalizedReply, usage,
            cancellationToken);

        // Stop the clock now that the reply is judged.
        stopwatch.Stop();

        // The reply as an attempt nothing generated: no revision note, and only the guards' calls behind it.
        return new ExaminerAttempt(
            normalizedReply,
            RevisionNote: "",
            guards.Math.Verdict,
            guards.Leak.Verdict,
            guards.Language.Verdict,
            guards.Route.Verdict,
            guards.Calls,
            (int)stopwatch.ElapsedMilliseconds);
    }

    /// <summary>
    /// Generates one reply and runs every guard over it. The turn's first pass and each revision run this same step,
    /// differing only in what the generator is told about the retry.
    /// </summary>
    /// <param name="problem">The problem that fills the prompts.</param>
    /// <param name="reference">The reference solution that fills the prompts.</param>
    /// <param name="conversation">The conversation so far, the generator answers and the reference guards read the
    /// reply in.</param>
    /// <param name="candidateTurn">The candidate's latest turn, the only context the language check reads.</param>
    /// <param name="hintsNote">The author's-hints guidance for the prompt, or empty for a reference without that
    /// section.</param>
    /// <param name="revisionNote">The flaw to fix on a regenerate, the instruction alone; empty on the first
    /// pass.</param>
    /// <param name="retryNote">The turn so far, then the revision note; empty on the first pass.</param>
    /// <param name="usage">The running spend each call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>The judged attempt.</returns>
    private async Task<ExaminerAttempt> GenerateAndVerifyAsync(
        string problem, string reference, string conversation, string candidateTurn, string hintsNote,
        string revisionNote, string retryNote, ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // Time the whole attempt: writing the draft, then judging it.
        var stopwatch = Stopwatch.StartNew();

        // Generate the reply.
        var (reply, generateCall) = await GenerateAsync(
            problem, reference, conversation, hintsNote, retryNote, usage, cancellationToken);

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
            guards.Route.Verdict,
            [generateCall, .. guards.Calls],
            (int)stopwatch.ElapsedMilliseconds);
    }

    /// <summary>
    /// Runs every guard concurrently over the proposed reply.
    /// </summary>
    /// <param name="problem">The problem the reference guards judge against.</param>
    /// <param name="reference">The reference solution the reference guards judge against.</param>
    /// <param name="conversation">The conversation so far, the context the reference guards read the reply in.</param>
    /// <param name="candidateTurn">The candidate's latest turn, the only context the language check reads.</param>
    /// <param name="reply">The proposed examiner reply under scrutiny.</param>
    /// <param name="usage">The running spend each guard call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the calls.</param>
    /// <returns>Every guard's verdict, each paired with the call that produced it.</returns>
    private async Task<GuardRuns> RunGuardsAsync(
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

        // Check whether the reply follows the candidate's argument.
        var routeCheckTask = RunGuardAsync<RouteCheckResult>(
            ExaminerStep.RouteCheck, _settings.RouteCheck, problem, reference, conversation, reply, usage,
            cancellationToken);

        // Await them all before reading their results.
        await Task.WhenAll(mathCheckTask, leakCheckTask, languageCheckTask, routeCheckTask);

        // The math-check's run as it came back.
        var mathRun = mathCheckTask.Result;

        // The same run with the solution complete whenever the checker names nothing still owed: the owed list is what
        // its completeness verdict is decided from, and an open solution with nothing on that list leaves no step to
        // ask about.
        var reconciledMathRun = mathRun with
        {
            Verdict = mathRun.Verdict with
            {
                Complete = mathRun.Verdict.Complete || string.IsNullOrWhiteSpace(mathRun.Verdict.Owed),
            },
        };

        // Hand back every guard's run.
        return new GuardRuns(
            reconciledMathRun, leakCheckTask.Result, languageCheckTask.Result, routeCheckTask.Result);
    }

    /// <summary>
    /// Every guard's run over one reply, each reachable by the guard's name.
    /// </summary>
    /// <param name="Math">The math-check's run.</param>
    /// <param name="Leak">The leak-check's run.</param>
    /// <param name="Language">The language check's run.</param>
    /// <param name="Route">The route-check's run.</param>
    private sealed record GuardRuns(
        GuardRun<MathCheckResult> Math,
        GuardRun<LeakCheckResult> Leak,
        GuardRun<LanguageCheckResult> Language,
        GuardRun<RouteCheckResult> Route)
    {
        /// <summary>
        /// The call each guard made, in the order the guards were started.
        /// </summary>
        public IReadOnlyList<ExaminerStepCall> Calls => [Math.Call, Leak.Call, Language.Call, Route.Call];
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
    /// <param name="TurnSoFar">The wording a retry shows the turn's earlier drafts and their verdicts in.</param>
    /// <param name="WrongClaim">The instruction for a reply the math-check found a wrong claim in.</param>
    /// <param name="Leak">The instruction for a reply the leak-check found hands away earned progress.</param>
    /// <param name="EarlyClose">The instruction for a reply that ends the examination while a step is still
    /// owed.</param>
    /// <param name="LanguageSwitch">The instruction for a reply that drifted out of the candidate's language.</param>
    /// <param name="GenderedAddress">The instruction for a reply whose wording assumes the candidate's gender.</param>
    /// <param name="Route">The revision instruction for a takeover.</param>
    /// <param name="SafeHold">The instruction a draft that outlasted the revision cap is replaced under.</param>
    /// <param name="AuthorHints">The guidance for using the author's staged hints.</param>
    private sealed record Notes(
        string Revision,
        TurnSoFarNote TurnSoFar,
        string WrongClaim,
        string Leak,
        string EarlyClose,
        string LanguageSwitch,
        string GenderedAddress,
        string Route,
        string SafeHold,
        string AuthorHints);

    /// <summary>
    /// The wording a retry shows the turn so far in: a frame, a template for one draft, and for each check a line saying
    /// it passed and a line per thing it can flag. The file holds one section per member, each opened by its name in
    /// square brackets.
    /// </summary>
    /// <param name="Turn">The frame around the drafts and the revision instruction.</param>
    /// <param name="Draft">One draft, with its verdict lines under it.</param>
    /// <param name="MathPassed">The line for a draft the math-check cleared.</param>
    /// <param name="MathWrongClaim">The line for a draft with a wrong claim in it.</param>
    /// <param name="MathEndedEarly">The line for a draft that ended the examination while a step was owed.</param>
    /// <param name="LeakPassed">The line for a draft the leak-check cleared.</param>
    /// <param name="LeakGaveAway">The line for a draft that handed away earned progress.</param>
    /// <param name="LanguagePassed">The line for a draft the language check cleared.</param>
    /// <param name="LanguageSwitched">The line for a draft that drifted out of the candidate's language.</param>
    /// <param name="LanguageGendered">The line for a draft whose wording assumed the candidate's gender.</param>
    /// <param name="RoutePassed">The line for a draft the route check cleared.</param>
    /// <param name="RouteTookOver">The line for a draft that left the candidate's argument for its own.</param>
    private sealed record TurnSoFarNote(
        string Turn,
        string Draft,
        string MathPassed,
        string MathWrongClaim,
        string MathEndedEarly,
        string LeakPassed,
        string LeakGaveAway,
        string LanguagePassed,
        string LanguageSwitched,
        string LanguageGendered,
        string RoutePassed,
        string RouteTookOver);

    /// <summary>
    /// Runs the generate step: the persona prompt (problem, reference, the author's-hints guidance when the reference
    /// carries that section, and any retry note) becomes the system message, and the conversation so far becomes the
    /// user message.
    /// </summary>
    /// <param name="problem">The problem that fills the prompt.</param>
    /// <param name="reference">The reference solution that fills the prompt.</param>
    /// <param name="conversation">The conversation so far, the examiner responds to.</param>
    /// <param name="hintsNote">The author's-hints guidance for the prompt, or empty for a reference without that
    /// section.</param>
    /// <param name="retryNote">The turn so far and the flaw to fix on a regenerate, or empty on the first pass.</param>
    /// <param name="usage">The running spend this call folds its cost into.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The generated reply, and the call that wrote it.</returns>
    private async Task<(string Reply, ExaminerStepCall Call)> GenerateAsync(
        string problem, string reference, string conversation, string hintsNote, string retryNote,
        ModelUsageAccumulator usage, CancellationToken cancellationToken)
    {
        // Fill the persona prompt with the problem, the reference, the hints guidance, and the retry note (empty
        // most turns).
        var systemPrompt = FillTemplate(await ReadPromptAsync(_settings.Generate.Prompt, cancellationToken),
            new Dictionary<string, string>
            {
                ["problem"] = problem,
                ["reference"] = reference,
                ["hints_note"] = hintsNote,
                ["revision_note"] = retryNote,
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
    /// step's settings, so a session's trail can be read against the config snapshot taken when it started. A blank
    /// level is recorded as none, because the call sends no level for it. The model comes off the reply instead,
    /// because a fallback chain means the settings only say which model was asked for.
    /// </summary>
    /// <typeparam name="TResult">The shape the call's reply was read into.</typeparam>
    /// <param name="stepKind">Which step made the call.</param>
    /// <param name="step">The step's model and reasoning configuration.</param>
    /// <param name="result">The call's reply, carrying the model that answered and what it billed.</param>
    /// <param name="elapsedMs">How long the call took, in milliseconds.</param>
    /// <returns>The recorded call.</returns>
    private static ExaminerStepCall BuildStepCall<TResult>(
        ExaminerStep stepKind, ChatStepSettings step, ChatCallResult<TResult> result, long elapsedMs) =>
        new(
            stepKind,
            result.ServedModel,
            string.IsNullOrWhiteSpace(step.ReasoningEffort) ? null : step.ReasoningEffort,
            result.Usage,
            (int)elapsedMs);

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
            await ReadTurnSoFarNoteAsync(paths.TurnSoFar, cancellationToken),
            await ReadNoteAsync(paths.WrongClaim, ["correction"], cancellationToken),
            await ReadNoteAsync(paths.Leak, ["what_leaked"], cancellationToken),
            await ReadNoteAsync(paths.EarlyClose, ["owed"], cancellationToken),
            await ReadNoteAsync(paths.LanguageSwitch, [], cancellationToken),
            await ReadNoteAsync(paths.GenderedAddress, [], cancellationToken),
            await ReadNoteAsync(paths.Route, ["work"], cancellationToken),
            await ReadNoteAsync(paths.SafeHold, [], cancellationToken),
            await ReadNoteAsync(paths.AuthorHints, [], cancellationToken));
    }

    /// <summary>
    /// Reads one note and checks it: see <see cref="CheckNote"/>.
    /// </summary>
    /// <param name="path">The note's path.</param>
    /// <param name="tokens">The placeholder names this note may carry.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The note's text.</returns>
    private async Task<string> ReadNoteAsync(
        string path, IReadOnlyCollection<string> tokens, CancellationToken cancellationToken) =>
        CheckNote(await ReadPromptAsync(path, cancellationToken), $"The examiner note at '{path}'", tokens);

    /// <summary>
    /// Reads the turn-so-far note, a file of named sections, and checks each section the way a whole note is checked.
    /// A section the engine reads that the file lacks is refused, and so is one the file holds that the engine never
    /// reads, whose wording would reach no retry with nothing to flag it.
    /// </summary>
    /// <param name="path">The note's path.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The note's sections.</returns>
    private async Task<TurnSoFarNote> ReadTurnSoFarNoteAsync(string path, CancellationToken cancellationToken)
    {
        // The file's sections by name. Each one read is taken out, so what is left at the end is read by nobody.
        var sections = SplitSections(await ReadPromptAsync(path, cancellationToken), $"The examiner note at '{path}'");

        // Takes one section out and checks it, giving it the tokens it may carry.
        string Section(string name, params string[] tokens)
        {
            // A section the file doesn't hold has nothing to show.
            if (!sections.Remove(name, out var text))
                throw new InvalidOperationException($"The examiner note at '{path}' has no [{name}] section.");

            // Hand back the section, checked.
            return CheckNote(text, $"The [{name}] section of the examiner note at '{path}'", tokens);
        }

        // Read every section the engine uses.
        var note = new TurnSoFarNote(
            Section("turn", "drafts", "fix"),
            Section("draft", "number", "reply", "verdicts"),
            Section("math-passed"),
            Section("math-wrong-claim", "correction"),
            Section("math-ended-early", "owed"),
            Section("leak-passed"),
            Section("leak-gave-away", "what_leaked"),
            Section("language-passed"),
            Section("language-switched"),
            Section("language-gendered"),
            Section("route-passed"),
            Section("route-took-over", "work"));

        // A section left over is a misspelt name or one nothing reads.
        if (sections.Keys.FirstOrDefault() is { } unread)
            throw new InvalidOperationException(
                $"The examiner note at '{path}' has a [{unread}] section nothing reads.");

        // Hand back the note.
        return note;
    }

    /// <summary>
    /// Cuts a file of sections apart. A section opens on a line carrying its name in square brackets and runs to the
    /// next such line or the end of the file. Text above the first one belongs to no section, so it is refused rather
    /// than dropped where nothing would flag it. A name opening two sections is refused too.
    /// </summary>
    /// <param name="text">The file's text.</param>
    /// <param name="description">What the refusal calls the file.</param>
    /// <returns>Each section's text, untrimmed, by name.</returns>
    private static Dictionary<string, string> SplitSections(string text, string description)
    {
        // Every line that opens a section, in file order.
        var headers = _sectionHeaderPattern.Matches(text).ToList();

        // Refuse text standing above the first section, which no section would carry to the model.
        if (text[..(headers.FirstOrDefault()?.Index ?? text.Length)].Trim().Length > 0)
            throw new InvalidOperationException($"{description} has text above its first section.");

        // The first name that opens more than one section, which would leave all but one of them unread.
        var repeated = headers
            .GroupBy(header => header.Groups[1].Value)
            .FirstOrDefault(group => group.Count() > 1);

        // Refuse the repeated section by name.
        if (repeated is not null)
            throw new InvalidOperationException($"{description} has more than one [{repeated.Key}] section.");

        // Where each section ends: at the next header, or at the end of the file for the last.
        var ends = headers.Skip(1).Select(header => header.Index).Append(text.Length);

        // Each section runs from the end of its header to where it ends.
        return headers
            .Zip(ends, (header, end) => (
                Name: header.Groups[1].Value,
                Text: text[(header.Index + header.Length)..end]))
            .ToDictionary(section => section.Name, section => section.Text);
    }

    /// <summary>
    /// Checks one note, refusing an empty one, any placeholder nothing fills, and any placeholder it should carry but
    /// doesn't. Braces nothing fills would reach the model as literal text in the examiner's instructions, and a
    /// missing placeholder would silently drop the value it shows, neither of which a gate or a guard would flag. The
    /// text is trimmed, so a file's trailing newline can't land in the middle of a joined revision instruction.
    /// </summary>
    /// <param name="text">The note as the file holds it.</param>
    /// <param name="description">What the refusal calls the note.</param>
    /// <param name="tokens">The placeholder names this note carries.</param>
    /// <returns>The note's text.</returns>
    private static string CheckNote(string text, string description, IReadOnlyCollection<string> tokens)
    {
        // The note without the whitespace the file wraps it in.
        var trimmed = text.Trim();

        // An empty note instructs the model in nothing. The revision note is the costly one: it would still read as
        // a note, so the loop would send every flagged draft back and burn its whole cap under no instruction.
        if (trimmed.Length == 0)
            throw new InvalidOperationException($"{description} is empty.");

        // The note's first placeholder that nothing fills.
        var unfilled = _placeholderPattern.Matches(trimmed)
            .Select(match => match.Groups[1].Value)
            .FirstOrDefault(token => !tokens.Contains(token));

        // Refuse a note carrying a hole nothing fills.
        if (unfilled is not null)
            throw new InvalidOperationException(
                $"{description} carries a '{{{unfilled}}}' placeholder that nothing fills.");

        // The note's first placeholder that it should carry and doesn't.
        var missing = tokens.FirstOrDefault(token => !trimmed.Contains($"{{{token}}}", StringComparison.Ordinal));

        // Refuse a note that would drop the value meant for that placeholder.
        if (missing is not null)
            throw new InvalidOperationException($"{description} has no '{{{missing}}}' placeholder.");

        // Hand back the note.
        return trimmed;
    }

    /// <summary>
    /// Combines the guards' revision instructions, or returns null when every guard clears the reply.
    /// </summary>
    /// <param name="attempt">The judged attempt.</param>
    /// <param name="notes">The turn's notes: the wrapper and an instruction per flaw.</param>
    /// <returns>The revision note to feed the generator, or null when nothing flagged.</returns>
    private static string? BuildRevisionNote(ExaminerAttempt attempt, Notes notes)
    {
        // Pull the verdicts the note reads.
        var (_, _, mathCheck, leakCheck, languageCheck, routeCheck, _, _) = attempt;

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

        // An ending before the solution is complete tells the candidate they are done when they aren't, so send it
        // back with what is still owed. The opposite case, a question on a solution the math-check calls complete,
        // goes out as drafted: that verdict is wrong often enough that acting on it would end conversations on a
        // gap, and one question too many costs the candidate far less.
        if (mathCheck.ClosesEarly)
            flagged.Add(FillTemplate(notes.EarlyClose, new Dictionary<string, string>
            {
                ["owed"] = mathCheck.Owed.EnsureSentenceEnd(),
            }));

        // Bring a takeover back to the candidate's own work.
        if (routeCheck.TakesOver)
            flagged.Add(FillTemplate(notes.Route, new Dictionary<string, string>
            {
                ["work"] = routeCheck.Work.EnsureSentenceEnd(),
            }));

        // A switched language leaves the candidate reading a reply they may not understand, so send it back.
        if (languageCheck.SwitchesLanguage)
            flagged.Add(notes.LanguageSwitch);

        // A guessed gender tells the candidate something about themselves the examiner cannot know, so send it back.
        if (languageCheck.GendersTheReader)
            flagged.Add(notes.GenderedAddress);

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
    /// Builds what the generator reads on a retry: every earlier draft of the turn in order, each with every check's
    /// verdict on it, and then the revision note. Only the generator reads it: each check judges its draft alone.
    /// </summary>
    /// <param name="attempts">Every attempt so far, oldest first.</param>
    /// <param name="revisionNote">The instruction for the retry.</param>
    /// <param name="notes">The turn's notes: the wording the history is shown in.</param>
    /// <param name="noteStatesLastFlags">Whether the instruction was built from the last draft's flags, which it then
    /// already states. That draft lists only the checks it passed, so no flag is said twice.</param>
    /// <returns>The note to feed the generator.</returns>
    private static string BuildRetryNote(
        IReadOnlyList<ExaminerAttempt> attempts, string revisionNote, Notes notes, bool noteStatesLastFlags)
    {
        // Each attempt as a numbered draft with its verdicts under it, a blank line between drafts. The last one leaves
        // its flags to the instruction when that instruction states them.
        var drafts = attempts
            .Select((attempt, index) => FillTemplate(notes.TurnSoFar.Draft, new Dictionary<string, string>
            {
                ["number"] = (index + 1).ToString(CultureInfo.InvariantCulture),
                ["reply"] = attempt.Reply,
                ["verdicts"] = DescribeVerdicts(
                    attempt, notes.TurnSoFar, flagsShown: !(noteStatesLastFlags && index == attempts.Count - 1)),
            }))
            .ToJoinedString("\n\n");

        // The drafts, then the instruction for this retry.
        return FillTemplate(notes.TurnSoFar.Turn, new Dictionary<string, string>
        {
            ["drafts"] = drafts,
            ["fix"] = revisionNote,
        });
    }

    /// <summary>
    /// Writes out what every check said about one attempt: a line per thing a check flagged, or a line saying it passed
    /// when it flagged nothing.
    /// </summary>
    /// <param name="attempt">The judged attempt.</param>
    /// <param name="note">The wording the verdicts are written in.</param>
    /// <param name="flagsShown">Whether the lines for what the checks flagged are written, or only the passes. The flags
    /// are written anyway when no check passed, so the list is never empty.</param>
    /// <returns>One line per verdict, in the order the checks run.</returns>
    private static string DescribeVerdicts(ExaminerAttempt attempt, TurnSoFarNote note, bool flagsShown)
    {
        // Pull the verdicts the lines read.
        var (_, _, mathCheck, leakCheck, languageCheck, routeCheck, _, _) = attempt;

        // What the math-check flagged. A draft can trip both of its flags.
        var math = new List<string>();

        // A wrong claim, with the correction.
        if (!mathCheck.Holds)
            math.Add(FillTemplate(note.MathWrongClaim, new Dictionary<string, string>
            {
                ["correction"] = mathCheck.Correction.EnsureSentenceEnd(),
            }));

        // An ending before the solution is complete, with what is still owed.
        if (mathCheck.ClosesEarly)
            math.Add(FillTemplate(note.MathEndedEarly, new Dictionary<string, string>
            {
                ["owed"] = mathCheck.Owed.EnsureSentenceEnd(),
            }));

        // What the leak-check flagged.
        var leak = new List<string>();

        // Earned progress handed away, with what it was.
        if (leakCheck.Leaks)
            leak.Add(FillTemplate(note.LeakGaveAway, new Dictionary<string, string>
            {
                ["what_leaked"] = leakCheck.WhatLeaked.EnsureSentenceEnd(),
            }));

        // What the language check flagged. A draft can trip both of its flags.
        var language = new List<string>();

        // A drift out of the candidate's language.
        if (languageCheck.SwitchesLanguage)
            language.Add(note.LanguageSwitched);

        // A word that guesses the candidate's gender.
        if (languageCheck.GendersTheReader)
            language.Add(note.LanguageGendered);

        // What the route check flagged.
        var route = new List<string>();

        // A takeover, with what the candidate actually brought.
        if (routeCheck.TakesOver)
            route.Add(FillTemplate(note.RouteTookOver, new Dictionary<string, string>
            {
                ["work"] = routeCheck.Work.EnsureSentenceEnd(),
            }));

        // Each check's flags beside its passing line, in the order the checks run.
        var checks = new[]
        {
            (Flags: math, Passed: note.MathPassed),
            (Flags: leak, Passed: note.LeakPassed),
            (Flags: language, Passed: note.LanguagePassed),
            (Flags: route, Passed: note.RoutePassed),
        };

        // Hidden flags still show when no check passed, so the draft never stands over an empty list.
        var showFlags = flagsShown || checks.All(check => check.Flags.Count > 0);

        // Each check's passing line when it raised nothing, else its flags when those show.
        return checks
            .SelectMany(check => check.Flags.Count == 0 ? [check.Passed] : showFlags ? check.Flags : [])
            .ToJoinedString("\n");
    }
}

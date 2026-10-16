import type { JwtPayload } from '@clerk/types'
import type { Locator, Page, Request, Route } from '@playwright/test'

import { MAX_CHARACTERS_PER_COMMENT } from '@/components/features/comments/model/comment-limits'
import type {
  CommentDto,
  CommentReactionKind,
  CommentTarget,
  CommentTargetType,
  UpdateCommentResult,
} from '@/components/features/comments/services/comment-api-types'
import type {
  HandoutIndex,
  HandoutMetadata,
} from '@/components/features/handouts/handout-metadata-types'
import type { UserProfile } from '@/components/features/profile/model/profile-types'
import { parseMember } from '@/components/shared/utils/collection-utils'
import handoutIndex from '@/content/handouts.json'
import { ROUTES } from '@/i18n/i18n'

import { answerJson, BACKEND_ORIGIN, refuse } from './backend-routes'
import { expect } from './test'

/**
 * The id the fake keeps the signed-in reader's comments and reactions under. An answer to a signed-in call swaps it
 * for the id their sign-in gave them, so a comment kept under it reads as the reader's own.
 */
export const READER_ID = 'reader'

/** The username of the reader a test signs in as. */
export const READER_NAME = 'Rita'

/** The path every call into a thread starts with, and the whole path of a read of one thread. */
export const THREADS_PATH = new URL(`${BACKEND_ORIGIN}/comments`).pathname

/**
 * The handout whose page the comment specs read a thread on: a short one, closed by its thread. Looked up on
 * each call, so a spec that only imports this module never depends on the handout being there.
 *
 * @returns The handout.
 */
function threadHandout(): HandoutMetadata {
  // The handout, by its English slug
  const handout = (handoutIndex as unknown as HandoutIndex).sections
    .flatMap((section) => section.handouts)
    .find((listed) => listed.slug.en === 'combinatorial-games')

  // Gone from the index, which would leave every spec reading a page that isn't there
  if (handout === undefined)
    throw new Error('The handout the comment specs read is gone from the index.')

  // The handout
  return handout
}

/**
 * The page holding the thread the comment specs read.
 *
 * @returns The page's path, in English.
 */
export function threadPage(): string {
  // The handout's page, by its English slug
  return `/en${ROUTES.HANDOUTS}/${threadHandout().slug.en}`
}

/**
 * A comment sent into a thread.
 */
type CommentSent = {
  /** What the write was. */
  kind: 'sent'
  /** The thread it went into, by {@link threadKey}. */
  thread: string
  /** What it says. */
  content: string
  /** The comment it replies to, or null for a top-level comment. */
  parentCommentId: string | null
}

/**
 * A comment's text, rewritten by its author.
 */
type CommentEdited = {
  /** What the write was. */
  kind: 'edited'
  /** The comment, by the id of the version rewritten. */
  commentId: string
  /** What it says now. */
  content: string
}

/**
 * A comment deleted by its author.
 */
type CommentDeleted = {
  /** What the write was. */
  kind: 'deleted'
  /** The comment. */
  commentId: string
}

/**
 * A reaction pressed on a comment.
 */
type ReactionPressed = {
  /** What the write was. */
  kind: 'pressed'
  /** The comment. */
  commentId: string
  /** The reaction pressed. */
  reaction: CommentReactionKind
}

/** One write the app sent into a thread. */
type CommentWrite = CommentSent | CommentEdited | CommentDeleted | ReactionPressed

/**
 * Which threads the fake keeps, and how it answers writes into them.
 *
 * @template TThread - The kinds of thread the fake keeps.
 */
type CommentsBackendOptions<TThread extends CommentTargetType> = {
  /** The kinds of thread the fake keeps. A call about any other kind goes to the stubs beneath. */
  threadTypes: readonly TThread[]
  /** Whether the backend holds what a thread hangs off. A thread hanging off nothing is refused. */
  holds?: (targetType: TThread, targetId: string) => boolean
  /** Whether a write fails, the way a server failing it would answer. */
  fails?: (write: CommentWrite) => boolean
}

/**
 * A comment the fake keeps, with the thread it is kept in.
 */
type LocatedComment = {
  /** The thread holding it, by {@link threadKey}. */
  key: string
  /** The comment as it stands. */
  comment: CommentDto
}

/**
 * Body of a request writing a comment, in as much of it as the fake reads.
 */
type CreateBody = {
  /** The thread it goes into. */
  target: CommentTarget
  /** What it says. */
  content: string
  /** The comment it replies to, or null for a top-level comment. */
  parentCommentId: string | null
}

/**
 * Body of a request rewriting a comment.
 */
type EditBody = {
  /** What the comment says now. */
  content: string
}

/**
 * Body of a request pressing a reaction.
 */
type PressBody = {
  /** The reaction pressed. */
  kind: CommentReactionKind
}

/**
 * Where the backend keeps one thread.
 *
 * @param targetType - The kind of thread.
 * @param targetId - Which thread of that kind.
 *
 * @returns The key, naming the thread by its kind and its id together.
 */
export function threadKey(targetType: CommentTargetType, targetId: string): string {
  // The kind and the id, which together name one thread
  return `${targetType}:${targetId}`
}

/**
 * Gives the signed-in reader the username {@link READER_NAME}, which a thread asks for before it takes a comment.
 *
 * @param page - The page to answer the reader's profile on.
 */
export async function stubNamedReader(page: Page): Promise<void> {
  // The reader's profile, carrying the username
  await page.route(`${BACKEND_ORIGIN}/users/me/profile`, (route) =>
    answerJson(route, 200, {
      graduationYear: null,
      hasLeftHighSchool: true,
      countryCode: null,
      email: null,
      username: READER_NAME,
    } satisfies UserProfile)
  )
}

/**
 * A comment standing on its own, written now, with no reactions and no replies yet.
 *
 * @param authorId - Its author's id with the sign-in provider, {@link READER_ID} for the reader's own.
 * @param authorName - Its author's username, or null when they have none.
 * @param content - What it says.
 *
 * @returns The comment.
 */
export function commentFrom(
  authorId: string,
  authorName: string | null,
  content: string
): CommentDto {
  // The comment, under an id of its own
  return {
    id: crypto.randomUUID(),
    author: { id: authorId, name: authorName, avatarUrl: null },
    content,
    createdAt: new Date().toISOString(),
    editedAt: null,
    isDeleted: false,
    reactions: [],
    replies: [],
  }
}

/**
 * Stands in for the backend behind every handout's thread, {@link threadPage}'s seeded with the comments given, and
 * leaves every other kind of thread to the stubs beneath.
 *
 * @param page - The page to answer the thread's calls on.
 * @param comments - The thread's comments, oldest first, replies nested.
 * @param fails - A function saying whether a write fails, the way a server failing it would answer.
 *
 * @returns A function reading every write the app sent so far, oldest first, whatever became of each.
 */
export function stubPageThread(
  page: Page,
  comments: CommentDto[],
  fails?: (write: CommentWrite) => boolean
): Promise<() => CommentWrite[]> {
  // The fake, seeded with the handout's thread
  return stubComments(page, new Map([[threadKey('Handout', threadHandout().id), comments]]), {
    threadTypes: ['Handout'],
    fails,
  })
}

/**
 * Writes a comment into a thread's box and sends it from the keyboard, waiting for the box to empty, which it
 * does once the comment has been taken.
 *
 * @param box - The box a new comment is written in.
 * @param text - The comment.
 */
export async function sendComment(box: Locator, text: string): Promise<void> {
  // The comment, written
  await box.fill(text)

  // Sent from the keyboard
  await box.press('Meta+Enter')

  // Taken
  await expect(box).toHaveValue('')
}

/**
 * One comment of a thread, as the innermost block holding both its author's name and what it says. A comment
 * holds its replies, so every block around it holds both as well, and a reply holds nothing its parent says.
 *
 * @param page - The page.
 * @param author - The name the comment is signed with.
 * @param content - Some of what the comment says.
 *
 * @returns The comment, its header with its buttons included.
 */
export function commentBy(page: Page, author: string, content: string): Locator {
  // The last of the blocks holding both, which is the deepest
  return page.locator('div').filter({ hasText: author }).filter({ hasText: content }).last()
}

/**
 * Whether the backend refuses what a comment says: no text at all, or more than a comment may carry.
 *
 * @param content - What the comment says, as the app sent it.
 *
 * @returns `true` when the content is refused.
 */
function isRefusedContent(content: string): boolean {
  // The text it carries, the whitespace around it counting for nothing
  const carried = content.trim()

  // Nothing at all, or past the ceiling
  return carried === '' || carried.length > MAX_CHARACTERS_PER_COMMENT
}

/**
 * Who sent a call, by the session token riding along with it.
 *
 * @param request - The call.
 *
 * @returns The sender's id with the sign-in provider, or null for a visitor.
 */
export function senderOf(request: Request): string | null {
  // The token, where one rides along
  const token = request.headers().authorization?.replace(/^Bearer /, '')

  // A visitor sends none
  if (token === undefined) return null

  // The claims, the middle of the token's three parts
  const claims = JSON.parse(
    Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')
  ) as JwtPayload

  // The subject, who the session belongs to
  return claims.sub
}

/**
 * A comment as the call's sender gets it, {@link READER_ID} swapped for the id their sign-in gave them.
 *
 * @param comment - The comment as the fake keeps it.
 * @param sender - Who sent the call, or null for a visitor.
 *
 * @returns The comment, replies and reactions included.
 */
export function asSentTo(comment: CommentDto, sender: string | null): CommentDto {
  // A function which gives the reader the sender's id, and anybody else their own
  const idOf = (userId: string) => (userId === READER_ID && sender !== null ? sender : userId)

  // The comment, every id in it given as the sender knows it
  return {
    ...comment,
    author: { ...comment.author, id: idOf(comment.author.id) },
    reactions: comment.reactions.map((reaction) => ({
      ...reaction,
      userId: idOf(reaction.userId),
    })),
    replies: comment.replies.map((reply) => asSentTo(reply, sender)),
  }
}

/**
 * Finds a comment in a thread, at any depth.
 *
 * @param comments - The thread, or a comment's replies.
 * @param commentId - The comment's id.
 *
 * @returns The comment, or undefined when the thread holds none with that id.
 */
function findIn(comments: CommentDto[], commentId: string): CommentDto | undefined {
  // The comment at this depth, or the first found under one
  return comments
    .map((comment) => (comment.id === commentId ? comment : findIn(comment.replies, commentId)))
    .find((found) => found !== undefined)
}

/**
 * Changes one comment of a thread, at any depth.
 *
 * @param comments - The thread, or a comment's replies.
 * @param commentId - The comment's id.
 * @param change - A function which gives the comment as it becomes.
 *
 * @returns The thread with the comment changed.
 */
function changeIn(
  comments: CommentDto[],
  commentId: string,
  change: (comment: CommentDto) => CommentDto
): CommentDto[] {
  // Each comment, the one named changed and every other with its replies searched
  return comments.map((comment) =>
    comment.id === commentId
      ? change(comment)
      : { ...comment, replies: changeIn(comment.replies, commentId, change) }
  )
}

/**
 * Presses a reaction for the reader, the way the backend does: pressing the one they hold takes it back, and any
 * other press leaves them holding this one, newest of all.
 *
 * @param comment - The comment pressed on.
 * @param reaction - The reaction pressed.
 *
 * @returns The comment with the reader's reaction as it stands after the press.
 */
function pressedOn(comment: CommentDto, reaction: CommentReactionKind): CommentDto {
  // The reaction the reader held before the press
  const held = comment.reactions.find((given) => given.userId === READER_ID)

  // Everybody else's, as they were
  const others = comment.reactions.filter((given) => given.userId !== READER_ID)

  // The same one again takes it back
  if (held?.kind === reaction) return { ...comment, reactions: others }

  // Otherwise the reader holds this one, newest of all
  return {
    ...comment,
    reactions: [...others, { userId: READER_ID, name: READER_NAME, kind: reaction }],
  }
}

/**
 * Stands in for the backend's comment threads: each read, written into, edited, deleted and reacted to, the reader's
 * writes kept under {@link READER_ID}. Anything about a thread the fake does not keep goes to the stubs beneath.
 *
 * @param page - The page to answer the threads' calls on.
 * @param threads - Each thread's comments, by {@link threadKey}, oldest first, replies nested, which each write
 * that goes through changes.
 * @param options - Which threads the fake keeps, and how it answers writes into them.
 *
 * @returns A function reading every write the app sent so far, oldest first, whatever became of each.
 */
export async function stubComments<TThread extends CommentTargetType>(
  page: Page,
  threads: Map<string, CommentDto[]>,
  { threadTypes, holds = () => true, fails = () => false }: CommentsBackendOptions<TThread>
): Promise<() => CommentWrite[]> {
  // Every write the app sent, in the order it arrived
  const writes: CommentWrite[] = []

  // Every version an edit has replaced, by its id
  const supersededVersions = new Map<string, LocatedComment>()

  // A function which finds the thread holding a comment, and the comment in it
  const locate = (commentId: string): LocatedComment | undefined =>
    [...threads.entries()].flatMap(([key, comments]) => {
      // The comment, if this thread holds it
      const comment = findIn(comments, commentId)

      // Kept only where it does
      return comment === undefined ? [] : [{ key, comment }]
    })[0]

  // A function which changes a comment where it stands in its thread
  const change = (key: string, commentId: string, changed: (comment: CommentDto) => CommentDto) =>
    threads.set(key, changeIn(threads.get(key) ?? [], commentId, changed))

  // A function which answers every call into a thread
  const answer = async (route: Route) => {
    // The call as it went out
    const request = route.request()

    // Who sent it
    const sender = senderOf(request)

    // The comment the call names and what it does to it, read off the path below the threads' own address
    const [, commentId, action] = new URL(request.url()).pathname
      .slice(THREADS_PATH.length)
      .split('/')

    // A thread read, by what it hangs off
    if (request.method() === 'GET' && commentId === undefined) {
      // Which thread
      const query = new URL(request.url()).searchParams

      // The kind of thread, if the fake keeps it
      const targetType = parseMember(query.get('targetType'), threadTypes)

      // Another kind of thread
      if (targetType === null) return route.fallback()

      // What it hangs off
      const targetId = query.get('targetId') ?? ''

      // Something the backend does not hold has no thread to read
      if (!holds(targetType, targetId)) return refuse(route, 404, 'CommentTargetNotFound')

      // Every comment in it, oldest first
      const comments = threads.get(threadKey(targetType, targetId)) ?? []

      // As the sender gets them
      return answerJson(
        route,
        200,
        comments.map((comment) => asSentTo(comment, sender))
      )
    }

    // A comment written into a thread
    if (request.method() === 'POST' && commentId === undefined) {
      // What was written, and where
      const { target, content, parentCommentId } = request.postDataJSON() as CreateBody

      // The kind of thread, if the fake keeps it
      const targetType = parseMember(target.targetType, threadTypes)

      // Another kind of thread
      if (targetType === null) return route.fallback()

      // Where the thread is kept
      const key = threadKey(targetType, target.targetId)

      // What the app sent
      const write: CommentSent = { kind: 'sent', thread: key, content, parentCommentId }

      // The write, noted whatever becomes of it
      writes.push(write)

      // Only somebody signed in writes
      if (sender === null) return route.fulfill({ status: 401 })

      // A comment says something, and no more than a comment may carry
      if (isRefusedContent(content)) return refuse(route, 400, 'CommentValue')

      // Something the backend does not hold takes no comment
      if (!holds(targetType, target.targetId)) return refuse(route, 404, 'CommentTargetNotFound')

      // The comment a reply answers, which has to be in the thread and standing
      const parent =
        parentCommentId === null ? null : findIn(threads.get(key) ?? [], parentCommentId)

      // Missing or deleted, so there is nothing to answer
      if (parent === undefined || parent?.isDeleted) return refuse(route, 404, 'CommentNotFound')

      // Failed, the way a server falling over answers, where the test has it fail
      if (fails(write)) return route.fulfill({ status: 500 })

      // The comment, signed by the reader
      const comment = commentFrom(READER_ID, READER_NAME, content)

      // At the end of the thread, or of the replies to the comment it answers
      threads.set(
        key,
        parentCommentId === null
          ? [...(threads.get(key) ?? []), comment]
          : changeIn(threads.get(key) ?? [], parentCommentId, (answered) => ({
              ...answered,
              replies: [...answered.replies, comment],
            }))
      )

      // Answered with the comment, as created
      return answerJson(route, 201, asSentTo(comment, sender))
    }

    // Any other call names a comment, which the fake looks for among its threads and the versions edits replaced
    const found =
      commentId === undefined ? undefined : (locate(commentId) ?? supersededVersions.get(commentId))

    // A comment of a thread the fake does not keep, or none at all
    if (found === undefined || commentId === undefined) return route.fallback()

    // The thread holding it, and the comment as it stands
    const { key, comment } = found

    // Whether an edit has replaced it, which the backend refuses like a comment that is not there
    const isSuperseded = supersededVersions.has(commentId)

    // The comment rewritten by its author
    if (request.method() === 'PUT' && action === undefined) {
      // What it says now
      const { content } = request.postDataJSON() as EditBody

      // What the app sent
      const write: CommentEdited = { kind: 'edited', commentId, content }

      // The write, noted whatever becomes of it
      writes.push(write)

      // Only somebody signed in edits
      if (sender === null) return route.fulfill({ status: 401 })

      // A comment says something, and no more than a comment may carry
      if (isRefusedContent(content)) return refuse(route, 400, 'CommentValue')

      // A version an edit replaced is gone
      if (isSuperseded) return refuse(route, 404, 'CommentNotFound')

      // Only its author rewrites it
      if (comment.author.id !== READER_ID) return refuse(route, 403, 'NotCommentAuthor')

      // A deleted comment stays deleted
      if (comment.isDeleted) return refuse(route, 404, 'CommentNotFound')

      // Failed, the way a server falling over answers, where the test has it fail
      if (fails(write)) return route.fulfill({ status: 500 })

      // The new version, under a new id, stamped as edited now
      const result: UpdateCommentResult = {
        id: crypto.randomUUID(),
        editedAt: new Date().toISOString(),
      }

      // The old version, kept to refuse a call still naming it
      supersededVersions.set(commentId, { key, comment })

      // In the old version's place
      change(key, commentId, (edited) => ({ ...edited, ...result, content }))

      // Answered with the new version's id and when it was written
      return answerJson(route, 200, result)
    }

    // The comment deleted by its author
    if (request.method() === 'DELETE' && action === undefined) {
      // What the app sent
      const write: CommentDeleted = { kind: 'deleted', commentId }

      // The write, noted whatever becomes of it
      writes.push(write)

      // Only somebody signed in deletes
      if (sender === null) return route.fulfill({ status: 401 })

      // A version an edit replaced is gone
      if (isSuperseded) return refuse(route, 404, 'CommentNotFound')

      // Only its author deletes it
      if (comment.author.id !== READER_ID) return refuse(route, 403, 'NotCommentAuthor')

      // Failed, the way a server falling over answers, where the test has it fail
      if (fails(write)) return route.fulfill({ status: 500 })

      // Kept in its place, emptied
      change(key, commentId, (deleted) => ({ ...deleted, isDeleted: true, content: '' }))

      // Answered with nothing
      return route.fulfill({ status: 204 })
    }

    // A reaction pressed on the comment
    if (request.method() === 'POST' && action === 'reaction') {
      // The reaction pressed
      const { kind } = request.postDataJSON() as PressBody

      // What the app sent
      const write: ReactionPressed = { kind: 'pressed', commentId, reaction: kind }

      // The write, noted whatever becomes of it
      writes.push(write)

      // Only somebody signed in reacts
      if (sender === null) return route.fulfill({ status: 401 })

      // A version an edit replaced is gone
      if (isSuperseded) return refuse(route, 404, 'CommentNotFound')

      // A deleted comment takes no reactions
      if (comment.isDeleted) return refuse(route, 404, 'CommentNotFound')

      // Nobody reacts to their own comment
      if (comment.author.id === READER_ID) return refuse(route, 409, 'CannotReactToOwnComment')

      // Failed, the way a server falling over answers, where the test has it fail
      if (fails(write)) return route.fulfill({ status: 500 })

      // Pressed for the reader
      change(key, commentId, (pressed) => pressedOn(pressed, kind))

      // Answered with nothing
      return route.fulfill({ status: 204 })
    }

    // Any other call, handed on to the stubs beneath
    return route.fallback()
  }

  // Every call under the threads' address
  await page.route(`${BACKEND_ORIGIN}/comments**`, answer)

  // A snapshot of the writes on each read, so a list cannot grow underneath an assertion
  return () => [...writes]
}

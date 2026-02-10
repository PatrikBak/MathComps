'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { useClipboard } from '@mantine/hooks'
import {
  Eye,
  GripVertical,
  Link as LinkIcon,
  MoreVertical,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { EditableTextField } from '@/components/shared/components/EditableTextField'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { Modal } from '@/components/shared/components/Modal'
import { ROUTES } from '@/i18n/i18n'

import { useCreateUserList } from '../hooks/use-create-user-list'
import { useDeleteUserList } from '../hooks/use-delete-user-list'
import { useRenameUserList } from '../hooks/use-rename-user-list'
import { useReorderUserLists } from '../hooks/use-reorder-user-lists'
import { useToggleListSharing } from '../hooks/use-toggle-list-sharing'
import { useUserLists } from '../hooks/use-user-lists'
import { listNameSchema } from '../schemas/user-list-schemas'
import type { UserListDto } from '../types/user-list-types'
import { serializeFilters } from '../utils/search-url-serialization'
import { createDefaultFilters } from '../utils/url-initialization'

/**
 * Imperative handle exposed by {@link ManageListsModal} via ref.
 */
export type ManageListsModalRef = {
  /** Opens the modal */
  open: () => void
}

/**
 * Props for the {@link ManageListsModal} component.
 */
type ManageListsModalProps = {
  /** Callback when a list is selected for viewing (filter navigation). */
  onSelectList: (contentId: string) => void
}

/**
 * Arguments for renaming a list.
 */
type RenameListArgs = {
  /** The content ID of the list to rename */
  contentId: string
  /** The new name of the list */
  name: string
}

/**
 * Arguments for toggling list sharing.
 */
type ToggleSharingArgs = {
  /** The content ID of the list */
  contentId: string
  /** Whether to enable (true) or disable (false) sharing */
  enabled: boolean
}

/**
 * Props for a single sortable list row.
 */
type SortableListRowProps = {
  /** The list to render */
  list: UserListDto
  /** Callback to view (filter by) this list */
  onView: (contentId: string) => void
  /** Callback to start deletion (opens confirm dialog) */
  onDelete: (list: UserListDto) => void
  /** Callback to rename this list */
  onRename: (args: RenameListArgs) => Promise<void>
  /** Callback to enable or disable sharing */
  onToggleSharing: (args: ToggleSharingArgs) => Promise<void>
}

/**
 * Builds the share URL for a list using the existing filter serialization.
 *
 * @param contentId - The content ID of the list
 *
 * @returns The full URL for sharing the list
 */
function buildListShareUrl(contentId: string): string {
  // Get the filter which should result in the list being displayed
  const params = serializeFilters({
    ...createDefaultFilters(),
    listContentId: contentId,
  })

  // Build the share URL
  return `${window.location.origin}${ROUTES.PROBLEMS}?${params}`
}

/**
 * A single sortable list row with drag handle, inline edit, count, share, view, and delete.
 */
function SortableListRow({
  list,
  onView,
  onDelete,
  onRename,
  onToggleSharing,
}: SortableListRowProps) {
  // Get translations for the filter section
  const t = useTranslations('problems.filters')

  // Clipboard access for copy-link
  const clipboard = useClipboard()

  // Get the sortable properties for this list
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.contentId,
  })

  // Calculate the style for the sortable list row
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  /**
   * Handles enabling sharing for a list and copying the link to clipboard.
   */
  const handleEnableSharing = async () => {
    // Enable sharing on the backend
    await onToggleSharing({ contentId: list.contentId, enabled: true })

    // Trigger the same behavior as copy link
    handleCopyLink()
  }

  /**
   * Copies the share link to clipboard (for already-shared lists).
   */
  const handleCopyLink = () => {
    // Copy the share link to clipboard
    clipboard.copy(buildListShareUrl(list.contentId))

    // Inform user
    toast.success(t('listShared'))
  }

  /**
   * Disables sharing for a list.
   */
  const handleStopSharing = async () => {
    await onToggleSharing({ contentId: list.contentId, enabled: false })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`col-span-full grid grid-cols-subgrid items-center gap-x-2 rounded-lg px-2 py-1.5 hover:bg-slate-700/30 transition-colors ${
        isDragging ? 'opacity-50 z-10' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="w-5 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={14} />
      </button>

      {/* Editable list name */}
      <div className="min-w-0">
        <EditableTextField
          value={list.name}
          onSave={async (newName) => {
            if (!newName) return
            await onRename({ contentId: list.contentId, name: newName })
          }}
          schema={listNameSchema}
          label={t('renameList')}
          textClassName="text-sm text-slate-200"
          innerContainerClassName="py-0"
          iconClassName="text-slate-500 hover:text-slate-300"
          iconSize={15}
        />
      </div>

      {/* Problem count */}
      <span className="text-right text-xs tabular-nums text-slate-500 px-1">
        {list.problemCount}
      </span>

      {/* === Mobile: single overflow menu === */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-600/50 transition-colors">
              <MoreVertical size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Share / Copy link */}
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={list.isShared ? handleCopyLink : handleEnableSharing}
            >
              <div className="flex items-center gap-2">
                {list.isShared ? <LinkIcon size={14} /> : <Share2 size={14} />}
                <span>{list.isShared ? t('copyListLink') : t('shareList')}</span>
              </div>
            </DropdownMenuItem>

            {/* Stop sharing — only when shared */}
            {list.isShared && (
              <DropdownMenuItem
                className="cursor-pointer text-red-400"
                onSelect={handleStopSharing}
              >
                <div className="flex items-center gap-2">
                  <X size={14} />
                  <span>{t('unshareList')}</span>
                </div>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* View */}
            <DropdownMenuItem className="cursor-pointer" onSelect={() => onView(list.contentId)}>
              <div className="flex items-center gap-2">
                <Eye size={14} />
                <span>{t('viewList')}</span>
              </div>
            </DropdownMenuItem>

            {/* Delete */}
            <DropdownMenuItem
              className="cursor-pointer text-red-400"
              onSelect={() => onDelete(list)}
            >
              <div className="flex items-center gap-2">
                <Trash2 size={14} />
                <span>{t('deleteList')}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* === Desktop: individual icon buttons === */}
      {/* Share button — enables sharing or opens popover when already shared */}
      {list.isShared ? (
        <Popover className="relative hidden sm:block">
          <PopoverButton
            className="w-7 h-7 flex items-center justify-center rounded-md text-blue-400 hover:text-blue-300 hover:bg-slate-600/50 transition-colors"
            title={t('shareList')}
          >
            <LinkIcon size={15} />
          </PopoverButton>
          <PopoverPanel
            anchor="bottom"
            className="z-50 mt-1 rounded-lg border border-slate-600/50 bg-slate-800 shadow-xl p-1 min-w-[160px]"
          >
            {({ close }) => (
              <>
                <button
                  onClick={() => {
                    handleCopyLink()
                    close()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 transition-colors"
                >
                  <LinkIcon size={14} />
                  {t('copyListLink')}
                </button>
                <button
                  onClick={() => {
                    handleStopSharing()
                    close()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700/50 transition-colors"
                >
                  <X size={14} />
                  {t('unshareList')}
                </button>
              </>
            )}
          </PopoverPanel>
        </Popover>
      ) : (
        <button
          onClick={handleEnableSharing}
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-600/50 transition-colors"
          title={t('shareList')}
        >
          <Share2 size={15} />
        </button>
      )}

      {/* View button */}
      <button
        onClick={() => onView(list.contentId)}
        className="hidden sm:flex w-7 h-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-600/50 transition-colors"
        title={t('viewList')}
      >
        <Eye size={15} />
      </button>

      {/* Delete button — opens confirm dialog */}
      <button
        onClick={() => onDelete(list)}
        className="hidden sm:flex w-7 h-7 items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-600/50 transition-colors"
        title={t('deleteList')}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

/**
 * Modal for managing user lists — rename, delete, view, create, and reorder.
 * Owns its own open/close state; parents trigger it via ref.
 */
export const ManageListsModal = forwardRef<ManageListsModalRef, ManageListsModalProps>(
  function ManageListsModal({ onSelectList }, ref) {
    // Translations
    const t = useTranslations('problems.filters')

    // Internal open/close state
    const [isOpen, setIsOpen] = useState(false)

    // Expose open() to parents via ref
    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
    }))

    // Close handler
    const handleClose = () => {
      setIsOpen(false)
      setIsCreating(false)
      setNewListName('')
    }

    // Fetch user lists
    const { lists, isLoading } = useUserLists()

    // Mutation hooks
    const { renameList } = useRenameUserList()
    const { deleteList } = useDeleteUserList()
    const { createList, isPending: isCreatePending } = useCreateUserList()
    const { reorderLists } = useReorderUserLists()
    const { toggleSharing } = useToggleListSharing()

    // Whether we're in "new list" mode
    const [isCreating, setIsCreating] = useState(false)

    // The current name of the new list
    const [newListName, setNewListName] = useState('')

    // The ref to the input where we're typing the new list name
    const inputRef = useRef<HTMLInputElement>(null)

    // Track which list is pending deletion (for the confirm dialog)
    const [deletingList, setDeletingList] = useState<UserListDto | null>(null)

    // DnD sensors — pointer (mouse/touch) and keyboard
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          // Small distance to distinguish drag from click
          distance: 5,
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    )

    /**
     * Handles creating a new list with schema validation.
     */
    const handleCreate = () => {
      // Validate with shared schema
      const result = listNameSchema.safeParse(newListName)

      // Show error if invalid
      if (!result.success) {
        toast.error(t('listNameInvalid'))
        return
      }

      // Create the list
      createList(result.data)

      // Reset creation state
      setNewListName('')
      setIsCreating(false)
    }

    /**
     * Handles viewing a list — sets filter and closes modal.
     *
     * @param contentId - The contentId of the list to view
     */
    const handleView = (contentId: string) => {
      onSelectList(contentId)
      handleClose()
    }

    /**
     * Handles drag end — computes new order and calls reorder mutation.
     */
    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event

      // Only reorder if the item was dropped on a different position
      if (over && active.id !== over.id && lists) {
        const oldIndex = lists.findIndex((list) => list.contentId === active.id)
        const newIndex = lists.findIndex((list) => list.contentId === over.id)

        // Compute the new order and send to the server
        const reordered = arrayMove(lists, oldIndex, newIndex)
        reorderLists(reordered.map((list) => list.contentId))
      }
    }

    return (
      <>
        <Modal
          isOpen={isOpen}
          onClose={handleClose}
          title={t('manageLists')}
          showCloseButton
          className="max-w-md"
        >
          {/* List grid — drag handle + name + count + share + view + delete */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-y-1">
            {isLoading ? (
              <div className="col-span-full flex items-center justify-center py-8">
                <LoadingSpinner className="h-5 w-5" />
              </div>
            ) : lists && lists.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={lists.map((list) => list.contentId)}
                  strategy={verticalListSortingStrategy}
                >
                  {lists.map((list) => (
                    <SortableListRow
                      key={list.contentId}
                      list={list}
                      onView={handleView}
                      onDelete={setDeletingList}
                      onRename={renameList}
                      onToggleSharing={toggleSharing}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <p className="col-span-full text-sm text-slate-400 py-4 text-center">
                {t('noLists')}
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-slate-600/40 mt-3 pt-3">
            {isCreating ? (
              /* Inline input for new list */
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Plus className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleCreate()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setNewListName('')
                      setIsCreating(false)
                    }
                  }}
                  placeholder={t('newListPlaceholder')}
                  disabled={isCreatePending}
                  autoFocus
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-200 placeholder-slate-500 border-none outline-none focus:ring-0"
                />
                {isCreatePending && <LoadingSpinner className="h-4 w-4 shrink-0" />}
              </div>
            ) : (
              /* Button to start creating a new list */
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors w-full rounded-md hover:bg-slate-700/30"
              >
                <Plus className="h-4 w-4" />
                <span>{t('newList')}</span>
              </button>
            )}
          </div>
        </Modal>

        {/* Delete confirmation dialog */}
        <ConfirmDialog
          isOpen={!!deletingList}
          onClose={() => setDeletingList(null)}
          onConfirm={() => {
            if (deletingList) deleteList(deletingList.contentId)
          }}
          title={t('deleteList')}
          message={t('deleteListConfirmMessage', { name: deletingList?.name ?? '' })}
          variant="danger"
        />
      </>
    )
  }
)

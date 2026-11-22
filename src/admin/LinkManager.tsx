import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Link, LinkInput } from '../../shared/types'
import { LIMITS } from '../../shared/validation'
import { getLinkIcon } from '../components/icons'
import { adminApi } from '../lib/api'
import { LinkEditor } from './LinkEditor'
import { PageTitle } from './ProfileEditor'
import { Button, Card, cx, Modal, Switch, useToast } from './ui'

interface Props {
  links: Link[]
  setLinks: Dispatch<SetStateAction<Link[]>>
}

export function LinkManager({ links, setLinks }: Props) {
  const toast = useToast()
  const [editing, setEditing] = useState<Link | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Link | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const previous = links
    const from = links.findIndex((l) => l.id === active.id)
    const to = links.findIndex((l) => l.id === over.id)
    const next = arrayMove(links, from, to)
    setLinks(next) // optimistic
    try {
      setLinks(await adminApi.reorderLinks(next.map((l) => l.id)))
    } catch (e) {
      setLinks(previous)
      toast(e instanceof Error ? e.message : 'Could not reorder', 'error')
    }
  }

  async function toggleActive(link: Link, isActive: boolean) {
    setLinks((ls) => ls.map((l) => (l.id === link.id ? { ...l, isActive } : l)))
    try {
      const updated = await adminApi.updateLink(link.id, { isActive })
      setLinks((ls) => ls.map((l) => (l.id === link.id ? updated : l)))
    } catch (e) {
      setLinks((ls) => ls.map((l) => (l.id === link.id ? { ...l, isActive: !isActive } : l)))
      toast(e instanceof Error ? e.message : 'Update failed', 'error')
    }
  }

  async function submit(input: LinkInput) {
    if (editing === 'new') {
      const created = await adminApi.createLink(input)
      setLinks((ls) => [...ls, created])
      toast('Link added')
    } else if (editing) {
      const updated = await adminApi.updateLink(editing.id, input)
      setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)))
      toast('Link updated')
    }
    setEditing(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await adminApi.deleteLink(deleting.id)
      setLinks((ls) => ls.filter((l) => l.id !== deleting.id))
      toast('Link deleted')
      setDeleting(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const activeCount = links.filter((l) => l.isActive).length
  const categories = [...new Set(links.map((l) => l.category).filter(Boolean))]

  return (
    <div className="space-y-6">
      <PageTitle
        title="Links"
        description="Drag to reorder. Give links a category to group them under a heading. Hidden links stay saved but aren’t shown publicly."
        actions={
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            disabled={links.length >= LIMITS.links}
            onClick={() => setEditing('new')}
          >
            Add link
          </Button>
        }
      />

      <Card
        title={`${links.length} link${links.length === 1 ? '' : 's'}`}
        description={`${activeCount} visible on your page`}
        className="overflow-hidden"
      >
        {links.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
              <Link2 size={20} />
            </div>
            <p className="mt-3 font-medium">No links yet</p>
            <p className="mt-1 text-sm text-zinc-500">Add your first link to get started.</p>
            <Button className="mt-4" variant="primary" icon={<Plus size={15} />} onClick={() => setEditing('new')}>
              Add link
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <ul className="-m-2 space-y-2">
                {links.map((link) => (
                  <SortableRow
                    key={link.id}
                    link={link}
                    onEdit={() => setEditing(link)}
                    onDelete={() => setDeleting(link)}
                    onToggle={(v) => toggleActive(link, v)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <LinkEditor
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        open={editing !== null}
        initial={editing && editing !== 'new' ? editing : null}
        categories={categories}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete link?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          “{deleting?.title}” will be removed permanently. Past clicks still count toward your totals. To hide it temporarily, switch it
          off instead.
        </p>
      </Modal>
    </div>
  )
}

function SortableRow({
  link,
  onEdit,
  onDelete,
  onToggle,
}: {
  link: Link
  onEdit: () => void
  onDelete: () => void
  onToggle: (v: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  })
  const icon = getLinkIcon(link.icon)
  const host = displayUrl(link.url)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        'flex items-center gap-2 rounded-xl border bg-white p-2 pr-3 transition-shadow dark:bg-zinc-900',
        isDragging
          ? 'relative z-10 border-zinc-300 shadow-xl dark:border-zinc-700'
          : 'border-zinc-200/80 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
        !link.isActive && 'opacity-60',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="grid h-10 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label={`Reorder ${link.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {icon ? <icon.Icon size={16} /> : <Link2 size={16} />}
      </div>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{link.title}</span>
          {link.category ? (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {link.category}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-zinc-500">{host}</p>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Switch checked={link.isActive} onChange={onToggle} label={link.isActive ? 'Visible — click to hide' : 'Hidden — click to show'} />
        <Button variant="ghost" size="icon" aria-label={`Edit ${link.title}`} onClick={onEdit} className="ml-1 hidden sm:inline-flex">
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${link.title}`} onClick={onDelete} className="hover:text-red-600 dark:hover:text-red-400">
          <Trash2 size={14} />
        </Button>
      </div>
    </li>
  )
}

function displayUrl(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'mailto:' ? u.pathname : u.host.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}

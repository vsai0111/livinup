'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteItemAction, setArchivedAction, updateItemAction } from '@/app/(app)/wardrobe/actions'
import type { Color } from '@/config/wardrobe'
import { Button } from '@/components/ui/Button'
import { uploadPhoto } from '@/lib/client/upload'
import type { WardrobeItem } from '@/types/wardrobe'
import { ItemForm, draftPayload, type BrandOption, type ItemDraft } from './ItemForm'

/** Edit, replace photo, archive and delete for one item. */
export function ItemDetail({ item, brands }: { item: WardrobeItem; brands: BrandOption[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<ItemDraft>({
    name: item.name,
    itemType: item.itemType,
    color: item.color as Color,
    secondaryColor: (item.secondaryColor as Color | null) ?? null,
    material: item.material ?? '',
    brandText:
      item.brandText ?? brands.find((b) => b.id === item.brandProfileId)?.displayName ?? '',
    brandProfileId: item.brandProfileId ?? '',
    notes: item.notes ?? '',
  })
  const [mediaId, setMediaId] = useState(item.mediaId)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  const save = (nextMediaId = mediaId) =>
    startTransition(async () => {
      if (!draft.itemType || !draft.color) {
        setMessage({ tone: 'error', text: 'Choose a type and a main colour.' })
        return
      }
      const result = await updateItemAction(item.id, draftPayload(draft, nextMediaId))
      setMessage(result.ok ? { tone: 'ok', text: 'Saved.' } : { tone: 'error', text: result.error })
      if (result.ok) router.refresh()
    })

  const replacePhoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      const media = await uploadPhoto(file, 'wardrobe')
      setMediaId(media.id)
      save(media.id)
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'The upload failed.',
      })
    } finally {
      setUploading(false)
    }
  }

  const archive = () =>
    startTransition(async () => {
      const result = await setArchivedAction(item.id, !item.archived)
      if (!result.ok) setMessage({ tone: 'error', text: result.error })
      else router.refresh()
    })

  const remove = () =>
    startTransition(async () => {
      const result = await deleteItemAction(item.id)
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        return
      }
      router.push('/wardrobe')
      router.refresh()
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          loading={uploading}
        >
          {mediaId ? 'Replace photo' : 'Add photo'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => void replacePhoto(event.target.files?.[0])}
        />
        <Button variant="secondary" size="sm" onClick={archive} disabled={pending}>
          {item.archived ? 'Move back to wardrobe' : 'Archive'}
        </Button>
      </div>

      <ItemForm draft={draft} onChange={setDraft} brands={brands} />

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={message.tone === 'error' ? 'text-negative text-sm' : 'text-positive text-sm'}
        >
          {message.text}
        </p>
      )}

      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-5">
        <Button onClick={() => save()} loading={pending && !confirmDelete}>
          Save changes
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-ink-muted text-sm">Delete for good?</span>
              <Button variant="danger" size="sm" onClick={remove} loading={pending}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete piece
            </Button>
          )}
        </div>
      </div>
      <p className="text-ink-subtle text-xs leading-relaxed">
        Archive pieces you no longer own: they leave your wardrobe but stay in the outfits you
        saved. Deleting removes the piece from every outfit. Posts you already published are not
        changed.
      </p>
    </div>
  )
}

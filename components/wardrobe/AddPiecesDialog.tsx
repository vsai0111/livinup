'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createItemAction } from '@/app/(app)/wardrobe/actions'
import { WARDROBE_LIMITS } from '@/config/wardrobe'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { uploadPhoto, type UploadedMedia } from '@/lib/client/upload'
import { cn } from '@/lib/utils/cn'
import { EMPTY_DRAFT, ItemForm, draftPayload, type BrandOption, type ItemDraft } from './ItemForm'

/**
 * Add pieces: pick up to 10 photos, then describe each one in turn.
 *
 * Photos start uploading the moment they are chosen, so by the time someone
 * has picked a type and colour the upload has usually finished. A failed
 * upload keeps what was typed and offers a retry. "Without photo" adds a
 * piece described in words only.
 */

interface Entry {
  key: string
  file: File | null
  preview: string | null
  upload: Promise<UploadedMedia> | null
  status: 'uploading' | 'ready' | 'failed' | 'none'
  mediaId: string | null
  error: string | null
  draft: ItemDraft
}

function makeEntry(file: File | null, initial: Partial<ItemDraft>): Entry {
  return {
    key: crypto.randomUUID(),
    file,
    preview: file ? URL.createObjectURL(file) : null,
    upload: null,
    status: file ? 'uploading' : 'none',
    mediaId: null,
    error: null,
    draft: { ...EMPTY_DRAFT, ...initial },
  }
}

export function AddPiecesDialog({
  mode,
  brands,
  defaultType,
  onClose,
}: {
  mode: 'photos' | 'manual'
  brands: BrandOption[]
  defaultType?: string
  onClose: () => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<Entry[]>(() =>
    mode === 'manual' ? [makeEntry(null, { itemType: defaultType ?? '' })] : [],
  )
  const [index, setIndex] = useState(0)
  const [saved, setSaved] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Free the preview URLs when the dialog goes away.
  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])
  useEffect(
    () => () => {
      for (const entry of entriesRef.current) if (entry.preview) URL.revokeObjectURL(entry.preview)
    },
    [],
  )

  const patch = (key: string, change: Partial<Entry>) =>
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)),
    )

  const startUpload = (entry: Entry) => {
    if (!entry.file) return entry
    const upload = uploadPhoto(entry.file, 'wardrobe')
    upload
      .then((media) => patch(entry.key, { status: 'ready', mediaId: media.id, error: null }))
      .catch((reason: unknown) =>
        patch(entry.key, {
          status: 'failed',
          error: reason instanceof Error ? reason.message : 'The upload failed.',
        }),
      )
    return { ...entry, upload, status: 'uploading' as const }
  }

  const choose = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const chosen = [...files].slice(0, WARDROBE_LIMITS.batchUpload)
    setError(
      files.length > WARDROBE_LIMITS.batchUpload
        ? `Only the first ${WARDROBE_LIMITS.batchUpload} photos were added. Add the rest next.`
        : null,
    )
    setEntries(chosen.map((file) => startUpload(makeEntry(file, { itemType: defaultType ?? '' }))))
    setIndex(0)
  }

  const current = entries[index]
  const done = entries.length > 0 && index >= entries.length

  const next = () => {
    setError(null)
    setIndex((value) => value + 1)
  }

  const save = () => {
    if (!current) return
    if (!current.draft.itemType || !current.draft.color) {
      setError('Choose a type and a main colour.')
      return
    }
    setError(null)
    startTransition(async () => {
      let mediaId = current.mediaId
      if (current.file && !mediaId) {
        try {
          mediaId = (await current.upload)?.id ?? null
        } catch {
          setError('The photo has not uploaded. Retry the upload, or skip this one.')
          return
        }
      }
      const result = await createItemAction(draftPayload(current.draft, mediaId))
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved((value) => value + 1)
      next()
    })
  }

  const finish = () => {
    if (saved > 0) router.refresh()
    onClose()
  }

  const title =
    entries.length === 0
      ? 'Add pieces'
      : done
        ? 'All done'
        : entries.length > 1
          ? `Piece ${index + 1} of ${entries.length}`
          : 'Describe this piece'

  return (
    <Dialog
      title={title}
      onClose={finish}
      size="lg"
      description={
        entries.length === 0
          ? 'Photos of clothes you own. Only you can see your wardrobe.'
          : undefined
      }
    >
      {entries.length === 0 && (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border-line-strong hover:border-ink-subtle hover:bg-surface-sunken/60 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors"
          >
            <span className="bg-surface-sunken text-ink flex h-11 w-11 items-center justify-center rounded-full">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" />
              </svg>
            </span>
            <span className="text-ink text-sm font-semibold">Choose photos</span>
            <span className="text-ink-subtle text-xs">
              Up to {WARDROBE_LIMITS.batchUpload} at a time · JPEG, PNG or WebP
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="sr-only"
            onChange={(event) => choose(event.target.files)}
          />
          <p className="text-ink-subtle mt-4 text-xs leading-relaxed">
            Tip: lay each piece flat on a plain surface in daylight. Photos are resized on your
            device, and location data is removed before anything is stored.
          </p>
        </div>
      )}

      {current && !done && (
        <div
          className={cn(
            'grid gap-6',
            current.preview && 'sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]',
          )}
        >
          {current.preview && (
            <div>
              <div className="bg-surface-sunken relative aspect-[4/5] overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.preview}
                  alt="Selected photo"
                  className="h-full w-full object-cover"
                />
                {current.status === 'uploading' && (
                  <span className="bg-surface/90 text-ink-muted absolute right-2 bottom-2 left-2 rounded-md px-2 py-1 text-center text-xs">
                    Uploading…
                  </span>
                )}
              </div>
              {current.status === 'failed' && (
                <div className="mt-2 space-y-2">
                  <p role="alert" className="text-negative text-xs">
                    {current.error}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEntries((list) =>
                        list.map((entry) =>
                          entry.key === current.key ? startUpload(entry) : entry,
                        ),
                      )
                    }
                  >
                    Retry upload
                  </Button>
                </div>
              )}
            </div>
          )}

          <div>
            <ItemForm
              draft={current.draft}
              brands={brands}
              onChange={(draft) => patch(current.key, { draft })}
            />

            {error && (
              <p role="alert" className="text-negative mt-4 text-sm">
                {error}
              </p>
            )}

            <div className="border-line mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
              <Button onClick={save} loading={pending}>
                {index + 1 < entries.length ? 'Save and next' : 'Save'}
              </Button>
              {entries.length > 1 && (
                <Button variant="ghost" onClick={next} disabled={pending}>
                  Skip this one
                </Button>
              )}
              <span className="text-ink-subtle ml-auto text-xs">
                {saved > 0 && `${saved} saved`}
              </span>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="py-6 text-center">
          <p className="text-ink text-base font-medium">
            {saved === 0
              ? 'Nothing was added.'
              : `${saved} ${saved === 1 ? 'piece' : 'pieces'} added to your wardrobe.`}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={finish}>Done</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

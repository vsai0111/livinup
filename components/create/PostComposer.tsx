'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishPostAction } from '@/app/actions/community'
import { POST_LIMITS } from '@/config/community'
import { OCCASIONS, OCCASION_LABELS, wardrobeType } from '@/config/wardrobe'
import { MediaImage } from '@/components/media/MediaImage'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ItemThumb } from '@/components/wardrobe/ItemThumb'
import { uploadPhoto } from '@/lib/client/upload'
import { humanize } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { Outfit, WardrobeItem } from '@/types/wardrobe'

/**
 * Publishing, in three steps: choose images, add details, preview.
 *
 * The preview shows exactly what will be public (spec S1). Nothing is saved
 * until "Publish". Wardrobe photos chosen here are copied at publish time, so
 * the wardrobe itself stays private.
 */

type Selected =
  | { kind: 'item'; key: string; item: WardrobeItem; altText: string }
  | { kind: 'upload'; key: string; mediaId: string; altText: string }

interface BrandChoice {
  id: string
  displayName: string
  username: string
}

export function PostComposer({
  outfit,
  outfitItems,
  allPhotoItems,
  brands,
  author,
}: {
  outfit: Outfit | null
  outfitItems: WardrobeItem[]
  allPhotoItems: WardrobeItem[]
  brands: BrandChoice[]
  author: { displayName: string; username: string; avatarMediaId: string | null }
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'images' | 'details' | 'preview'>('images')
  const [selected, setSelected] = useState<Selected[]>(() =>
    outfitItems
      .filter((item) => item.mediaId)
      .slice(0, POST_LIMITS.images)
      .map((item) => ({ kind: 'item', key: `item-${item.id}`, item, altText: '' })),
  )
  const [caption, setCaption] = useState('')
  const [occasions, setOccasions] = useState<string[]>(outfit?.occasions ?? [])
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [includeItems, setIncludeItems] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const choices = useMemo(() => {
    // The outfit's pieces first, then the rest of the wardrobe.
    const ids = new Set(outfitItems.map((item) => item.id))
    return [
      ...outfitItems.filter((item) => item.mediaId),
      ...allPhotoItems.filter((item) => !ids.has(item.id)),
    ]
  }, [outfitItems, allPhotoItems])

  const isSelected = (item: WardrobeItem) =>
    selected.some((entry) => entry.kind === 'item' && entry.item.id === item.id)

  const toggleItem = (item: WardrobeItem) => {
    setError(null)
    if (isSelected(item)) {
      setSelected(selected.filter((entry) => !(entry.kind === 'item' && entry.item.id === item.id)))
    } else if (selected.length < POST_LIMITS.images) {
      setSelected([...selected, { kind: 'item', key: `item-${item.id}`, item, altText: '' }])
    } else {
      setError(`A post can have up to ${POST_LIMITS.images} photos.`)
    }
  }

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = POST_LIMITS.images - selected.length
    if (room <= 0) {
      setError(`A post can have up to ${POST_LIMITS.images} photos.`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const added: Selected[] = []
      for (const file of [...files].slice(0, room)) {
        const media = await uploadPhoto(file, 'post')
        added.push({ kind: 'upload', key: `upload-${media.id}`, mediaId: media.id, altText: '' })
      }
      setSelected((current) => [...current, ...added])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= selected.length) return
    const next = [...selected]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSelected(next)
  }

  const setAlt = (key: string, altText: string) =>
    setSelected(selected.map((entry) => (entry.key === key ? { ...entry, altText } : entry)))

  const publish = () =>
    startTransition(async () => {
      setError(null)
      const result = await publishPostAction({
        outfitId: outfit?.id ?? null,
        images: selected.map((entry) =>
          entry.kind === 'item'
            ? { kind: 'item', itemId: entry.item.id, altText: entry.altText }
            : { kind: 'upload', mediaId: entry.mediaId, altText: entry.altText },
        ),
        caption,
        occasions,
        brandIds,
        includeItems: includeItems && Boolean(outfit),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/p/${result.data.postId}`)
      router.refresh()
    })

  const thumb = (entry: Selected, size: 'sm' | 'md' = 'sm') =>
    entry.kind === 'item' ? (
      <ItemThumb item={entry.item} size={size} className="h-full w-full" />
    ) : (
      <MediaImage id={entry.mediaId} size={size} alt="Uploaded photo" />
    )

  const steps = ['images', 'details', 'preview'] as const

  return (
    <div>
      <ol className="mb-6 flex items-center gap-2 text-sm" aria-label="Steps">
        {steps.map((value, index) => (
          <li key={value} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                step === value
                  ? 'bg-ink text-primary-ink'
                  : steps.indexOf(step) > index
                    ? 'bg-accent text-accent-ink'
                    : 'bg-surface-sunken text-ink-subtle',
              )}
              aria-current={step === value ? 'step' : undefined}
            >
              {index + 1}
            </span>
            <span className={step === value ? 'text-ink font-medium' : 'text-ink-subtle'}>
              {value === 'images' ? 'Photos' : value === 'details' ? 'Details' : 'Preview'}
            </span>
            {index < steps.length - 1 && (
              <span className="bg-line mx-1 h-px w-6" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      {step === 'images' && (
        <div className="space-y-6">
          <section>
            <h2 className="text-ink text-sm font-semibold">
              Selected{' '}
              <span className="text-ink-subtle font-normal">
                · {selected.length}/{POST_LIMITS.images}
              </span>
            </h2>
            {selected.length === 0 ? (
              <p className="text-ink-muted mt-2 text-sm">
                Pick photos from your wardrobe below, or upload new ones, such as a photo of you
                wearing the outfit.
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {selected.map((entry, index) => (
                  <li key={entry.key} className="border-line overflow-hidden rounded-xl border">
                    <div className="bg-surface-sunken aspect-[4/5]">{thumb(entry)}</div>
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-ink-subtle text-xs">{index + 1}</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label="Move earlier"
                          className="text-ink-muted hover:text-ink h-7 w-7 rounded disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === selected.length - 1}
                          aria-label="Move later"
                          className="text-ink-muted hover:text-ink h-7 w-7 rounded disabled:opacity-30"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelected(selected.filter((e) => e.key !== entry.key))}
                          aria-label="Remove photo"
                          className="text-ink-muted hover:text-negative h-7 w-7 rounded"
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                loading={uploading}
              >
                Upload new photos
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                className="sr-only"
                onChange={(event) => void upload(event.target.files)}
              />
            </div>
          </section>

          {choices.length > 0 && (
            <section>
              <h2 className="text-ink text-sm font-semibold">
                {outfit ? `From “${outfit.name}” and your wardrobe` : 'From your wardrobe'}
              </h2>
              <p className="text-ink-subtle mt-0.5 text-xs">
                A copy of each photo is published. Your wardrobe stays private.
              </p>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {choices.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item)}
                      aria-pressed={isSelected(item)}
                      aria-label={item.name}
                      className={cn(
                        'block w-full overflow-hidden rounded-lg border',
                        isSelected(item)
                          ? 'border-accent ring-accent ring-2'
                          : 'border-line hover:border-line-strong',
                      )}
                    >
                      <ItemThumb item={item} className="aspect-square w-full" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {error && (
            <p role="alert" className="text-negative text-sm">
              {error}
            </p>
          )}
          <div className="border-line flex justify-end border-t pt-4">
            <Button
              onClick={() =>
                selected.length === 0 ? setError('Add at least one photo.') : setStep('details')
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="caption" className="text-ink block text-sm font-medium">
              Caption
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={POST_LIMITS.captionLength}
              rows={4}
              placeholder="Where you wore it, how you styled it…"
              className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle w-full rounded-lg border px-3.5 py-2.5 text-sm"
            />
            <p className="text-ink-subtle text-right text-xs tabular-nums">
              {caption.length} / {POST_LIMITS.captionLength}
            </p>
          </div>

          <fieldset>
            <legend className="text-ink text-sm font-medium">Occasions</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OCCASIONS.map((occasion) => {
                const on = occasions.includes(occasion)
                return (
                  <button
                    key={occasion}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setOccasions(
                        on ? occasions.filter((o) => o !== occasion) : [...occasions, occasion],
                      )
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium',
                      on
                        ? 'border-ink bg-ink text-primary-ink'
                        : 'border-line-strong text-ink-muted hover:text-ink',
                    )}
                  >
                    {OCCASION_LABELS[occasion]}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {brands.length > 0 && (
            <fieldset>
              <legend className="text-ink text-sm font-medium">
                Tag brands{' '}
                <span className="text-ink-subtle font-normal">· up to {POST_LIMITS.brandTags}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {brands.map((brand) => {
                  const on = brandIds.includes(brand.id)
                  return (
                    <button
                      key={brand.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setBrandIds(
                          on
                            ? brandIds.filter((id) => id !== brand.id)
                            : brandIds.length < POST_LIMITS.brandTags
                              ? [...brandIds, brand.id]
                              : brandIds,
                        )
                      }
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium',
                        on
                          ? 'border-accent bg-accent-soft text-accent-strong'
                          : 'border-line-strong text-ink-muted hover:text-ink',
                      )}
                    >
                      {brand.displayName}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {outfit && (
            <label className="border-line flex cursor-pointer items-start gap-3 rounded-xl border p-4">
              <input
                type="checkbox"
                checked={includeItems}
                onChange={(event) => setIncludeItems(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
              />
              <span>
                <span className="text-ink block text-sm font-medium">
                  Add a “What I’m wearing” list
                </span>
                <span className="text-ink-muted block text-xs leading-relaxed">
                  Shows the type, colour and brand of each piece in this outfit. Your notes and the
                  rest of your wardrobe stay private.
                </span>
              </span>
            </label>
          )}

          <section>
            <h2 className="text-ink text-sm font-medium">
              Image descriptions{' '}
              <span className="text-ink-subtle font-normal">· for people using screen readers</span>
            </h2>
            <ul className="mt-2 space-y-2">
              {selected.map((entry, index) => (
                <li key={entry.key} className="flex items-center gap-3">
                  <span className="bg-surface-sunken h-12 w-10 shrink-0 overflow-hidden rounded-md">
                    {thumb(entry)}
                  </span>
                  <input
                    value={entry.altText}
                    onChange={(event) => setAlt(entry.key, event.target.value)}
                    maxLength={POST_LIMITS.altTextLength}
                    placeholder={`Photo ${index + 1}, e.g. “White kurta with blue jeans”`}
                    aria-label={`Description for photo ${index + 1}`}
                    className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm"
                  />
                </li>
              ))}
            </ul>
          </section>

          {error && (
            <p role="alert" className="text-negative text-sm">
              {error}
            </p>
          )}
          <div className="border-line flex justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setStep('images')}>
              Back
            </Button>
            <Button onClick={() => setStep('preview')}>Preview</Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <p className="bg-accent-soft text-accent-strong mb-5 rounded-lg px-4 py-3 text-sm font-medium">
            This is exactly what will be public. Anyone with the link can see it.
          </p>
          <article className="border-line mx-auto max-w-md overflow-hidden rounded-2xl border">
            <header className="flex items-center gap-2.5 px-4 py-3">
              <Avatar name={author.displayName} mediaId={author.avatarMediaId} size="sm" />
              <span>
                <span className="text-ink block text-sm font-semibold">{author.displayName}</span>
                <span className="text-ink-subtle block text-xs">@{author.username}</span>
              </span>
            </header>
            <div className="grid grid-cols-2 gap-0.5">
              {selected.map((entry, index) => (
                <div
                  key={entry.key}
                  className={cn(
                    'bg-surface-sunken aspect-[4/5]',
                    selected.length === 1 && 'col-span-2',
                    selected.length === 3 && index === 0 && 'col-span-2',
                  )}
                >
                  {thumb(entry, 'md')}
                </div>
              ))}
            </div>
            <div className="space-y-2 px-4 py-3">
              {caption && <p className="text-ink text-sm whitespace-pre-line">{caption}</p>}
              {occasions.length > 0 && (
                <p className="text-ink-subtle text-xs">
                  {occasions
                    .map((o) => OCCASION_LABELS[o as keyof typeof OCCASION_LABELS])
                    .join(' · ')}
                </p>
              )}
              {includeItems && outfit && (
                <ul className="border-line space-y-0.5 border-t pt-2 text-xs">
                  {outfitItems.map((item) => (
                    <li key={item.id} className="text-ink-muted">
                      {wardrobeType(item.itemType)?.label} · {humanize(item.color)}
                      {item.brandText ? ` · ${item.brandText}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {brandIds.length > 0 && (
                <p className="text-ink-muted text-xs">
                  Brands:{' '}
                  {brands
                    .filter((b) => brandIds.includes(b.id))
                    .map((b) => b.displayName)
                    .join(', ')}
                </p>
              )}
            </div>
          </article>

          {error && (
            <p role="alert" className="text-negative mt-4 text-center text-sm">
              {error}
            </p>
          )}
          <div className="border-line mt-6 flex justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setStep('details')}>
              Back
            </Button>
            <Button onClick={publish} loading={pending}>
              Publish
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

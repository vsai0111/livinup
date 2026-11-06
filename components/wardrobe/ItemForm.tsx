'use client'

import { useId, useState } from 'react'
import {
  GROUP_LABELS,
  ITEM_GROUPS,
  MATERIALS,
  WARDROBE_LIMITS,
  WARDROBE_TYPES,
  wardrobeType,
  type Color,
} from '@/config/wardrobe'
import { Field, SelectField } from '@/components/ui/Field'
import { humanize } from '@/lib/utils/format'
import { ColorPicker } from './ColorPicker'

/** The fields describing one wardrobe item. Shared by "add" and "edit". */

export interface ItemDraft {
  name: string
  itemType: string
  color: Color | null
  secondaryColor: Color | null
  material: string
  brandText: string
  brandProfileId: string
  notes: string
}

export const EMPTY_DRAFT: ItemDraft = {
  name: '',
  itemType: '',
  color: null,
  secondaryColor: null,
  material: '',
  brandText: '',
  brandProfileId: '',
  notes: '',
}

export interface BrandOption {
  id: string
  displayName: string
}

export function suggestedName(draft: ItemDraft): string {
  const type = wardrobeType(draft.itemType)
  if (!type) return 'Name this piece'
  return draft.color ? `${humanize(draft.color)} ${type.label.toLowerCase()}` : type.label
}

/** Turn a draft into the action payload. */
export function draftPayload(draft: ItemDraft, mediaId: string | null) {
  return {
    name: draft.name.trim() || null,
    itemType: draft.itemType,
    color: draft.color,
    secondaryColor: draft.secondaryColor,
    material: draft.material || null,
    brandText: draft.brandProfileId ? null : draft.brandText.trim() || null,
    brandProfileId: draft.brandProfileId || null,
    notes: draft.notes.trim() || null,
    mediaId,
  }
}

export function ItemForm({
  draft,
  onChange,
  brands,
}: {
  draft: ItemDraft
  onChange: (draft: ItemDraft) => void
  brands: BrandOption[]
}) {
  const listId = useId()
  const [showMore, setShowMore] = useState(
    Boolean(draft.notes || draft.secondaryColor || draft.material),
  )
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    onChange({ ...draft, [key]: value })

  const onBrandInput = (value: string) => {
    // Picking a verified brand from the list links the item to it.
    const match = brands.find(
      (brand) => brand.displayName.toLowerCase() === value.trim().toLowerCase(),
    )
    onChange({ ...draft, brandText: value, brandProfileId: match?.id ?? '' })
  }

  return (
    <div className="space-y-5">
      <SelectField
        label="Type"
        value={draft.itemType}
        onChange={(event) => set('itemType', event.target.value)}
        required
      >
        <option value="" disabled>
          Choose a type
        </option>
        {ITEM_GROUPS.map((group) => (
          <optgroup key={group} label={GROUP_LABELS[group]}>
            {WARDROBE_TYPES.filter((type) => type.group === group).map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>

      <ColorPicker
        name="color"
        label="Main colour"
        value={draft.color}
        onChange={(value) => set('color', value)}
      />

      <Field
        label="Name"
        value={draft.name}
        onChange={(event) => set('name', event.target.value)}
        maxLength={WARDROBE_LIMITS.nameLength}
        placeholder={suggestedName(draft)}
        hint="Leave empty to use the suggestion."
        autoComplete="off"
      />

      <div>
        <Field
          label="Brand"
          value={draft.brandText}
          onChange={(event) => onBrandInput(event.target.value)}
          maxLength={WARDROBE_LIMITS.brandLength}
          list={listId}
          placeholder="Optional"
          autoComplete="off"
          hint={draft.brandProfileId ? 'Linked to this brand’s LivinUp profile.' : undefined}
        />
        <datalist id={listId}>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.displayName} />
          ))}
        </datalist>
      </div>

      {showMore ? (
        <div className="border-line space-y-5 border-t pt-5">
          <ColorPicker
            name="secondaryColor"
            label="Second colour"
            optional
            value={draft.secondaryColor}
            onChange={(value) => set('secondaryColor', value)}
          />
          <SelectField
            label="Material"
            value={draft.material}
            onChange={(event) => set('material', event.target.value)}
          >
            <option value="">Not sure</option>
            {MATERIALS.map((material) => (
              <option key={material} value={material}>
                {humanize(material)}
              </option>
            ))}
          </SelectField>
          <div className="space-y-1.5">
            <label htmlFor={`${listId}-notes`} className="text-ink block text-sm font-medium">
              Notes <span className="text-ink-subtle font-normal">· only you see these</span>
            </label>
            <textarea
              id={`${listId}-notes`}
              value={draft.notes}
              onChange={(event) => set('notes', event.target.value)}
              maxLength={WARDROBE_LIMITS.notesLength}
              rows={3}
              placeholder="Fit, where you bought it, what you wear it with…"
              className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-ink-muted hover:text-ink text-sm font-medium underline-offset-2 hover:underline"
        >
          + Second colour, material, notes
        </button>
      )}
    </div>
  )
}

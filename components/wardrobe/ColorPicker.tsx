'use client'

import { COLORS, type Color } from '@/config/wardrobe'
import { humanize } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { hexFor } from './GarmentIcon'

/** Colour swatches as a radio group, so keyboard and screen readers work. */
export function ColorPicker({
  name,
  value,
  onChange,
  label,
  optional = false,
}: {
  name: string
  value: Color | null
  onChange: (value: Color | null) => void
  label: string
  optional?: boolean
}) {
  return (
    <fieldset>
      <legend className="text-ink text-sm font-medium">
        {label}
        <span className="text-ink-subtle font-normal">
          {value ? ` · ${humanize(value)}` : optional ? ' · optional' : ''}
        </span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {optional && (
          <label
            className={cn(
              'border-line-strong text-ink-subtle flex h-8 cursor-pointer items-center rounded-full border px-3 text-xs',
              'has-checked:border-ink has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === null}
              onChange={() => onChange(null)}
            />
            None
          </label>
        )}
        {COLORS.map((color) => (
          <label
            key={color}
            title={humanize(color)}
            className={cn(
              'ring-line-strong relative h-8 w-8 cursor-pointer rounded-full ring-1 transition-transform hover:scale-105',
              'has-checked:ring-ink has-checked:ring-2 has-checked:ring-offset-2',
              'has-focus-visible:outline-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-4',
            )}
            style={{
              background:
                color === 'multi'
                  ? 'conic-gradient(#c53b31, #e8c547, #3c6fc2, #3e8a50, #c53b31)'
                  : hexFor(color),
            }}
          >
            <input
              type="radio"
              name={name}
              value={color}
              className="sr-only"
              checked={value === color}
              onChange={() => onChange(color)}
            />
            <span className="sr-only">{humanize(color)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

'use client'

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Labelled form controls.
 *
 * The label is always rendered and always associated with its control via a
 * generated id — placeholder-as-label is inaccessible and disappears the moment
 * someone starts typing. Errors are wired with aria-describedby and
 * aria-invalid so they are announced rather than merely coloured red.
 */

const CONTROL =
  'w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 text-sm ' +
  'h-11 text-ink placeholder:text-ink-subtle transition-colors ' +
  'hover:border-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 ' +
  'aria-[invalid=true]:border-negative'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: ReactNode
}

export function Field({ label, error, hint, className, ...props }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
      </label>

      <input
        id={id}
        className={cn(CONTROL, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        {...props}
      />

      {hint && (
        <p id={hintId} className="text-ink-subtle text-xs leading-relaxed">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-negative text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export interface TextareaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string
  error?: string
  hint?: ReactNode
  /** Show "n / max" under the field. */
  showCount?: boolean
}

export function TextareaField({
  label,
  error,
  hint,
  className,
  showCount,
  maxLength,
  value,
  ...props
}: TextareaFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const length = typeof value === 'string' ? value.length : 0

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        className={cn(
          'border-line-strong bg-surface text-ink placeholder:text-ink-subtle hover:border-ink-subtle',
          'w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 text-sm leading-relaxed transition-colors',
          'aria-[invalid=true]:border-negative min-h-24 resize-y',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        {...props}
      />
      <div className="flex items-start justify-between gap-3">
        {hint ? (
          <p id={hintId} className="text-ink-subtle text-xs leading-relaxed">
            {hint}
          </p>
        ) : (
          <span />
        )}
        {showCount && maxLength && (
          <p className="text-ink-subtle shrink-0 text-xs tabular-nums">
            {length} / {maxLength}
          </p>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-negative text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  /** Hide the label visually but keep it for assistive technology. */
  labelHidden?: boolean
  children: ReactNode
}

export function SelectField({
  label,
  labelHidden = false,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const id = useId()

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={cn('text-ink block text-sm font-medium', labelHidden && 'sr-only')}
      >
        {label}
      </label>
      <select id={id} className={cn(CONTROL, 'cursor-pointer pr-8', className)} {...props}>
        {children}
      </select>
    </div>
  )
}

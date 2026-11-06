/** Shown next to verified brand names. */
export function VerifiedBadge({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`text-accent shrink-0 ${className}`}
      role="img"
      aria-label="Verified brand"
    >
      <path
        fill="currentColor"
        d="M12 2.5 14.4 4l2.8-.2 1 2.6 2.4 1.5-.7 2.7L21 13l-2.1 1.9.2 2.8-2.6 1-1.5 2.4-2.7-.7L10 21.5l-1.9-2.1-2.8.2-1-2.6L1.9 15.5l.7-2.7L1.5 10l2.1-1.9-.2-2.8 2.6-1L7.5 1.9l2.7.7Z"
      />
      <path
        d="m8 12.2 2.6 2.6L16.2 9"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

export function AdminNav({ current }: { current: 'reports' | 'brands' | 'invites' }) {
  const links = [
    { id: 'reports', href: '/admin', label: 'Reports' },
    { id: 'brands', href: '/admin/brands', label: 'Brands' },
    { id: 'invites', href: '/admin/invites', label: 'Invite codes' },
  ] as const
  return (
    <nav aria-label="Admin" className="border-line mb-6 flex gap-1 border-b">
      {links.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          aria-current={current === link.id ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2.5 text-sm',
            current === link.id
              ? 'border-ink text-ink font-semibold'
              : 'text-ink-muted hover:text-ink border-transparent font-medium',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

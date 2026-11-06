import { requireUser } from '@/lib/auth'
import { Logo } from '@/components/layout/Logo'

/** Onboarding has its own quiet frame: one task, no navigation competing with it. */
export default async function OnboardingLayout({ children }: LayoutProps<'/'>) {
  await requireUser('/onboarding')
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-line border-b">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-5">
          <Logo href="/onboarding" />
        </div>
      </header>
      <main id="main" className="flex-1 py-10">
        <div className="mx-auto w-full max-w-2xl px-5">{children}</div>
      </main>
    </div>
  )
}

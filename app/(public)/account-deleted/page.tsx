import { PageContainer } from '@/components/layout/PageContainer'
import { ButtonLink } from '@/components/ui/Button'

export const metadata = { title: 'Account deleted', robots: { index: false } }

export default function AccountDeletedPage() {
  return (
    <PageContainer width="narrow">
      <div className="py-16 text-center">
        <h1 className="text-ink text-2xl font-semibold">Your account has been deleted</h1>
        <p className="text-ink-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
          Your wardrobe, outfits, posts, comments and follows have been removed. Thank you for
          trying LivinUp.
        </p>
        <ButtonLink href="/" variant="secondary" className="mt-6">
          Back to LivinUp
        </ButtonLink>
      </div>
    </PageContainer>
  )
}

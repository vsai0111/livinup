import Link from 'next/link'
import { LEGAL } from '@/config/legal'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata = { title: 'Terms of Use' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms are an agreement between you and {LEGAL.companyName} (“LivinUp”, “we”) about
        your use of LivinUp. By creating an account you agree to them.
      </p>
      <h2>Who can use LivinUp</h2>
      <p>You must be 18 or older to create an account.</p>
      <h2>Your wardrobe is private</h2>
      <p>
        Photos and details you add to your wardrobe and outfits are visible only to you. Nothing
        becomes public unless you publish it as a post.
      </p>
      <h2>What you post</h2>
      <ul>
        <li>
          You keep ownership of what you post. You give LivinUp permission to store and display it
          on the service so others can see it.
        </li>
        <li>
          Only post photos you took or have the right to share. Do not post anyone else’s image
          without their consent.
        </li>
        <li>
          Follow the{' '}
          <Link href="/guidelines" className="text-ink underline">
            Community Guidelines
          </Link>
          . We may remove content or suspend accounts that break them.
        </li>
      </ul>
      <h2>Brands</h2>
      <p>
        Brand accounts are verified by LivinUp. LivinUp does not sell products and is not part of
        any purchase you make from a brand.
      </p>
      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from Settings. Deleting it removes your wardrobe,
        outfits, posts and activity.
      </p>
      <h2>Complaints</h2>
      <p>
        See the{' '}
        <Link href="/grievance" className="text-ink underline">
          Grievances
        </Link>{' '}
        page to raise a complaint with our grievance officer.
      </p>
    </LegalPage>
  )
}

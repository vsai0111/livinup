import Link from 'next/link'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This page explains what LivinUp collects, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address, display name, username, optional bio and
          profile photo.
        </li>
        <li>
          <strong>Wardrobe:</strong> photos and details of clothing you add, and the outfits you
          save. These are private to you.
        </li>
        <li>
          <strong>Posts and activity:</strong> what you publish, likes, comments, follows, reports
          and blocks.
        </li>
        <li>
          <strong>Usage events:</strong> which features you use (for example “added an item”), to
          understand whether LivinUp is useful. We do not sell this data.
        </li>
      </ul>
      <h2>Photos</h2>
      <p>
        Photos are resized and re-encoded when you upload them, which removes location and camera
        details. Wardrobe photos are served only to you. Published photos are copies, served to
        anyone who can see the post.
      </p>
      <h2>Your choices</h2>
      <ul>
        <li>Edit or delete any wardrobe item, outfit or post at any time.</li>
        <li>Hide your posts from Explore in Settings.</li>
        <li>
          Delete your account from Settings. Your data is removed immediately; copies in backups
          expire on our hosting provider’s backup schedule.
        </li>
      </ul>
      <h2>Contact</h2>
      <p>
        For privacy questions or requests, use the{' '}
        <Link href="/grievance" className="text-ink underline">
          Grievances
        </Link>{' '}
        page.
      </p>
    </LegalPage>
  )
}

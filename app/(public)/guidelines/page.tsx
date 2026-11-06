import { LegalPage } from '@/components/legal/LegalPage'

export const metadata = { title: 'Community Guidelines' }

export default function GuidelinesPage() {
  return (
    <LegalPage title="Community Guidelines">
      <p>LivinUp is a place to share how you dress and find inspiration. Keep it kind and real.</p>
      <h2>Do</h2>
      <ul>
        <li>Share outfits and clothes you own or styled yourself.</li>
        <li>Credit brands and creators when you can.</li>
        <li>Disagree respectfully.</li>
      </ul>
      <h2>Don’t</h2>
      <ul>
        <li>
          Post intimate or sexual images of anyone, or any image of a person without their consent.
        </li>
        <li>
          Post anything involving the exploitation of children. We report it to the authorities.
        </li>
        <li>
          Harass, bully, threaten or demean anyone, including for their body, gender, religion,
          caste, region or community.
        </li>
        <li>Impersonate a person or a brand.</li>
        <li>Spam, scam, or post other people’s photos as your own.</li>
      </ul>
      <h2>Reporting</h2>
      <p>
        Use “Report” on any post, comment or account. Reports about intimate images and child safety
        go to the top of our queue. We may remove content and suspend accounts that break these
        guidelines, and you will be told when we act on something you posted.
      </p>
    </LegalPage>
  )
}

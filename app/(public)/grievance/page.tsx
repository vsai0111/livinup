import { LEGAL, LEGAL_CONFIGURED } from '@/config/legal'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata = { title: 'Grievances' }

export default function GrievancePage() {
  return (
    <LegalPage title="Grievances">
      <p>
        If you have a complaint about content on LivinUp, about how we handled a report, or about
        your personal data, contact our grievance officer.
      </p>
      <h2>Grievance officer</h2>
      {LEGAL_CONFIGURED ? (
        <p>
          <strong>{LEGAL.grievanceOfficerName}</strong>
          <br />
          <a href={`mailto:${LEGAL.grievanceEmail}`} className="text-ink underline">
            {LEGAL.grievanceEmail}
          </a>
        </p>
      ) : (
        <p>
          <strong>To be appointed before launch.</strong> Until then, use “Report” on the content
          concerned and our team will respond.
        </p>
      )}
      <h2>What to include</h2>
      <ul>
        <li>A link to the post, comment or account concerned.</li>
        <li>What the problem is, and what you would like us to do.</li>
        <li>How we can contact you.</li>
      </ul>
      <h2>What happens next</h2>
      <p>
        We acknowledge complaints promptly and resolve them within the time limits required under
        Indian law. Reports of intimate images shared without consent are handled first.
      </p>
    </LegalPage>
  )
}

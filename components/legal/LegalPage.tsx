import type { ReactNode } from 'react'
import { LEGAL, LEGAL_REVIEWED } from '@/config/legal'
import { PageContainer } from '@/components/layout/PageContainer'

/**
 * Frame for the legal pages. Until a qualified lawyer has reviewed the texts
 * (LEGAL_REVIEWED), every page carries a visible draft notice: these texts are
 * templates for review, not final terms (spec 12). Configuring the grievance
 * officer does not remove the notice.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageContainer width="narrow">
      {!LEGAL_REVIEWED && (
        <p
          role="note"
          className="border-warning/30 bg-surface-sunken text-warning mb-6 rounded-lg border px-3.5 py-2.5 text-sm"
        >
          Draft pending review by a qualified lawyer. This page is not yet final.
        </p>
      )}
      <h1 className="text-ink text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-ink-subtle mt-2 text-sm">Last updated {LEGAL.lastUpdated}</p>
      <div className="text-ink-muted [&_h2]:text-ink [&_strong]:text-ink mt-8 space-y-5 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </PageContainer>
  )
}

import type { Metadata } from 'next'
import { TokenPage } from '@/features/token/TokenPage'

export const metadata: Metadata = {
  title: '$PANB Pre-seed Round — Panorama Block',
  description:
    'Participate in the Panorama Block Pre-seed round. Buy $PANB at $0.04 before the public listing at $0.08. AI-first DeFi platform on Telegram.',
  openGraph: {
    title: '$PANB Pre-seed Round — Panorama Block',
    description:
      'Buy $PANB at $0.04 Pre-seed price before the public listing at $0.08 (100% upside).',
    type: 'website',
  },
}

export default function Page() {
  return <TokenPage />
}

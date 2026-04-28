import type { Metadata } from 'next'
import { TokenPage } from '@/features/token/TokenPage'

export const metadata: Metadata = {
  title: '$PANBLK Seed Round — Panorama Block',
  description:
    'Participate in the Panorama Block seed round. Buy $PANBLK at $0.025 before the public listing at $0.08. AI-first DeFi platform on Telegram.',
  openGraph: {
    title: '$PANBLK Seed Round — Panorama Block',
    description:
      'Buy $PANBLK at $0.025 seed price before the public listing at $0.08 (+220% upside).',
    type: 'website',
  },
}

export default function Page() {
  return <TokenPage />
}

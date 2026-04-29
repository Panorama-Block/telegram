import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  appendAllocation,
  sendConfirmationEmail,
  sendAdminNotification,
} from '@/lib/google'

// ─── Validation ──────────────────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().default(''),
  lastName:  z.string().default(''),
  amountUSD: z.number().min(500, 'Minimum investment is $500').max(500_000, 'Maximum investment is $500K'),
  tokens:    z.number().positive(),
  wallet:    z.string().regex(/^(0x[a-fA-F0-9]{40})?$/, 'Invalid EVM address').default(''),
  email:     z.string().email('Invalid email').or(z.literal('')).default(''),
  telegram:  z.string().default(''),
  phone:     z.string().default(''),
}).refine(
  (d) => d.email !== '' || d.telegram !== '',
  { message: 'At least one contact method is required' },
)

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data = parsed.data

  // 1. Persist to Google Sheets first (source of truth)
  try {
    await appendAllocation(data)
  } catch (err) {
    console.error('[allocation] Sheets write failed:', err)
    return NextResponse.json(
      { error: 'Failed to record allocation request. Please try again.' },
      { status: 502 },
    )
  }

  // 2. Fire emails — non-blocking: sheet is already persisted, email failure is recoverable
  const emailResults = await Promise.allSettled([
    sendConfirmationEmail(data),
    sendAdminNotification(data),
  ])

  for (const result of emailResults) {
    if (result.status === 'rejected') {
      console.error('[allocation] Email delivery failed:', result.reason)
    }
  }

  return NextResponse.json({ success: true }, { status: 200 })
}

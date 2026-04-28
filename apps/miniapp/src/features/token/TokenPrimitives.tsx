'use client'

import { useEffect, useState } from 'react'

// ── LiveDot ──────────────────────────────────────────────────────────────────
export function LiveDot({ color = 'emerald' }: { color?: 'emerald' | 'cyan' }) {
  const cls = color === 'cyan' ? 'bg-cyan-400' : 'bg-emerald-400'
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cls} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${cls}`} />
    </span>
  )
}

// ── Pill ─────────────────────────────────────────────────────────────────────
type PillTone = 'live' | 'cyan' | 'white'

const PILL_CLS: Record<PillTone, string> = {
  live:  'bg-emerald-400/10 border border-emerald-400/30 text-emerald-300',
  cyan:  'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400',
  white: 'bg-white/[0.05] border border-white/[0.12] text-white/50',
}

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.15em] ${PILL_CLS[tone]}`}>
      {children}
    </span>
  )
}

// ── Countdown ────────────────────────────────────────────────────────────────
interface TimeLeft { d: number; h: number; m: number; s: number }

function calcTimeLeft(target: number): TimeLeft {
  const diff = Math.max(target - Date.now(), 0)
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1_000),
  }
}

export function Countdown({ target }: { target: number }) {
  const [mounted, setMounted] = useState(false)
  const [t, setT] = useState<TimeLeft>({ d: 0, h: 0, m: 0, s: 0 })

  useEffect(() => {
    setMounted(true)
    setT(calcTimeLeft(target))
    const id = setInterval(() => setT(calcTimeLeft(target)), 1_000)
    return () => clearInterval(id)
  }, [target])

  const pad = (n: number) => String(n).padStart(2, '0')
  const units = [
    { label: 'Days',  val: pad(t.d) },
    { label: 'Hours', val: pad(t.h) },
    { label: 'Mins',  val: pad(t.m) },
    { label: 'Secs',  val: pad(t.s) },
  ]

  return (
    <div className="flex justify-center gap-1 md:gap-1.5 mb-2" suppressHydrationWarning>
      {units.map(({ label, val }, i) => (
        <div key={label} className="flex items-center gap-1 md:gap-1.5">
          <div
            className="flex flex-col items-center rounded-xl px-2 md:px-3 py-2 md:py-2.5 min-w-[46px] md:min-w-[54px] backdrop-blur-md"
            style={{ background: 'rgba(20, 20, 22, 0.70)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xl md:text-2xl font-bold text-white leading-none tabular-nums font-display">
              {mounted ? val : '--'}
            </span>
            <span className="text-[8px] md:text-[9px] text-white/35 uppercase tracking-widest mt-1">{label}</span>
          </div>
          {i < 3 && <span className="text-white/20 font-bold pb-3 md:pb-4 text-xs md:text-sm">:</span>}
        </div>
      ))}
    </div>
  )
}

// ── TokenDonut ───────────────────────────────────────────────────────────────
interface Slice { label: string; pct: number; color: string }

export function TokenDonut({ slices, size = 280 }: { slices: Slice[]; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r  = size / 2 - 18
  const strokeW = 28
  const c  = 2 * Math.PI * r

  let offset = 0
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0a0a0a" strokeWidth={strokeW} />
      {slices.map(({ label, pct, color }) => {
        const len = (pct / 100) * c
        const dashOffset = -offset
        offset += len
        return (
          <circle
            key={label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={dashOffset}
          />
        )
      })}
    </svg>
  )
}

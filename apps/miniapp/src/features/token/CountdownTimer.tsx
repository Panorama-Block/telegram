'use client'

import { useEffect, useRef, useState } from 'react'
import { TOKEN_CONFIG } from './config'

interface TimeLeft {
  days: number
  hours: number
  mins: number
  secs: number
}

export function CountdownTimer() {
  // useRef so the target doesn't reset on re-renders
  const targetRef = useRef<number>(
    Date.now() + TOKEN_CONFIG.countdownDays * 24 * 60 * 60 * 1000,
  )

  const [time, setTime] = useState<TimeLeft>({
    days: TOKEN_CONFIG.countdownDays,
    hours: 0,
    mins: 0,
    secs: 0,
  })

  useEffect(() => {
    const tick = () => {
      const diff = targetRef.current - Date.now()
      if (diff <= 0) {
        setTime({ days: 0, hours: 0, mins: 0, secs: 0 })
        return
      }
      setTime({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        mins: Math.floor((diff % 3_600_000) / 60_000),
        secs: Math.floor((diff % 60_000) / 1_000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  const units = [
    { label: 'Days', value: pad(time.days) },
    { label: 'Hours', value: pad(time.hours) },
    { label: 'Mins', value: pad(time.mins) },
    { label: 'Secs', value: pad(time.secs) },
  ]

  return (
    <div className="flex justify-center gap-2 mb-5">
      {units.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 min-w-[60px]"
        >
          <span className="text-2xl font-bold text-white leading-none tabular-nums">
            {value}
          </span>
          <span className="text-[9px] text-white/35 uppercase tracking-widest mt-1">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

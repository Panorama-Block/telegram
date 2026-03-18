'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LandingPage from '@/features/landing'

export default function Page() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      router.replace('/chat?new=true')
    } else {
      setChecked(true)
    }
  }, [router])

  if (!checked) return null

  return <LandingPage />
}

'use client'

import { useEffect, useState } from 'react'
import { CURRENCIES, TOKEN_CONFIG, type Currency } from './config'

export function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function useLiveRaised(): number {
  const [raised, setRaised] = useState<number>(TOKEN_CONFIG.raisedUSD)
  useEffect(() => {
    const id = setInterval(() => {
      setRaised(r => Math.min(r + Math.random() * 80 + 20, TOKEN_CONFIG.hardCapUSD))
    }, 8_000)
    return () => clearInterval(id)
  }, [])
  return raised
}

export function useLiveParticipants(): number {
  const [count, setCount] = useState<number>(TOKEN_CONFIG.participants)
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() < 0.3) setCount(c => c + 1)
    }, 15_000)
    return () => clearInterval(id)
  }, [])
  return count
}

export interface CalcState {
  currency: Currency
  setCurrency: (c: Currency) => void
  payAmount: string
  setPayAmount: (v: string) => void
  tokensReceived: number
  valueAtListing: number
  canRequest: boolean
}

export function useCalc(): CalcState {
  const [currency, setCurrency] = useState<Currency>('USDT')
  const [payAmount, setPayAmount] = useState('')

  const usdValue = (parseFloat(payAmount) || 0) * TOKEN_CONFIG.rates[currency]
  const tokensReceived = usdValue > 0 ? Math.floor(usdValue / TOKEN_CONFIG.seedPrice) : 0
  const valueAtListing = tokensReceived * TOKEN_CONFIG.listingPrice
  const minInCurrency = TOKEN_CONFIG.minInvestmentUSD / TOKEN_CONFIG.rates[currency]
  const canRequest = parseFloat(payAmount) >= minInCurrency && parseFloat(payAmount) > 0

  return { currency, setCurrency, payAmount, setPayAmount, tokensReceived, valueAtListing, canRequest }
}

export interface TxEntry {
  id: string
  addr: string
  amount: number
  currency: string
  secondsAgo: number
  isNew: boolean
}

const MOCK_ADDRS = ['0x4f3a…b8', '0x7c91…2d', '0x1a5e…f4', '0xd892…77', '0x3b7f…a1', '0x9e2c…33', '0x5d8f…6a']

function makeTx(secondsAgo = 0, isNew = true): TxEntry {
  return {
    id: Math.random().toString(36).slice(2),
    addr: MOCK_ADDRS[Math.floor(Math.random() * MOCK_ADDRS.length)],
    amount: Math.floor(Math.random() * 4_750 + 250),
    currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
    secondsAgo,
    isNew,
  }
}

const SEED_FEED: TxEntry[] = Array.from({ length: 8 }, (_, i) =>
  makeTx((i + 1) * 48, false),
)

export function useTxFeed(): TxEntry[] {
  const [feed, setFeed] = useState<TxEntry[]>(SEED_FEED)

  useEffect(() => {
    const age = setInterval(() => {
      setFeed(f => f.map(tx => ({ ...tx, secondsAgo: tx.secondsAgo + 5, isNew: false })))
    }, 5_000)
    const add = setInterval(() => {
      setFeed(f => [makeTx(0, true), ...f.slice(0, 7)])
    }, 12_000)
    return () => {
      clearInterval(age)
      clearInterval(add)
    }
  }, [])

  return feed
}

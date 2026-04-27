'use client'

import { useState } from 'react'
import { TOKEN_CONFIG, type Currency } from './config'

interface AllocationModalProps {
  isOpen: boolean
  onClose: () => void
  amount: string
  currency: Currency
  tokensReceived: string
}

type Step = 'form' | 'instructions'

export function AllocationModal({
  isOpen,
  onClose,
  amount,
  currency,
  tokensReceived,
}: AllocationModalProps) {
  const [step, setStep] = useState<Step>('form')
  const [walletAddress, setWalletAddress] = useState('')
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const usdValue = (parseFloat(amount) || 0) * TOKEN_CONFIG.rates[currency]
  const isValidAddress = walletAddress.startsWith('0x') && walletAddress.length === 42

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Send allocation request to backend when ready
    // await submitAllocationRequest({ walletAddress, email, amount, currency, tokensReceived })
    setStep('instructions')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(TOKEN_CONFIG.multisigAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setStep('form')
    setWalletAddress('')
    setEmail('')
    setConfirmed(false)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0A1520] border border-pano-primary/25 rounded-2xl shadow-[0_0_40px_hsl(var(--pano-primary)/0.12)] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div>
              <h2 className="text-base font-bold text-white">
                {step === 'form' ? 'Request Allocation' : 'Transfer Instructions'}
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                {step === 'form' ? 'Seed Round · $PANBLK' : 'Complete your allocation below'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── STEP 1: Form ── */}
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Summary card */}
              <div className="bg-pano-primary/[0.06] border border-pano-primary/20 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">You send</span>
                  <span className="text-white font-semibold">
                    {amount} {currency}
                    {usdValue > 0 && (
                      <span className="text-white/40 text-xs ml-1">(~${usdValue.toLocaleString()})</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">You receive</span>
                  <span className="text-pano-text-accent font-bold">{tokensReceived} $PANBLK</span>
                </div>
              </div>

              {/* Wallet address */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5 block">
                  Your EVM Wallet Address *
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={e => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  required
                  className="w-full bg-white/[0.05] border border-white/10 focus:border-pano-primary/50 rounded-xl px-4 h-12 text-sm text-white placeholder-white/20 outline-none transition-colors font-mono"
                />
                {walletAddress && !isValidAddress && (
                  <p className="text-[10px] text-pano-error mt-1">
                    Enter a valid EVM address (starts with 0x, 42 characters)
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5 block">
                  Email{' '}
                  <span className="text-white/25 normal-case tracking-normal">(optional — for round updates)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/[0.05] border border-white/10 focus:border-pano-primary/50 rounded-xl px-4 h-12 text-sm text-white placeholder-white/20 outline-none transition-colors"
                />
              </div>

              {/* Confirm checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  required
                  className="mt-0.5 accent-cyan-400 cursor-pointer"
                />
                <span className="text-xs text-white/45 leading-relaxed group-hover:text-white/60 transition-colors">
                  I understand this is a manual allocation process. Tokens are subject to a{' '}
                  {TOKEN_CONFIG.vestingCliffMonths}-month cliff and{' '}
                  {TOKEN_CONFIG.vestingDurationMonths}-month linear vesting schedule.
                </span>
              </label>

              <button
                type="submit"
                disabled={!confirmed || !walletAddress || !isValidAddress || !amount}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-pano-primary to-pano-primary-hover text-black font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
              >
                Continue →
              </button>
            </form>
          )}

          {/* ── STEP 2: Instructions ── */}
          {step === 'instructions' && (
            <div className="p-6 space-y-4">
              {/* Success header */}
              <div className="flex flex-col items-center text-center py-2">
                <div className="w-12 h-12 rounded-full bg-pano-primary/20 border border-pano-primary/40 flex items-center justify-center mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-pano-text-accent">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-bold text-lg">Allocation Reserved</p>
                <p className="text-white/40 text-xs mt-1">
                  Complete the steps below to confirm your spot
                </p>
              </div>

              {/* Step 1: Transfer */}
              <div className="bg-pano-primary/[0.06] border border-pano-primary/20 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-semibold text-pano-text-accent uppercase tracking-wider">
                  Step 1 — Send Funds
                </p>
                <div>
                  <p className="text-[10px] text-white/40 mb-0.5">Transfer exactly</p>
                  <p className="text-white font-bold text-xl">{amount} {currency}</p>
                  {usdValue > 0 && (
                    <p className="text-white/35 text-xs">≈ ${usdValue.toLocaleString()} USD</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-white/40 mb-1.5">To this multisig address</p>
                  <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2.5">
                    <code className="text-pano-text-accent text-xs flex-1 break-all font-mono">
                      {TOKEN_CONFIG.multisigAddress}
                    </code>
                    <button
                      onClick={handleCopy}
                      type="button"
                      className="text-white/40 hover:text-white transition-colors flex-shrink-0"
                      aria-label="Copy address"
                    >
                      {copied ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-pano-success">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Confirm via Telegram */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Step 2 — Confirm via Telegram
                </p>
                <p className="text-xs text-white/40 leading-relaxed">
                  After transferring, send your{' '}
                  <span className="text-white/70">transaction hash</span> and{' '}
                  <span className="text-white/70">wallet address</span> to our Telegram:{' '}
                  <a
                    href="https://t.me/panoramablock"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pano-text-accent hover:underline"
                  >
                    @panoramablock
                  </a>
                </p>
              </div>

              {/* Vesting reminder */}
              <div className="bg-yellow-500/[0.06] border border-yellow-500/20 rounded-xl px-4 py-3">
                <p className="text-[11px] text-yellow-400/75 leading-relaxed text-center">
                  ⚠ Tokens distributed after TGE subject to vesting schedule.
                  <br />
                  {TOKEN_CONFIG.tgeUnlockPercent}% at TGE · monthly release from Month{' '}
                  {TOKEN_CONFIG.vestingCliffMonths + 1}.
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full h-11 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm font-medium transition-all"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Wallet, Mail, MessageCircle, DollarSign, AlertCircle, Loader2, Phone } from 'lucide-react'
import { TOKEN_CONFIG } from './config'

interface AllocationModalProps {
  isOpen: boolean
  onClose: () => void
}

type Step = 'form' | 'submitted'

export function AllocationModal({ isOpen, onClose }: AllocationModalProps) {
  const [step, setStep]           = useState<Step>('form')
  const [amountUSD, setAmountUSD] = useState('')
  const [wallet, setWallet]       = useState('')
  const [email, setEmail]         = useState('')
  const [telegram, setTelegram]   = useState('')
  const [phone, setPhone]         = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [apiError, setApiError]   = useState('')

  const usd            = parseFloat(amountUSD) || 0
  const tokens         = usd > 0 ? Math.floor(usd / TOKEN_CONFIG.seedPrice) : 0
  const valueAtListing = tokens * TOKEN_CONFIG.listingPrice
  const walletFilled   = wallet.trim().length > 0
  const isValidWallet  = !walletFilled || (wallet.startsWith('0x') && wallet.length === 42)
  const isValidAmount  = usd >= TOKEN_CONFIG.minInvestmentUSD && usd <= TOKEN_CONFIG.maxInvestmentUSD
  const hasContact     = email.trim().length > 0 || telegram.trim().length > 0
  const canSubmit      = confirmed && isValidWallet && isValidAmount && hasContact

  const contactMethod = email && telegram
    ? 'email or Telegram'
    : email ? 'email' : 'Telegram'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setApiError('')
    try {
      const res = await fetch('/miniapp/api/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUSD: usd, tokens, wallet, email, telegram, phone }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }
      setStep('submitted')
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('form')
    setAmountUSD('')
    setWallet('')
    setEmail('')
    setTelegram('')
    setPhone('')
    setConfirmed(false)
    setApiError('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-10 top-1/2 -translate-y-1/2 z-50 sm:inset-x-0 sm:flex sm:items-center sm:justify-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full max-w-sm mx-auto bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {step === 'form' ? 'Request Allocation' : 'Request Submitted'}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Seed Round · $PANBLK</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1: Form */}
              {step === 'form' && (
                <form onSubmit={handleSubmit} className="p-4 space-y-4">

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      Intended Investment (USD)
                    </label>
                    <div className={`flex items-center bg-zinc-900/50 border rounded-xl px-4 h-10 gap-2 transition-colors ${
                      amountUSD ? 'border-primary/50 ring-1 ring-primary/20' : 'border-white/10'
                    }`}>
                      <span className="text-zinc-500 text-sm">$</span>
                      <input
                        type="number"
                        value={amountUSD}
                        onChange={e => setAmountUSD(e.target.value)}
                        placeholder="0"
                        required
                        className="bg-transparent flex-1 text-white text-base font-semibold outline-none placeholder:text-zinc-600 tabular-nums w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-zinc-500 text-sm">USD</span>
                    </div>
                    {amountUSD && !isValidAmount && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Between ${TOKEN_CONFIG.minInvestmentUSD.toLocaleString()} and ${TOKEN_CONFIG.maxInvestmentUSD.toLocaleString()}
                      </p>
                    )}
                    {tokens > 0 && (
                      <div className="bg-zinc-900/80 rounded-lg px-3 py-2 border border-white/5 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-zinc-500">You receive</span>
                        <span className="text-sm font-bold text-primary">{tokens.toLocaleString()} PANBLK</span>
                        <span className="text-xs text-zinc-600">≈ ${valueAtListing.toLocaleString()} at listing</span>
                      </div>
                    )}
                  </div>

                  {/* Wallet */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                      EVM Wallet Address
                      <span className="text-xs text-zinc-600 font-normal">optional</span>
                    </label>
                    <input
                      type="text"
                      value={wallet}
                      onChange={e => setWallet(e.target.value)}
                      placeholder="0x... (leave blank if you don't have one yet)"
                      className="w-full h-10 bg-zinc-900/50 border border-white/10 rounded-xl px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm"
                    />
                    {walletFilled && !isValidWallet && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Valid EVM address required (0x + 40 characters)
                      </p>
                    )}
                  </div>

                  {/* Contact — side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-10 bg-zinc-900/50 border border-white/10 rounded-xl px-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5" />
                        Telegram
                        <span className="text-xs text-zinc-600 font-normal">optional</span>
                      </label>
                      <input
                        type="text"
                        value={telegram}
                        onChange={e => setTelegram(e.target.value)}
                        placeholder="@handle"
                        className="w-full h-10 bg-zinc-900/50 border border-white/10 rounded-xl px-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      Phone
                      <span className="text-xs text-zinc-600 font-normal">optional</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+1 212 555 0000"
                      className="w-full h-10 bg-zinc-900/50 border border-white/10 rounded-xl px-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm"
                    />
                  </div>

                  {amountUSD && !hasContact && (
                    <p className="text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3" />
                      Provide at least one contact method
                    </p>
                  )}

                  {/* Checkbox */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      required
                      className="mt-0.5 accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-xs text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">
                      I understand this is a manual process. Payment instructions are sent only after allocation is confirmed. Tokens vest {TOKEN_CONFIG.vestingDurationMonths}mo with {TOKEN_CONFIG.vestingCliffMonths}mo cliff. I have read and agree to the{' '}
                      <a
                        href="/miniapp/PanoramaBlockTermsofService_Disclaimers.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                      >
                        Terms of Service & Disclaimers
                      </a>.
                    </span>
                  </label>

                  {apiError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {apiError}
                    </p>
                  )}

                  {/* Footer actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={loading}
                      className="px-4 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmit || loading}
                      className="flex-1 h-10 rounded-xl bg-primary text-black font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                      ) : (
                        'Submit Request →'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Confirmation */}
              {step === 'submitted' && (
                <div className="p-4 space-y-4">
                  {/* Success icon + title */}
                  <div className="flex flex-col items-center text-center py-2 gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">Request Submitted</p>
                      <p className="text-sm text-zinc-500 mt-1 leading-relaxed max-w-xs">
                        Our team will review and reach out with confirmation and payment instructions.
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-zinc-900/80 rounded-xl p-4 border border-white/5 space-y-3">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Summary</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Intended amount</span>
                        <span className="text-white font-medium">${usd.toLocaleString()} USD</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Tokens requested</span>
                        <span className="text-primary font-bold">{tokens.toLocaleString()} PANBLK</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Wallet submitted</span>
                        {walletFilled
                          ? <span className="text-zinc-300 font-mono text-xs">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>
                          : <span className="text-zinc-600 text-xs italic">to be provided</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Next step note */}
                  <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3">
                    <p className="text-xs text-primary/80 leading-relaxed text-center">
                      We&apos;ll contact you via {contactMethod} to confirm your spot before sending payment details. No funds needed yet.
                    </p>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all font-medium text-sm"
                  >
                    Close
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

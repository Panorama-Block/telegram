import React, { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { TokenSelectorModal } from './TokenSelectorModal';

interface LiquiditySelectionCardProps {
  onContinue: (data: {
    fromToken: string;
    toToken: string;
    amount: string;
  }) => void;
  onCancel: () => void;
  className?: string;
}

export function LiquiditySelectionCard({
  onContinue,
  onCancel,
  className = '',
}: LiquiditySelectionCardProps) {
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [amount, setAmount] = useState('');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectingField, setSelectingField] = useState<'from' | 'to' | null>(null);

  const handleContinue = () => {
    if (fromToken && toToken && amount) {
      onContinue({ fromToken, toToken, amount });
    }
  };

  const handleOpenTokenSelector = (field: 'from' | 'to') => {
    setSelectingField(field);
    setShowTokenSelector(true);
  };

  const handleSelectToken = (token: string) => {
    if (selectingField === 'from') {
      setFromToken(token);
    } else if (selectingField === 'to') {
      setToToken(token);
    }
    setShowTokenSelector(false);
    setSelectingField(null);
  };

  const handleCloseTokenSelector = () => {
    setShowTokenSelector(false);
    setSelectingField(null);
  };

  return (
    <div
      className={cn(
        'animate-slideUp rounded-[20px] bg-[#1A1A1A] shadow-2xl',
        'w-full max-w-[440px] mx-auto',
        'font-sans', // SuisseIntl
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5">
        <h3 className="text-base font-medium text-white">
          Preview Liquidity Position
        </h3>
        <button
          onClick={onCancel}
          className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pb-3 space-y-2">
        {/* From */}
        <div className="space-y-1.5">
          <label className="text-xs font-normal text-gray-400">From</label>
          <button
            onClick={() => handleOpenTokenSelector('from')}
            className="w-full flex items-center gap-3 px-4 py-2 bg-[#2A2A2A] hover:bg-[#333333] rounded-xl transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">{fromToken ? fromToken[0] : '?'}</span>
            </div>
            <span className="flex-1 text-left text-sm text-gray-400">
              {fromToken || 'Select chain token'}
            </span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Arrow Down */}
        <div className="flex justify-center -my-1">
          <div className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* To */}
        <div className="space-y-1.5">
          <label className="text-xs font-normal text-gray-400">To</label>
          <button
            onClick={() => handleOpenTokenSelector('to')}
            className="w-full flex items-center gap-3 px-4 py-2 bg-[#2A2A2A] hover:bg-[#333333] rounded-xl transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">{toToken ? toToken[0] : '?'}</span>
            </div>
            <span className="flex-1 text-left text-sm text-gray-400">
              {toToken || 'Select chain token'}
            </span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="text-xs font-normal text-gray-400">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-4 pr-16 py-2 bg-[#2A2A2A] text-white text-2xl font-bold rounded-xl outline-none focus:ring-2 focus:ring-white/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-normal text-gray-400 pointer-events-none">
              Max
            </span>
          </div>
        </div>

        {/* Connect Wallet Button */}
        <button
          onClick={handleContinue}
          className="w-full py-2.5 rounded-xl bg-white hover:bg-gray-100 text-black text-sm font-bold transition-all mt-3"
        >
          Connect Source Wallet
        </button>

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-6 pt-2">
          <button className="text-xs text-gray-400 hover:text-white transition-colors underline">
            Resume Transaction
          </button>
          <button className="text-xs text-gray-400 hover:text-white transition-colors underline">
            Terms of Use
          </button>
        </div>
      </div>

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <TokenSelectorModal
          onSelectToken={handleSelectToken}
          onClose={handleCloseTokenSelector}
        />
      )}
    </div>
  );
}

export default LiquiditySelectionCard;

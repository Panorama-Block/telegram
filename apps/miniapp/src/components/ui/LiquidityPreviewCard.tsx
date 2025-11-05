import React from 'react';
import { cn } from '@/shared/lib/utils';
import type { LiquidityQuoteResponse } from '@/features/liquidity/types';

interface LiquidityPreviewCardProps {
  quote: LiquidityQuoteResponse['quote'];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

export function LiquidityPreviewCard({
  quote,
  onConfirm,
  onCancel,
  isLoading = false,
  className = '',
}: LiquidityPreviewCardProps) {
  if (!quote) return null;

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
        {/* Token Pair Header with darker background and rounded corners */}
        <div className="flex items-center gap-2.5 bg-[#303030] rounded-[16px] pl-2.5 pr-2.5 py-0.5">
          {/* Overlapping Token Icons */}
          <div className="relative flex items-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 border-2 border-[#303030] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">{quote.token0.symbol[0]}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-[#303030] flex items-center justify-center -ml-2">
              <span className="text-[11px] font-bold text-white">{quote.token1.symbol[0]}</span>
            </div>
          </div>

          {/* Token Names and Fee Badge */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-base font-bold text-white tracking-tight">
              {quote.token0.symbol}/{quote.token1.symbol}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-400 text-black text-[11px] font-bold">
              {quote.feeTierLabel}
            </span>
          </div>
        </div>

        {/* Token Deposited */}
        <div className="space-y-1.5">
          <p className="text-xs font-normal text-gray-400">
            Token Deposited
          </p>

          {/* USD Value - DESTAQUE */}
          <div className="text-2xl font-bold text-white">
            ${parseFloat(quote.token0.usdValue || '278').toFixed(2)}
          </div>

          {/* Token List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-white">{quote.token0.symbol[0]}</span>
                </div>
                <span className="text-base font-medium text-white">{quote.token0.symbol}</span>
              </div>
              <span className="text-base font-normal text-white tabular-nums">{quote.token0.amount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-white">{quote.token1.symbol[0]}</span>
                </div>
                <span className="text-base font-medium text-white">{quote.token1.symbol}</span>
              </div>
              <span className="text-base font-normal text-white tabular-nums">{quote.token1.amount}</span>
            </div>
          </div>
        </div>

        {/* Divider Line */}
        <div className="border-t border-white/20"></div>

        {/* Min. Amounts of Liquidity to Add */}
        <div className="space-y-1.5">
          <p className="text-xs font-normal text-gray-400">
            Min. Amounts of Liquidity to Add
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-white">{quote.token0.symbol[0]}</span>
                </div>
                <span className="text-base font-medium text-white">{quote.token0.symbol}</span>
              </div>
              <span className="text-base font-normal text-white tabular-nums">0</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-white">{quote.token1.symbol[0]}</span>
                </div>
                <span className="text-base font-medium text-white">{quote.token1.symbol}</span>
              </div>
              <span className="text-base font-normal text-white tabular-nums">
                {(parseFloat(quote.token1.amount) * 0.995).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider Line */}
        <div className="border-t border-white/20"></div>

        {/* Price Range */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-xs font-normal text-gray-400">
              Price Range
            </p>
            <div className="flex items-center gap-1">
              <button className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-black text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-colors">
                {quote.token0.symbol}
              </button>
              <button className="inline-flex items-center px-2 py-0.5 rounded-md bg-transparent text-gray-400 text-xs font-normal cursor-pointer hover:bg-white/10 transition-colors">
                {quote.token1.symbol}
              </button>
            </div>
          </div>

          {/* Price Cards - VALORES GRANDES */}
          <div className="grid grid-cols-2 gap-3">
            {/* Min Card */}
            <div className="rounded-2xl bg-[#0D0D0D] border border-white/20 p-3 text-center">
              <p className="text-xs text-gray-400 mb-1.5">Min</p>
              <p className="text-[32px] font-bold text-white leading-none mb-2 tabular-nums">
                {parseFloat(quote.priceRange.min).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
              <p className="text-[11px] text-gray-500">
                {quote.token1.symbol} per {quote.token0.symbol}
              </p>
            </div>

            {/* Max Card */}
            <div className="rounded-2xl bg-[#0D0D0D] border border-white/20 p-3 text-center">
              <p className="text-xs text-gray-400 mb-1.5">Max</p>
              <p className="text-[32px] font-bold text-white leading-none mb-2 tabular-nums">
                {parseFloat(quote.priceRange.max).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
              <p className="text-[11px] text-gray-500">
                {quote.token1.symbol} per {quote.token0.symbol}
              </p>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="space-y-1.5">
          {/* Fee Tier Row */}
          <div className="border border-white/20 rounded-[20px] px-4 py-2 -mx-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-normal text-gray-400">Fee Tier</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-cyan-400 text-[11px] font-medium">
                  Best for Very Stable Pairs
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="currentColor" />
                    <path d="M6.5 10.5l2 2 5-5" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-sm font-normal text-white">
                  {quote.feeTierLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Est. Total Gas Fee */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-normal text-gray-400">Est. Total Gas Fee</span>
            <span className="text-sm font-normal text-white tabular-nums">
              {parseFloat(quote.estimatedGasFee || '0.00024').toFixed(5)} ETH
            </span>
          </div>

          {/* Slippage Setting */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-normal text-gray-400">Slippage Setting</span>
            <span className="text-sm font-normal text-white">10%</span>
          </div>

          {/* Order Routing */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-normal text-gray-400">Order Routing</span>
            <div className="flex items-center gap-1.5">
              {/* UNI V3 Logo - White circle */}
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <span className="text-[10px] font-bold text-black">🦄</span>
              </div>
              <span className="text-sm font-medium text-white">UNI V3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 pb-3 flex gap-3">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl bg-[#2A2A2A] hover:bg-[#333333] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-black text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            'Confirm Open Position'
          )}
        </button>
      </div>
    </div>
  );
}

export default LiquidityPreviewCard;

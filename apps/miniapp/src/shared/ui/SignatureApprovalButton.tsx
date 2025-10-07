'use client';

import React, { useState } from 'react';

interface SignatureApprovalButtonProps {
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function SignatureApprovalButton({ onApprove, onReject, disabled = false }: SignatureApprovalButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-gray-700/50 rounded-lg border border-cyan-500/30">
      <div className="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-cyan-400">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-sm font-medium text-cyan-300">Signature Required</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Please approve or reject this transaction signature
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={disabled || isProcessing}
          className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white text-sm font-medium rounded-lg transition-all disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Approving...
            </div>
          ) : (
            'Approve'
          )}
        </button>
        <button
          onClick={handleReject}
          disabled={disabled || isProcessing}
          className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white text-sm font-medium rounded-lg transition-all disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Rejecting...
            </div>
          ) : (
            'Reject'
          )}
        </button>
      </div>
    </div>
  );
}

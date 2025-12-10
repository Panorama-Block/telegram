'use client';

import React, { createContext, ReactNode, useContext, useState } from 'react';

interface TransactionSettingsContextType {
  slippage: string;
  setSlippage: (value: string) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  expertMode: boolean;
  setExpertMode: (value: boolean) => void;
}

const TransactionSettingsContext = createContext<TransactionSettingsContextType | undefined>(undefined);

export function TransactionSettingsProvider({ children }: { children: ReactNode }) {
  const [slippage, setSlippage] = useState('0.5');
  const [deadline, setDeadline] = useState('20');
  const [expertMode, setExpertMode] = useState(false);

  return (
    <TransactionSettingsContext.Provider
      value={{ slippage, setSlippage, deadline, setDeadline, expertMode, setExpertMode }}
    >
      {children}
    </TransactionSettingsContext.Provider>
  );
}

export function useTransactionSettings() {
  const ctx = useContext(TransactionSettingsContext);
  if (!ctx) {
    throw new Error('useTransactionSettings must be used within a TransactionSettingsProvider');
  }
  return ctx;
}

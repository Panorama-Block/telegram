'use client';

import React from 'react';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import './loader.css';

interface GlobalLoaderProps {
  isLoading: boolean;
  message?: string;
}

export function GlobalLoader({ isLoading, message }: GlobalLoaderProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-6">
        <Image
          src={zicoBlue}
          alt="Zico"
          width={64}
          height={64}
          className="w-16 h-16 animate-pulse"
        />
        <div className="loader-custom"></div>
      </div>

      {message && (
        <p className="text-gray-400 text-sm mt-4 animate-pulse">{message}</p>
      )}
    </div>
  );
}

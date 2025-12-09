'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import pblokNav from '../../../public/logos/pblok_nav.svg';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (path: string) => {
    router.push(path)
    onClose();
  };

  const menuItems = [
    {
      name: 'Chat',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      path: '/chat',
    },
    {
      name: 'Swap',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
      path: '/swap',
    },
    {
      name: 'DCA',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      path: '/dca',
    },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 transform border-r border-pano-border bg-pano-surface shadow-2xl shadow-black/40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pano-border-subtle px-4 py-4">
          <Image
            src={pblokNav}
            alt="Panorama Block"
            width={120}
            height={32}
            className="h-8 w-auto"
          />
          <button
            onClick={onClose}
            className="md:hidden rounded-lg border border-pano-border-subtle bg-pano-surface-elevated p-2 text-pano-text-muted hover:text-pano-text-primary transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col gap-2 px-4 py-6">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                pathname === item.path
                  ? 'border-pano-primary/60 bg-pano-primary/15 text-pano-text-primary shadow-lg'
                  : 'border-transparent text-pano-text-secondary hover:border-pano-border/60 hover:bg-pano-surface-elevated hover:text-pano-text-primary'
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-pano-border-subtle bg-pano-surface-elevated/80">
                {item.icon}
              </span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-pano-border-subtle px-4 py-4">
          <button
            onClick={async () => {
              try {
                // Clear all auth data
                localStorage.removeItem('authToken');
                localStorage.removeItem('authPayload');
                localStorage.removeItem('authSignature');
                localStorage.removeItem('telegram_user');

                // Close sidebar
                onClose();

                // Small delay to ensure localStorage is cleared
                await new Promise(resolve => setTimeout(resolve, 100));

                // Force page reload and redirect (basePath is /miniapp)
                window.location.href = '/miniapp';
              } catch (error) {
                console.error('Error disconnecting:', error);
                // Force redirect anyway
                window.location.href = '/miniapp';
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-pano-error/40 bg-pano-error/10 px-4 py-3 text-sm font-medium text-pano-error transition-all hover:border-pano-error/60 hover:bg-pano-error/15"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Disconnect</span>
          </button>
        </div>
      </aside>
    </>
  );
}

import React from 'react';

type WalletEntryActionsProps = {
  evmAction: React.ReactNode;
  tonAction?: React.ReactNode;
  variant?: 'page' | 'modal';
  className?: string;
};

type TonConnectActionButtonProps = {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  connected?: boolean;
  label?: string;
  connectedLabel?: string;
  className?: string;
};

export function WalletEntryHero({ size = 'page' }: { size?: 'page' | 'modal' }) {
  const logoSize = size === 'page' ? 'h-32 w-32 lg:h-40 lg:w-40' : 'h-24 w-24';

  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-cyan-400/18 blur-3xl" />
      <div className="absolute -inset-8 rounded-full bg-cyan-300/8 blur-[90px]" />
      <div className="absolute inset-4 rounded-full bg-cyan-200/12 blur-2xl" />
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-2xl" />
      </div>
      <div className={`relative ${logoSize}`}>
        <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-2xl" />
      </div>
    </div>
  );
}

export function WalletEntryActions({
  evmAction,
  tonAction,
  variant = 'page',
  className = '',
}: WalletEntryActionsProps) {
  const widthClass = variant === 'page' ? 'max-w-[320px]' : 'max-w-none';

  return (
    <div className={`wallet-entry-actions w-full ${widthClass} ${className}`}>
      <div className="flex w-full flex-col gap-3">
        {evmAction}
        {tonAction}
      </div>
    </div>
  );
}

export function TonConnectActionButton({
  onClick,
  disabled = false,
  loading = false,
  connected = false,
  label = 'Use TON Wallet',
  connectedLabel = 'TON Wallet Connected',
  className = '',
}: TonConnectActionButtonProps) {
  const text = connected ? connectedLabel : loading ? 'Opening TON...' : label;

  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      disabled={disabled || loading}
      className={[
        'group flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl border px-5 py-3 text-[17px] font-medium tracking-[0.01em] transition-all duration-200',
        'border-white/70 bg-black/20 text-white backdrop-blur-md',
        'hover:border-cyan-200 hover:bg-white/8 hover:text-cyan-50',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ].join(' ')}
      aria-label={text}
    >
      <TonWalletGlyph />
      <span className="font-mono text-[16px]">{text}</span>
    </button>
  );
}

function TonWalletGlyph() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/75">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6.2 5.5h11.6c.8 0 1.3.9.9 1.6l-5.3 9.3a1.6 1.6 0 0 1-2.8 0L5.3 7.1c-.4-.7.1-1.6.9-1.6Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M12 17.2V5.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

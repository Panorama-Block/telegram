'use client';

export function NotificationCenter() {
  return (
    <div className="relative">
      <button
        disabled
        className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-pano-text-muted/50 cursor-not-allowed rounded-full"
        aria-label="Notifications (coming soon)"
        title="Coming soon"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 10a2 2 0 10-4 0v1.586a1 1 0 01-.293.707L8 14h8l-1.707-1.707A1 1 0 0114 11.586V10z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 14h14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 18h4" />
        </svg>
      </button>
    </div>
  );
}

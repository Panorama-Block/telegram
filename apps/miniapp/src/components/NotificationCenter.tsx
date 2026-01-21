import { Bell } from "lucide-react";

export function NotificationCenter() {
  return (
    <div className="relative">
      <button
        disabled
        className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-600 cursor-not-allowed rounded-full"
        aria-label="Notifications (coming soon)"
        title="Coming soon"
      >
        <Bell className="w-5 h-5" />
      </button>
    </div>
  );
}

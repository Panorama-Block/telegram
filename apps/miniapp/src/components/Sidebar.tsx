import { motion } from "framer-motion";
import { 
  MessageSquare, 
  ArrowLeftRight, 
  Landmark, 
  Droplets, 
  Clock, 
  PieChart,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "portfolio", label: "Portfolio", icon: PieChart, type: 'link', path: '/portfolio' },
  { id: "swap", label: "Swap", icon: ArrowLeftRight },
  { id: "lending", label: "Lending", icon: Landmark },
  { id: "staking", label: "Liquid Staking", icon: Droplets },
  { id: "dca", label: "DCA", icon: Clock },
];

export function Sidebar({ activeTab, onTabChange, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <motion.div 
        className={cn(
          "w-64 h-screen border-r border-white/5 flex flex-col bg-[#050505]/95 backdrop-blur-xl fixed left-0 top-0 z-50 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-8 flex items-center justify-between lg:justify-center">
          <img 
            src="/logo.png" 
            alt="Panorama Block" 
            className="h-10 w-auto drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]"
          />
          {/* Mobile Close Button */}
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            
            if (item.type === 'link' && item.path) {
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={() => onClose()}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                    isActive 
                      ? "text-primary" 
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                  )}
                >
                   {isActive && (
                    <motion.div
                      layoutId="active-glow"
                      className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  <item.icon 
                    className={cn(
                      "w-5 h-5 relative z-10 transition-colors",
                      isActive ? "text-primary drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "text-current"
                    )} 
                  />
                  <span className={cn("relative z-10 font-medium text-sm tracking-wide", isActive && "text-glow")}>
                    {item.label}
                  </span>
                  
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full blur-[2px]" />
                  )}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onClose(); // Close sidebar on mobile when item selected
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                  isActive 
                    ? "text-primary" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-glow"
                    className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <item.icon 
                  className={cn(
                    "w-5 h-5 relative z-10 transition-colors",
                    isActive ? "text-primary drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "text-current"
                  )} 
                />
                <span className={cn("relative z-10 font-medium text-sm tracking-wide", isActive && "text-glow")}>
                  {item.label}
                </span>
                
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full blur-[2px]" />
                )}
              </button>
            );
          })}
        </nav>
      </motion.div>
    </>
  );
}

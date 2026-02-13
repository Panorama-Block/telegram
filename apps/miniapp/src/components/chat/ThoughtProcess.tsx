'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ThoughtStep } from '@/shared/hooks/useAgentStream';

interface ThoughtProcessProps {
  thoughts: ThoughtStep[];
  isStreaming: boolean;
}

export function ThoughtProcess({ thoughts, isStreaming }: ThoughtProcessProps) {
  if (thoughts.length === 0 && !isStreaming) return null;

  // Show only the last 4 thoughts to keep the UI compact
  const visibleThoughts = thoughts.slice(-4);

  return (
    <div className="flex flex-col gap-1.5 py-2 mb-1">
      <AnimatePresence mode="popLayout">
        {visibleThoughts.map((step) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center gap-2 text-xs"
          >
            {/* Pulsing dot for active step */}
            {step.status === 'active' ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
              </span>
            ) : (
              <span className="inline-flex h-2 w-2 rounded-full bg-zinc-600 shrink-0" />
            )}

            <span
              className={
                step.status === 'active'
                  ? 'text-cyan-300 font-medium'
                  : 'text-zinc-500'
              }
            >
              {step.label}
            </span>

            {/* Tool output badge */}
            {step.toolOutput && (
              <span className="ml-auto text-[10px] text-zinc-600 truncate max-w-[140px]">
                {step.toolOutput}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

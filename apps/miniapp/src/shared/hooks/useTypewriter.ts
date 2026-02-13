'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Gradually reveals `fullText` at a controlled pace, producing a
 * typewriter / "AI generating" visual effect.
 *
 * Characters are revealed in small chunks on a `requestAnimationFrame`
 * loop so the animation stays perfectly smooth without blocking the
 * main thread.
 *
 * @param fullText      The complete text received so far (grows as stream
 *                      delivers more tokens).
 * @param charsPerTick  How many characters to reveal per animation frame.
 *                      Lower = slower typewriter, higher = faster catch-up.
 *                      Default is 2 (≈120 chars/sec at 60 fps).
 */
export function useTypewriter(
  fullText: string,
  charsPerTick = 2,
): { displayed: string; isRevealing: boolean } {
  const [displayed, setDisplayed] = useState('');
  const cursorRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const fullTextRef = useRef(fullText);
  fullTextRef.current = fullText;

  useEffect(() => {
    const tick = () => {
      const target = fullTextRef.current;
      if (cursorRef.current < target.length) {
        cursorRef.current = Math.min(
          cursorRef.current + charsPerTick,
          target.length,
        );
        setDisplayed(target.slice(0, cursorRef.current));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [charsPerTick]);

  // When fullText shrinks (new stream started / reset), reset cursor
  useEffect(() => {
    if (fullText.length === 0) {
      cursorRef.current = 0;
      setDisplayed('');
    }
  }, [fullText]);

  const isRevealing = displayed.length < fullText.length;

  return { displayed, isRevealing };
}

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to detect virtual keyboard height and adjust layout accordingly.
 * Works with iOS Safari and Android Chrome.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Use visualViewport API if available (modern browsers)
    const viewport = window.visualViewport;

    if (viewport) {
      const handleResize = () => {
        // Calculate keyboard height from viewport difference
        const windowHeight = window.innerHeight;
        const viewportHeight = viewport.height;
        const heightDiff = windowHeight - viewportHeight;

        // Only consider it a keyboard if the difference is significant (> 150px)
        if (heightDiff > 150) {
          setKeyboardHeight(heightDiff);
          setIsKeyboardOpen(true);
        } else {
          setKeyboardHeight(0);
          setIsKeyboardOpen(false);
        }
      };

      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);

      // Initial check
      handleResize();

      return () => {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      };
    } else {
      // Fallback for older browsers - detect focus on inputs
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          // Estimate keyboard height (common values)
          const estimatedHeight = window.innerHeight * 0.4;
          setKeyboardHeight(estimatedHeight);
          setIsKeyboardOpen(true);
        }
      };

      const handleFocusOut = () => {
        setKeyboardHeight(0);
        setIsKeyboardOpen(false);
      };

      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}

/**
 * Hook to scroll to bottom when keyboard opens
 */
export function useScrollToBottomOnKeyboard(
  scrollRef: React.RefObject<HTMLElement>,
  isKeyboardOpen: boolean
) {
  useEffect(() => {
    if (isKeyboardOpen && scrollRef.current) {
      // Small delay to let the layout adjust
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isKeyboardOpen, scrollRef]);
}

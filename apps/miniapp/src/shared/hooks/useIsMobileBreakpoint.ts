import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";

/**
 * Reactive mobile breakpoint detection for modal animation/layout decisions.
 */
export function useIsMobileBreakpoint(): boolean {
  const getInitial = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  };

  const [isMobile, setIsMobile] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  return isMobile;
}

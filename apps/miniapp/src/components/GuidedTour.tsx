'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ONBOARDING_TOUR, TOUR_STORAGE_KEY, type TourStep } from '@/lib/tour-steps';

interface GuidedTourProps {
  /** Override the default step list */
  steps?: TourStep[];
  /** Called when tour finishes or is skipped */
  onComplete?: () => void;
  /** Force-show the tour even if already completed */
  forceShow?: boolean;
}

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PADDING = 8;
const BORDER_RADIUS = 16;
const TOOLTIP_GAP = 12;

export function GuidedTour({ steps = ONBOARDING_TOUR, onComplete, forceShow }: GuidedTourProps) {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Check if tour should show
  useEffect(() => {
    if (forceShow) {
      setActive(true);
      return;
    }
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      // Delay to let page elements render
      const timer = setTimeout(() => setActive(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  // Compute spotlight rect for current step
  const updateSpotlight = useCallback(() => {
    if (!active) return;
    const step = steps[currentStep];
    if (!step) return;

    const el = document.querySelector(step.target);
    if (!el) {
      // If element not found, show centered (no spotlight)
      setSpotlight(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setSpotlight({
      x: rect.left - PADDING,
      y: rect.top - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    });

    // Scroll element into view if off-screen
    const isVisible =
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight;
    if (!isVisible) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Re-measure after scroll
      requestAnimationFrame(() => {
        const newRect = el.getBoundingClientRect();
        setSpotlight({
          x: newRect.left - PADDING,
          y: newRect.top - PADDING,
          width: newRect.width + PADDING * 2,
          height: newRect.height + PADDING * 2,
        });
      });
    }
  }, [active, currentStep, steps]);

  // Update spotlight on step change and on resize/scroll
  useEffect(() => {
    updateSpotlight();

    const handleResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateSpotlight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateSpotlight]);

  // Fire step action, then re-measure spotlight multiple times as animations settle
  useEffect(() => {
    if (!active) return;
    const step = steps[currentStep];
    if (step?.action) {
      step.action();
      // Re-measure at several points to catch sidebar + widget spring animations
      const timers = [200, 450, 700, 900].map((ms) =>
        setTimeout(updateSpotlight, ms),
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [active, currentStep, steps, updateSpotlight]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        completeTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, currentStep]);

  const completeTour = useCallback(() => {
    setActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    onComplete?.();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      completeTour();
    }
  }, [currentStep, steps.length, completeTour]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  // Compute tooltip position with auto-fallback + viewport clamping
  const getTooltipStyle = (): React.CSSProperties => {
    const step = steps[currentStep];
    if (!spotlight || !step) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TOOLTIP_W = Math.min(320, vw - 32);
    const TOOLTIP_H = 220; // approximate
    const MARGIN = 12;

    // Available space in each direction
    const spaceTop = spotlight.y;
    const spaceBottom = vh - (spotlight.y + spotlight.height);
    const spaceLeft = spotlight.x;
    const spaceRight = vw - (spotlight.x + spotlight.width);

    // Pick best placement: preferred, fallback to where there is space
    let placement = step.placement;
    const needed = placement === 'top' || placement === 'bottom' ? TOOLTIP_H + MARGIN : TOOLTIP_W + MARGIN;
    const fits = {
      top: spaceTop >= TOOLTIP_H + MARGIN,
      bottom: spaceBottom >= TOOLTIP_H + MARGIN,
      left: spaceLeft >= TOOLTIP_W + MARGIN,
      right: spaceRight >= TOOLTIP_W + MARGIN,
    };
    if (!fits[placement]) {
      // Pick the side with most space
      const best = (Object.keys(fits) as Array<keyof typeof fits>)
        .filter((k) => fits[k])
        .sort((a, b) => {
          const map = { top: spaceTop, bottom: spaceBottom, left: spaceLeft, right: spaceRight };
          return map[b] - map[a];
        })[0];
      if (best) placement = best;
      // If nothing fits, overlay at bottom of viewport
    }

    let top: number;
    let left: number;

    switch (placement) {
      case 'bottom':
        top = spotlight.y + spotlight.height + TOOLTIP_GAP;
        left = spotlight.x + spotlight.width / 2 - TOOLTIP_W / 2;
        break;
      case 'top':
        top = spotlight.y - TOOLTIP_H - TOOLTIP_GAP;
        left = spotlight.x + spotlight.width / 2 - TOOLTIP_W / 2;
        break;
      case 'left':
        top = spotlight.y + spotlight.height / 2 - TOOLTIP_H / 2;
        left = spotlight.x - TOOLTIP_W - TOOLTIP_GAP;
        break;
      case 'right':
        top = spotlight.y + spotlight.height / 2 - TOOLTIP_H / 2;
        left = spotlight.x + spotlight.width + TOOLTIP_GAP;
        break;
      default:
        top = vh - TOOLTIP_H - 16;
        left = vw / 2 - TOOLTIP_W / 2;
    }

    // Clamp to viewport
    left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_W - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - TOOLTIP_H - MARGIN));

    return {
      position: 'fixed',
      top,
      left,
      width: TOOLTIP_W,
    };
  };

  if (!active) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200]"
          aria-modal="true"
          role="dialog"
          aria-label="Guided tour"
        >
          {/* SVG overlay with spotlight cutout */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 200 }}
          >
            <defs>
              <mask id="tour-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {spotlight && (
                  <motion.rect
                    initial={false}
                    animate={{
                      x: spotlight.x,
                      y: spotlight.y,
                      width: spotlight.width,
                      height: spotlight.height,
                    }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    rx={BORDER_RADIUS}
                    ry={BORDER_RADIUS}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.75)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>

          {/* Spotlight border glow */}
          {spotlight && (
            <motion.div
              initial={false}
              animate={{
                left: spotlight.x,
                top: spotlight.y,
                width: spotlight.width,
                height: spotlight.height,
              }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="fixed rounded-2xl border border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.25)] pointer-events-none"
              style={{ zIndex: 201 }}
            />
          )}

          {/* Click-blocker frame — 4 divs around the spotlight so clicks INSIDE
              the spotlight area pass through to the element below (e.g. the
              widget's X button). Clicks on the frame advance the tour. */}
          {spotlight ? (
            <>
              {/* Top */}
              <div
                className="fixed"
                style={{
                  zIndex: 201,
                  top: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(0, spotlight.y),
                }}
                onClick={goNext}
              />
              {/* Bottom */}
              <div
                className="fixed"
                style={{
                  zIndex: 201,
                  top: spotlight.y + spotlight.height,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onClick={goNext}
              />
              {/* Left */}
              <div
                className="fixed"
                style={{
                  zIndex: 201,
                  top: spotlight.y,
                  left: 0,
                  width: Math.max(0, spotlight.x),
                  height: spotlight.height,
                }}
                onClick={goNext}
              />
              {/* Right */}
              <div
                className="fixed"
                style={{
                  zIndex: 201,
                  top: spotlight.y,
                  left: spotlight.x + spotlight.width,
                  right: 0,
                  height: spotlight.height,
                }}
                onClick={goNext}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{ zIndex: 201 }}
              onClick={goNext}
            />
          )}

          {/* Tooltip card */}
          <motion.div
            ref={tooltipRef}
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ ...getTooltipStyle(), zIndex: 202 }}
            className="w-[320px] max-w-[calc(100vw-32px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5 shadow-2xl shadow-black/60">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                    {currentStep + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-white leading-tight">
                    {step?.title}
                  </h3>
                </div>
                <button
                  onClick={completeTour}
                  className="p-1 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-white/10 shrink-0"
                  aria-label="Skip tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                {step?.description}
              </p>

              {/* Progress bar */}
              <div className="w-full h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {currentStep + 1} of {steps.length}
                </span>

                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <button
                      onClick={goPrev}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Back
                    </button>
                  )}
                  {isFirstStep && (
                    <button
                      onClick={completeTour}
                      className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={goNext}
                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-black bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors"
                  >
                    {isLastStep ? "Let's go!" : 'Next'}
                    {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
